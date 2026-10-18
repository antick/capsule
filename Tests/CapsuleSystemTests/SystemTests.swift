import CapsuleActivity
import CapsuleCore
import CapsuleSystem
import CapsuleUsage
import Foundation
import SQLite3
import Testing

/// A fresh directory for one test, under the system temp dir, resolved past
/// the /var → /private/var symlink so paths compare cleanly.
func scratch() throws -> URL {
  let url = FileManager.default.temporaryDirectory
    .appendingPathComponent("capsule-system-\(UUID().uuidString)", isDirectory: true)
  try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  return url.resolvingSymlinksInPath()
}

func write(_ text: String, to url: URL) throws {
  try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  try Data(text.utf8).write(to: url)
}

func lines(of url: URL) -> (ok: Bool, lines: [String]) {
  var seen: [String] = []
  let ok = eachLine(url.path) { seen.append($0) }
  return (ok, seen)
}

@Suite("SQLite, read-only")
struct SQLiteTests {
  private func database() throws -> String {
    let path = try scratch().appendingPathComponent("store.sqlite").path
    var db: OpaquePointer?
    #expect(sqlite3_open(path, &db) == SQLITE_OK)
    sqlite3_exec(db, """
      CREATE TABLE threads (id TEXT, title TEXT, at REAL);
      INSERT INTO threads VALUES ('t1', 'First', 1788699597.5), ('t2', NULL, 3);
      """, nil, nil, nil)
    sqlite3_close(db)
    return path
  }

  @Test("columns come back as text, NULL as empty")
  func rows() throws {
    let rows = sqliteRows(try database(), "SELECT id, title, at FROM threads ORDER BY id")
    #expect(rows == [["t1", "First", "1788699597.5"], ["t2", "", "3.0"]])
  }

  @Test("a missing store, bad SQL and a write all give nothing")
  func refusals() throws {
    let path = try database()
    #expect(sqliteRows("/nonexistent/store.sqlite", "SELECT 1").isEmpty)
    #expect(sqliteRows(path, "SELECT nonsense FROM").isEmpty)
    #expect(sqliteRows(path, "DELETE FROM threads").isEmpty)
    #expect(sqliteRows(path, "SELECT count(*) FROM threads") == [["2"]], "the write did not happen")
  }
}

@Suite("The keychain")
struct KeychainTests {
  /// Reads only; nothing is ever written to the user's keychain.
  @Test("an item that does not exist is nil")
  func missing() {
    #expect(keychainPassword(service: "capsule-test-\(UUID().uuidString)") == nil)
  }
}

@Suite("Files")
struct FileTests {
  @Test("a capped read refuses a bigger file")
  func capped() throws {
    let dir = try scratch()
    let file = dir.appendingPathComponent("record.json")
    try write(String(repeating: "x", count: 100), to: file)
    #expect(readTextFile(file.path, maxBytes: 100)?.count == 100)
    #expect(readTextFile(file.path, maxBytes: 99) == nil)
    #expect(readTextFile(dir.appendingPathComponent("missing").path) == nil)
  }

  @Test("lines end at \\n, \\r\\n or a lone \\r, as readline reads them")
  func lineEndings() throws {
    let file = try scratch().appendingPathComponent("log.jsonl")
    try write("a\nb\r\nc\rd\n\ne", to: file)
    #expect(lines(of: file).lines == ["a", "b", "c", "d", "", "e"])
    try write("a\nb\n", to: file)
    #expect(lines(of: file).lines == ["a", "b"], "a trailing newline adds no empty line")
  }

  @Test("lines and characters that cross a chunk boundary survive")
  func chunkBoundary() throws {
    let file = try scratch().appendingPathComponent("big.jsonl")
    // Puts a multi-byte character and a CRLF pair across the 64 KiB boundary.
    let first = String(repeating: "a", count: 64 * 1024 - 2) + "é"
    try write(first + "\r\n" + "second", to: file)
    let read = lines(of: file).lines
    #expect(read == [first, "second"])
  }

  @Test("an unreadable file reports false")
  func unreadable() throws {
    #expect(lines(of: try scratch().appendingPathComponent("missing.jsonl")).ok == false)
  }

  @Test("a walk finds regular files, skipping hidden entries")
  func walk() throws {
    let dir = try scratch()
    try write("12345", to: dir.appendingPathComponent("p/a.jsonl"))
    try write("x", to: dir.appendingPathComponent("p/deeper/b.jsonl"))
    try write("hidden", to: dir.appendingPathComponent(".cache/c.jsonl"))
    try write("hidden", to: dir.appendingPathComponent("p/.d.jsonl"))
    let found = walkFiles(dir.path).sorted { $0.path < $1.path }
    #expect(found.map { ($0.path as NSString).lastPathComponent } == ["a.jsonl", "b.jsonl"])
    #expect(found.first?.size == 5)
    #expect(found.allSatisfy { $0.modifiedMs > 0 })
  }
}

@Suite("Tail reads")
struct TailTests {
  @Test("only a .jsonl under an allowed root is read")
  func guarded() throws {
    let dir = try scratch()
    let root = dir.appendingPathComponent("allowed")
    try write("inside", to: root.appendingPathComponent("s/log.jsonl"))
    try write("secret", to: dir.appendingPathComponent("outside/log.jsonl"))
    try write("not a log", to: root.appendingPathComponent("s/notes.txt"))
    let reader = TailReader(roots: [root.path])
    #expect(reader.read(root.appendingPathComponent("s/log.jsonl").path, bytes: 1024) == "inside")
    #expect(reader.read(dir.appendingPathComponent("outside/log.jsonl").path, bytes: 1024) == nil)
    #expect(reader.read(root.appendingPathComponent("s/notes.txt").path, bytes: 1024) == nil)
    #expect(reader.read(root.appendingPathComponent("s/../../outside/log.jsonl").path, bytes: 1024) == nil)
  }

  @Test("a symlink out of the root is refused")
  func symlink() throws {
    let dir = try scratch()
    let root = dir.appendingPathComponent("allowed")
    try write("secret", to: dir.appendingPathComponent("outside/real.jsonl"))
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try FileManager.default.createSymbolicLink(
      atPath: root.appendingPathComponent("link.jsonl").path,
      withDestinationPath: dir.appendingPathComponent("outside/real.jsonl").path
    )
    #expect(TailReader(roots: [root.path]).read(root.appendingPathComponent("link.jsonl").path, bytes: 1024) == nil)
  }

  @Test("a tail that starts mid-file drops its partial first line")
  func partialLine() throws {
    let root = try scratch()
    let file = root.appendingPathComponent("log.jsonl")
    try write("first line\nsecond\nthird", to: file)
    #expect(TailReader(roots: [root.path]).read(file.path, bytes: 12) == "third")
  }

  @Test("an unchanged file is served from the cache, a changed one re-read")
  func cache() throws {
    let root = try scratch()
    let file = root.appendingPathComponent("log.jsonl")
    try write("one", to: file)
    let reader = TailReader(roots: [root.path])
    #expect(reader.read(file.path, bytes: 1024) == "one")
    // Unreadable now, with the same size and date: only a cache hit can
    // still answer.
    try FileManager.default.setAttributes([.posixPermissions: 0o000], ofItemAtPath: file.path)
    #expect(reader.read(file.path, bytes: 1024) == "one", "served from the cache")
    #expect(TailReader(roots: [root.path]).read(file.path, bytes: 1024) == nil, "a fresh reader cannot open it")
    try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: file.path)
    try write("two and more", to: file)
    #expect(reader.read(file.path, bytes: 1024) == "two and more")
  }
}

@Suite("Processes")
struct ProcessTests {
  @Test("this process is alive and has a start time")
  func this() throws {
    let pid = Int(ProcessInfo.processInfo.processIdentifier)
    #expect(isProcessAlive(pid))
    let started = try #require(processStartTime(pid))
    #expect(started <= Date())
    #expect(Date().timeIntervalSince(started) < 86_400, "started within the last day")
  }

  @Test("no process group, and no pid nobody holds")
  func refusals() {
    #expect(!isProcessAlive(0))
    #expect(!isProcessAlive(-1))
    #expect(!isProcessAlive(Int(Int32.max)))
    #expect(processStartTime(Int(Int32.max)) == nil)
  }

  @Test("a process owned by someone else is still alive")
  func otherOwner() {
    // launchd is pid 1, owned by root: signalling it is refused, which means it is there.
    #expect(isProcessAlive(1))
  }
}

@Suite("Watching a directory")
struct WatcherTests {
  final class Flag: @unchecked Sendable {
    private let lock = NSLock()
    private var raised = false
    func raise() { lock.withLock { raised = true } }
    var isRaised: Bool { lock.withLock { raised } }
  }

  @Test("a file rewritten in place wakes the watcher")
  func rewrite() async throws {
    let dir = try scratch()
    let file = dir.appendingPathComponent("101.json")
    try write("{}", to: file)
    try await Task.sleep(nanoseconds: 300_000_000)
    let flag = Flag()
    let watcher = try #require(DirectoryWatcher(dir.path) { flag.raise() })
    defer { watcher.stop() }
    try await Task.sleep(nanoseconds: 300_000_000)
    let handle = try FileHandle(forWritingTo: file)
    try handle.seekToEnd()
    try handle.write(contentsOf: Data(" ".utf8))
    try handle.close()
    for _ in 0..<40 where !flag.isRaised { try await Task.sleep(nanoseconds: 100_000_000) }
    #expect(flag.isRaised)
  }
}

@Suite("Hosts")
struct HostTests {
  @Test("the poller host remembers penalties and readings")
  func pollerStore() throws {
    let store = JSONStore(directory: try scratch())
    let host = MacPollerHost(store: store)
    #expect(host.loadBackoff().isEmpty)
    host.saveBackoff(["claude": 1_788_700_000_000])
    #expect(host.loadBackoff() == ["claude": 1_788_700_000_000])
    let reading = UsageSnapshot(
      providerId: .codex, displayName: "Codex", iconId: .codex, primaryPercent: 21, buckets: [],
      status: .ok, fetchedAt: "2026-09-06T13:00:00.000Z"
    )
    host.saveSnapshots([reading])
    #expect(host.loadSnapshots() == [reading])
  }

  @Test("the activity host keeps its token cache")
  func tokenCache() throws {
    let host = MacActivityHost(store: JSONStore(directory: try scratch()))
    #expect(host.loadTokenCache().isEmpty)
    let entry = TokenFileEntry(size: 10, modifiedMs: 5, days: ["2026-09-06": 42])
    host.saveTokenCache(["/a.jsonl": entry])
    #expect(host.loadTokenCache() == ["/a.jsonl": entry])
  }

  /// Offline: a refused local connection, so nothing leaves the machine.
  @Test("a request nothing answers throws rather than inventing a response")
  func refused() async {
    let request = HTTPRequest(url: "http://127.0.0.1:9/usage", headers: [:])
    await #expect(throws: (any Error).self) { try await MacUsageHost().send(request) }
  }
}

@Suite("Codex's thread list")
struct CodexThreadQueryTests {
  @Test("sub-agent threads, guardians and spawned children alike, are left out")
  func subagentsLeftOut() throws {
    let path = try scratch().appendingPathComponent("state.sqlite").path
    var db: OpaquePointer?
    #expect(sqlite3_open(path, &db) == SQLITE_OK)
    sqlite3_exec(db, """
      CREATE TABLE threads (id TEXT, title TEXT, rollout_path TEXT, archived INTEGER, source TEXT, updated_at_ms INTEGER);
      INSERT INTO threads VALUES ('task', 'Build the logo', '/r/task.jsonl', 0, 'vscode', 3);
      INSERT INTO threads VALUES ('guard', 'Guardian review', '/r/guard.jsonl', 0, '{"subagent":{"other":"guardian"}}', 2);
      INSERT INTO threads VALUES ('child', '', '/r/child.jsonl', 0, '{"subagent":{"thread_spawn":{"depth":1}}}', 1);
      INSERT INTO threads VALUES ('old', 'Archived', '/r/old.jsonl', 1, 'cli', 4);
      """, nil, nil, nil)
    sqlite3_close(db)
    #expect(sqliteRows(path, ActivityTuning.codexRolloutsSQL) == [["task", "Build the logo", "/r/task.jsonl"]])
  }
}
