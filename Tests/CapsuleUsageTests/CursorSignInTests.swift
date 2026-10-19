import CapsuleCore
import CapsuleUsage
import Foundation
import Testing

@Suite("Cursor is only signed out when it really is")
struct CursorSignInTests {
  final class Host: UsageHost, @unchecked Sendable {
    let homeDir = "/Users/me"
    var rows: [[String]]?
    var status = 200
    init(rows: [[String]]?, status: Int) {
      self.rows = rows
      self.status = status
    }
    func send(_ request: HTTPRequest) async throws -> HTTPResponse { HTTPResponse(status: status) }
    func readFile(_ path: String) async -> String? { nil }
    func readSecret(_ service: String) async -> String? { nil }
    func query(_ database: String, _ sql: String) async -> [[String]] { rows ?? [] }
    func queryIfReadable(_ database: String, _ sql: String) async -> [[String]]? { rows }
    func environment(_ name: String) -> String? { nil }
  }

  /// A token whose claims carry a subject and the given expiry, hex-encoded
  /// as the store's query returns it.
  func storedToken(expiresIn seconds: Double, now: Date) -> [[String]] {
    func part(_ json: String) -> String {
      Data(json.utf8).base64EncodedString().replacingOccurrences(of: "=", with: "")
        .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
    }
    let exp = Int(now.timeIntervalSince1970 + seconds)
    let token = "\(part(#"{"alg":"none"}"#)).\(part(#"{"sub":"auth0|user_1","exp":\#(exp)}"#)).sig"
    return [[Data(token.utf8).map { String(format: "%02X", $0) }.joined()]]
  }

  let now = Date(timeIntervalSince1970: 1_800_000_000)

  @Test func anUnreadableStoreIsAnErrorNotASignOut() async {
    await #expect(throws: UsageReadError.unreadable(.cursor)) {
      try await CursorUsageProvider().fetchSnapshot(Host(rows: nil, status: 200), now: now)
    }
  }

  @Test func anEmptyStoreIsSignedOut() async throws {
    let snapshot = try await CursorUsageProvider().fetchSnapshot(Host(rows: [], status: 200), now: now)
    #expect(snapshot.status == .unauthenticated)
  }

  @Test func aRefusalWithAGoodTokenIsAnError() async {
    let host = Host(rows: storedToken(expiresIn: 86_400, now: now), status: 403)
    await #expect(throws: UsageReadError.http(.cursor, 403)) {
      try await CursorUsageProvider().fetchSnapshot(host, now: now)
    }
  }

  @Test func aRefusalWithAnExpiredTokenIsSignedOut() async throws {
    let host = Host(rows: storedToken(expiresIn: -60, now: now), status: 401)
    let snapshot = try await CursorUsageProvider().fetchSnapshot(host, now: now)
    #expect(snapshot.status == .unauthenticated)
  }
}
