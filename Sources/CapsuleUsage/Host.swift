import CapsuleCore
import Foundation

public struct HTTPRequest: Sendable, Equatable {
  public var method: String
  public var url: String
  public var headers: [String: String]
  public var body: String?
  /// Trust a self-signed certificate. Only ever honoured for loopback, where
  /// a local app's own server lives.
  public var loopbackSelfSigned: Bool

  public init(
    method: String = "GET", url: String, headers: [String: String], body: String? = nil,
    loopbackSelfSigned: Bool = false
  ) {
    self.method = method
    self.url = url
    self.headers = headers
    self.body = body
    self.loopbackSelfSigned = loopbackSelfSigned
  }
}

public struct HTTPResponse: Sendable {
  public var status: Int
  public var headers: [String: String]
  public var body: Data

  public init(status: Int, headers: [String: String] = [:], body: Data = Data()) {
    self.status = status
    self.headers = headers
    self.body = body
  }

  public var ok: Bool { (200...299).contains(status) }

  /// Header names are case-insensitive.
  public func header(_ name: String) -> String? {
    headers.first { $0.key.caseInsensitiveCompare(name) == .orderedSame }?.value
  }
}

/// Everything a provider's read needs from the machine, so it runs against a
/// stub world in tests and against the real Mac in the app.
public protocol UsageHost: Sendable {
  var homeDir: String { get }
  /// Throws only when no response arrived at all.
  func send(_ request: HTTPRequest) async throws -> HTTPResponse
  func readFile(_ path: String) async -> String?
  /// A generic-password item from the login keychain.
  func readSecret(_ service: String) async -> String?
  /// Rows from a read-only SQL query, or none if the store cannot be read.
  func query(_ database: String, _ sql: String) async -> [[String]]
  /// The same, but nil when the store could not be read at all.
  func queryIfReadable(_ database: String, _ sql: String) async -> [[String]]?
  func storedKey(_ key: StoredKey) async -> String?
  func processes() async -> [RunningProcess]
  func listeningPorts(_ pid: Int) async -> [Int]
  func readSecret(_ service: String, account: String) async -> String?
  func environment(_ name: String) -> String?
  /// Where "today" begins for spend read by the day.
  var timeZone: TimeZone { get }
}

public protocol UsageProvider: Sendable {
  var id: ProviderId { get }
  /// The meter this reader fills: the provider's own sign-in unless it reads
  /// an added account.
  var meter: MeterId { get }
  /// The provider's current reading. Throws ``RateLimited`` when told to wait,
  /// and ``UsageReadError`` when the read failed some other way.
  func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot
}

/// A running process: its id and its command line.
public struct RunningProcess: Sendable, Equatable {
  public var pid: Int
  public var command: String

  public init(pid: Int, command: String) {
    self.pid = pid
    self.command = command
  }
}

extension UsageHost {
  public func queryIfReadable(_ database: String, _ sql: String) async -> [[String]]? { await query(database, sql) }
  /// A key the user saved in Settings.
  public func storedKey(_ key: StoredKey) async -> String? { nil }
  public func processes() async -> [RunningProcess] { [] }
  /// The TCP ports a process listens on, on loopback.
  public func listeningPorts(_ pid: Int) async -> [Int] { [] }
  /// A generic-password item by service and account.
  public func readSecret(_ service: String, account: String) async -> String? { nil }
  public var timeZone: TimeZone { .current }
}

extension UsageProvider {
  public var meter: MeterId { MeterId(id) }
}

public enum UsageReadError: Error, Equatable {
  case http(ProviderId, Int)
  case unreadable(ProviderId)
}

/// The headers every usage request carries, plus the provider's own.
func usageHeaders(_ extra: [String: String] = [:]) -> [String: String] {
  ["Accept": "application/json", "User-Agent": UsageEndpoints.userAgent]
    .merging(extra) { _, new in new }
}

/// A tool's auth file, which its own environment variable can move.
func credentialPath(_ host: UsageHost, env: String, _ segments: [String]) -> String {
  if let override = host.environment(env), !override.isEmpty {
    return joinPath(override, [segments.last ?? "auth.json"])
  }
  return joinPath(host.homeDir, segments)
}

/// A request body as JSON text, for values that must be escaped.
func jsonBody(_ object: [String: Any]) -> String {
  guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return "{}" }
  return String(decoding: data, as: UTF8.self)
}

func decode<Payload: Decodable>(_ type: Payload.Type, _ response: HTTPResponse, _ provider: ProviderId) throws
  -> Payload
{
  do {
    return try JSONDecoder().decode(type, from: response.body)
  } catch {
    throw UsageReadError.unreadable(provider)
  }
}

func rateLimited(_ response: HTTPResponse, now: Date, fallback: UsageSnapshot? = nil) -> RateLimited {
  RateLimited(retryAfterMs: retryAfterMs(header: response.header("Retry-After"), now: now), fallback: fallback)
}
