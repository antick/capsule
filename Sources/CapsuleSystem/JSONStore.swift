import Foundation

/// Small JSON documents in one directory, written atomically, so an
/// interrupted write leaves the previous version rather than half a file.
public struct JSONStore: Sendable {
  public let directory: URL

  public init(directory: URL) {
    self.directory = directory
  }

  /// `~/Library/Application Support/<name>`.
  public static func applicationSupport(_ name: String) -> JSONStore {
    let base =
      FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
    return JSONStore(directory: base.appendingPathComponent(name, isDirectory: true))
  }

  public func load<Value: Decodable>(_ name: String, as type: Value.Type = Value.self) -> Value? {
    guard let data = FileManager.default.contents(atPath: directory.appendingPathComponent(name).path) else {
      return nil
    }
    return try? JSONDecoder().decode(type, from: data)
  }

  /// Saving is best effort: a reading that cannot be written down is still
  /// shown, and the next save tries again.
  public func save<Value: Encodable>(_ name: String, _ value: Value) {
    guard let data = try? JSONEncoder().encode(value) else { return }
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try? data.write(to: directory.appendingPathComponent(name), options: .atomic)
  }
}
