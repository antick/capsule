import CapsuleCore
import Foundation

public struct CursorUsageProvider: UsageProvider {
  public let id = ProviderId.cursor
  public init() {}

  /// The summary the editor's own dashboard asks for, with its session as a
  /// cookie. The older endpoint takes the user in the query and the token as a
  /// bearer, and is tried only when the summary failed for another reason.
  private func summary(_ host: UsageHost, token: String, user: String) async throws -> HTTPResponse {
    let response = try await host.send(
      HTTPRequest(
        url: UsageEndpoints.Cursor.usageURL,
        headers: usageHeaders(["Cookie": "\(UsageEndpoints.Cursor.sessionCookie)=\(user)%3A%3A\(token)"])
      )
    )
    if response.ok || [401, 403, 429].contains(response.status) { return response }
    return try await host.send(
      HTTPRequest(
        url: "\(UsageEndpoints.Cursor.legacyURL)?user=\(jsEncodeURIComponent(user))",
        headers: usageHeaders(["Authorization": "Bearer \(token)"])
      )
    )
  }

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    // Read straight from Cursor's state store rather than through the sqlite3
    // command the original shells out to: the same query, one process fewer.
    let rows = await host.query(
      joinPath(host.homeDir, UsageEndpoints.Cursor.stateDatabasePath), UsageEndpoints.Cursor.tokenSQL
    )
    guard let token = cursorTokenFromHex(rows.first?.first), let user = jwtSubject(token) else {
      return unauthenticatedSnapshot(id, fetchedAt: now)
    }
    let response = try await summary(host, token: token, user: user)
    if response.status == 401 || response.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapCursorUsage(try decode(CursorSummary.self, response, id), fetchedAt: now)
  }
}
