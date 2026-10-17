import CapsuleCore
import Foundation

/// Everything the activity readers need from the machine, so they run against
/// a stub in tests and against the real Mac in the app.
public protocol ActivityHost: Sendable {
  func now() -> Date
  var homeDir: String { get }
  /// Entry names in a directory, or none if it is not there.
  func listDir(_ dir: String) async -> [String]
  func readFile(_ path: String) async -> String?
  /// Whether this host can read the tail of a log at all. A stale Codex
  /// rollout is only worth considering when it can.
  var canReadTail: Bool { get }
  /// At most the final `bytes` of a local event log.
  func readTail(_ path: String, bytes: Int) async -> String?
  func modifiedAt(_ path: String) async -> Date?
  /// Whether a process with this pid exists, whoever owns it.
  func isProcessAlive(_ pid: Int) async -> Bool
  /// When that process started, or nil if the system will not say.
  func processStartedAt(_ pid: Int) async -> Date?
  /// Rows from a read-only SQL query, or none if the store cannot be read.
  func query(_ database: String, _ sql: String) async -> [[String]]
}

/// A file the token scanner might read, as a directory walk describes it.
public struct LogFile: Sendable, Equatable {
  public var path: String
  public var size: Double
  public var modifiedMs: Double

  public init(path: String, size: Double, modifiedMs: Double) {
    self.path = path
    self.size = size
    self.modifiedMs = modifiedMs
  }
}

/// What the token scanner needs beyond the activity host: a tree listed with
/// sizes and dates without reading anything, a file read a line at a time,
/// and somewhere to keep what it worked out last time.
public protocol TokenScanHost: ActivityHost {
  func walk(_ dir: String) async -> [LogFile]
  /// Feeds every line to `onLine`; false if the file could not be read.
  func eachLine(_ path: String, _ onLine: (String) -> Void) async -> Bool
  func loadTokenCache() -> [String: TokenFileEntry]
  func saveTokenCache(_ cache: [String: TokenFileEntry])
}

extension ActivityHost {
  func tail(_ path: String) async -> String? {
    canReadTail ? await readTail(path, bytes: ActivityTuning.tailBytes) : nil
  }
}
