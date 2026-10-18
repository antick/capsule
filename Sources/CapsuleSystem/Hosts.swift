import CapsuleActivity
import CapsuleCore
import CapsuleUsage
import Foundation

private var userHome: String { FileManager.default.homeDirectoryForCurrentUser.path }

/// The usage readers' view of this Mac.
public struct MacUsageHost: UsageHost {
  private let session: URLSession

  public init() {
    let configuration = URLSessionConfiguration.ephemeral
    // Each request carries exactly the headers its provider sets: no cookies
    // a response left behind, and no cached answers.
    configuration.httpShouldSetCookies = false
    configuration.httpCookieAcceptPolicy = .never
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    session = URLSession(configuration: configuration)
  }

  public var homeDir: String { userHome }

  public func send(_ request: HTTPRequest) async throws -> HTTPResponse {
    guard let url = URL(string: request.url) else { throw URLError(.badURL) }
    var outgoing = URLRequest(url: url)
    outgoing.httpMethod = request.method
    for (name, value) in request.headers { outgoing.setValue(value, forHTTPHeaderField: name) }
    outgoing.httpBody = request.body.map { Data($0.utf8) }
    let (data, response) = try await session.data(for: outgoing)
    guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
    let headers = Dictionary(
      http.allHeaderFields.compactMap { key, value in
        (key as? String).map { ($0, "\(value)") }
      },
      uniquingKeysWith: { first, _ in first }
    )
    return HTTPResponse(status: http.statusCode, headers: headers, body: data)
  }

  public func readFile(_ path: String) async -> String? { readTextFile(path) }
  public func readSecret(_ service: String) async -> String? { keychainPassword(service: service) }
  public func query(_ database: String, _ sql: String) async -> [[String]] { sqliteRows(database, sql) }
  public func environment(_ name: String) -> String? { ProcessInfo.processInfo.environment[name] }
}

/// The activity readers' and token scanner's view of this Mac.
public final class MacActivityHost: TokenScanHost, @unchecked Sendable {
  private let tails: TailReader
  private let store: JSONStore

  public init(store: JSONStore) {
    let home = userHome
    tails = TailReader(
      roots: [ActivityTuning.codexSessionsDir, ActivityTuning.claudeProjectsDir, ActivityTuning.grokSessionsDir]
        .map { joinPath(home, $0) }
    )
    self.store = store
  }

  public func now() -> Date { Date() }
  public var homeDir: String { userHome }
  public func listDir(_ dir: String) async -> [String] { listDirectory(dir) }
  public func readFile(_ path: String) async -> String? {
    readTextFile(path, maxBytes: ActivityTuning.maxRecordBytes)
  }
  public var canReadTail: Bool { true }
  public func readTail(_ path: String, bytes: Int) async -> String? { tails.read(path, bytes: bytes) }
  public func modifiedAt(_ path: String) async -> Date? { modificationDate(path) }
  public func isProcessAlive(_ pid: Int) async -> Bool { CapsuleSystem.isProcessAlive(pid) }
  public func processStartedAt(_ pid: Int) async -> Date? { processStartTime(pid) }
  public func query(_ database: String, _ sql: String) async -> [[String]] { sqliteRows(database, sql) }
  public func walk(_ dir: String) async -> [LogFile] { walkFiles(dir) }
  public func eachLine(_ path: String, _ onLine: (String) -> Void) async -> Bool {
    CapsuleSystem.eachLine(path, onLine)
  }
  public func loadTokenCache() -> [String: TokenFileEntry] {
    store.load(StoreFiles.tokenCache) ?? [:]
  }
  public func saveTokenCache(_ cache: [String: TokenFileEntry]) { store.save(StoreFiles.tokenCache, cache) }
}

/// The poller's clock, and where it remembers penalties and readings across
/// launches.
public struct MacPollerHost: PollerHost {
  public let usage: UsageHost
  private let store: JSONStore

  public init(usage: UsageHost = MacUsageHost(), store: JSONStore) {
    self.usage = usage
    self.store = store
  }

  public func now() -> Date { Date() }
  public func loadBackoff() -> [String: Double] { store.load(StoreFiles.backoff) ?? [:] }
  public func saveBackoff(_ until: [String: Double]) { store.save(StoreFiles.backoff, until) }
  public func loadSnapshots() -> [UsageSnapshot] { store.load(StoreFiles.snapshots) ?? [] }
  public func saveSnapshots(_ snapshots: [UsageSnapshot]) { store.save(StoreFiles.snapshots, snapshots) }
}

/// The documents the hosts keep. Readings get their own files: they change
/// every poll, and the settings file should not.
public enum StoreFiles {
  public static let backoff = "usage-backoff.json"
  public static let snapshots = "usage-snapshots.json"
  public static let tokenCache = "token-cache.json"
}
