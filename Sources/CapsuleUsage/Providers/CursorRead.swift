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
    // The current period first: on the newer plans that is where the usage
    // is, and the monthly summary reads zero. Anything short of a usable
    // answer, other than a refusal, falls back to the summary.
    let cookie = "\(UsageEndpoints.Cursor.sessionCookie)=\(user)%3A%3A\(token)"
    if let period = try? await host.send(
      HTTPRequest(
        method: "POST", url: UsageEndpoints.Cursor.periodUsageURL,
        headers: usageHeaders([
          "Content-Type": "application/json", "Cookie": cookie,
          "Origin": UsageEndpoints.Cursor.dashboardOrigin, "Referer": UsageEndpoints.Cursor.dashboardReferer,
        ]),
        body: "{}"
      )
    ) {
      if period.status == 401 || period.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
      if period.status == 429 { throw rateLimited(period, now: now) }
      if period.ok, let payload = try? decode(CursorPeriodUsage.self, period, id),
        let snapshot = mapCursorPeriod(payload, fetchedAt: now)
      {
        return snapshot
      }
    }
    let response = try await summary(host, token: token, user: user)
    if response.status == 401 || response.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapCursorUsage(try decode(CursorSummary.self, response, id), fetchedAt: now)
  }
}
