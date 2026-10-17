import CapsuleCore
import Foundation

public struct HTTPRequest: Sendable, Equatable {
  public var method: String
  public var url: String
  public var headers: [String: String]
  public var body: String?

  public init(method: String = "GET", url: String, headers: [String: String], body: String? = nil) {
    self.method = method
    self.url = url
    self.headers = headers
    self.body = body
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
  /// What a local command printed, or nil if it failed or is not installed.
  func runCommand(_ file: String, _ arguments: [String]) async -> String?
  /// Rows from a read-only SQL query, or none if the store cannot be read.
  func query(_ database: String, _ sql: String) async -> [[String]]
  func environment(_ name: String) -> String?
}

public protocol UsageProvider: Sendable {
  var id: ProviderId { get }
  /// The provider's current reading. Throws ``RateLimited`` when told to wait,
  /// and ``UsageReadError`` when the read failed some other way.
  func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot
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
