import CapsuleActivity
import CapsuleCore
import Foundation

/// A whole text file, or nil. With `maxBytes`, a bigger file is refused
/// rather than read.
public func readTextFile(_ path: String, maxBytes: Int? = nil) -> String? {
  if let maxBytes {
    guard let size = (try? FileManager.default.attributesOfItem(atPath: path))?[.size] as? Int,
      size <= maxBytes
    else { return nil }
  }
  guard let data = FileManager.default.contents(atPath: path) else { return nil }
  return String(decoding: data, as: UTF8.self)
}

public func listDirectory(_ dir: String) -> [String] {
  (try? FileManager.default.contentsOfDirectory(atPath: dir)) ?? []
}

public func modificationDate(_ path: String) -> Date? {
  (try? FileManager.default.attributesOfItem(atPath: path))?[.modificationDate] as? Date
}

/// Every regular file under `dir`, hidden entries and their contents left
/// out, with the two facts the token cache keys on.
public func walkFiles(_ dir: String) -> [LogFile] {
  let manager = FileManager.default
  var found: [LogFile] = []
  var pending = [dir]
  while let current = pending.popLast() {
    guard let names = try? manager.contentsOfDirectory(atPath: current) else { continue }
    for name in names where !name.hasPrefix(".") {
      let path = (current as NSString).appendingPathComponent(name)
      // Gone between listing and stat: nothing to count.
      guard let attributes = try? manager.attributesOfItem(atPath: path),
        let type = attributes[.type] as? FileAttributeType
      else { continue }
      if type == .typeDirectory {
        pending.append(path)
      } else if type == .typeRegular, let size = attributes[.size] as? Int,
        let modified = attributes[.modificationDate] as? Date
      {
        found.append(LogFile(path: path, size: Double(size), modifiedMs: modified.timeIntervalSince1970 * 1000))
      }
    }
  }
  return found
}

/// Streams a file a line at a time, so a gigabyte of transcript never sits in
/// memory. Lines end at `\n`, `\r\n` or a lone `\r`, as Node's readline reads
/// them; a final line without a newline still counts. False if unreadable.
public func eachLine(_ path: String, _ onLine: (String) -> Void) -> Bool {
  guard let handle = FileHandle(forReadingAtPath: path) else { return false }
  defer { try? handle.close() }
  var line = Data()
  var afterCarriageReturn = false
  while true {
    let chunk: Data
    do {
      chunk = try handle.read(upToCount: 64 * 1024) ?? Data()
    } catch {
      return false
    }
    if chunk.isEmpty { break }
    var start = chunk.startIndex
    for index in chunk.indices {
      let byte = chunk[index]
      guard byte == 0x0A || byte == 0x0D else { continue }
      line.append(chunk[start..<index])
      start = chunk.index(after: index)
      // The "\n" of a "\r\n" pair ends nothing new.
      if byte == 0x0A && afterCarriageReturn && line.isEmpty {
        afterCarriageReturn = false
        continue
      }
      onLine(String(decoding: line, as: UTF8.self))
      line.removeAll(keepingCapacity: true)
      afterCarriageReturn = byte == 0x0D
    }
    if start < chunk.endIndex {
      line.append(chunk[start..<chunk.endIndex])
      afterCarriageReturn = false
    }
  }
  if !line.isEmpty { onLine(String(decoding: line, as: UTF8.self)) }
  return true
}

/// Reads the tail of an agent's local event log, and nothing else.
///
/// Only `.jsonl` files whose real path lies under one of `roots` are read, so
/// neither a crafted path nor a symlink can point it at another file. A tail
/// that starts mid-file drops its partial first line. An unchanged file costs
/// one stat: tails are kept, a bounded number of them, keyed on what changes.
public final class TailReader: @unchecked Sendable {
  private let roots: [String]
  private let capacity: Int
  private let lock = NSLock()
  private var cache: [String: (stamp: String, text: String)] = [:]
  private var order: [String] = []

  public init(roots: [String], capacity: Int = ActivityTuning.maxSessions) {
    self.roots = roots.map { URL(fileURLWithPath: $0).resolvingSymlinksInPath().path }
    self.capacity = capacity
  }

  public func read(_ path: String, bytes: Int) -> String? {
    guard path.hasSuffix(".jsonl") else { return nil }
    let canonical = URL(fileURLWithPath: path).resolvingSymlinksInPath().path
    guard roots.contains(where: { canonical.hasPrefix($0 + "/") }),
      let attributes = try? FileManager.default.attributesOfItem(atPath: canonical),
      let size = attributes[.size] as? Int
    else { return nil }
    let inode = (attributes[.systemFileNumber] as? Int) ?? 0
    let modified = ((attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0) * 1000
    let stamp = "\(inode):\(modified):\(size):\(bytes)"
    if let hit = lock.withLock({ cache[path] }), hit.stamp == stamp { return hit.text }

    guard let handle = FileHandle(forReadingAtPath: canonical) else { return nil }
    defer { try? handle.close() }
    let length = min(size, bytes, ActivityTuning.tailBytes)
    guard (try? handle.seek(toOffset: UInt64(size - length))) != nil,
      let data = try? handle.read(upToCount: length)
    else { return nil }
    let text = String(decoding: data, as: UTF8.self)
    let tail: String
    if size > length, let newline = text.firstIndex(of: "\n") {
      tail = String(text[text.index(after: newline)...])
    } else if size > length {
      tail = ""
    } else {
      tail = text
    }
    lock.withLock {
      order.removeAll { $0 == path }
      order.append(path)
      cache[path] = (stamp, tail)
      while order.count > capacity { cache[order.removeFirst()] = nil }
    }
    return tail
  }
}
