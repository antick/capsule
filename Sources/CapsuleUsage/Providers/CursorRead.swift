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

  /// The detail beyond the period's percentages: the Grok Bot pool, premium
  /// requests, and credit left. Each is its own request and optional: one
  /// that fails leaves the rest of the reading as it was.
  private func enriched(
    _ snapshot: UsageSnapshot, _ host: UsageHost, token: String, user: String, cookie: String, now: Date
  ) async -> UsageSnapshot {
    let site = usageHeaders([
      "Cookie": cookie, "Origin": UsageEndpoints.Cursor.dashboardOrigin,
      "Referer": UsageEndpoints.Cursor.dashboardReferer,
    ])
    func read<T: Decodable>(_ type: T.Type, _ request: HTTPRequest) async -> T? {
      guard let response = try? await host.send(request), response.ok else { return nil }
      return try? decode(type, response, id)
    }
    let grokBot = await read(
      CursorGrokBot.self,
      HTTPRequest(
        method: "POST", url: UsageEndpoints.Cursor.grokBotURL,
        headers: site.merging(["Content-Type": "application/json"]) { _, new in new }, body: "{}"))
    let requests = await read(
      CursorRequests.self,
      HTTPRequest(
        url: "\(UsageEndpoints.Cursor.legacyURL)?user=\(jsEncodeURIComponent(user))",
        headers: usageHeaders(["Authorization": "Bearer \(token)"])))
    let grants = await read(
      CursorCreditGrants.self,
      HTTPRequest(
        method: "POST", url: UsageEndpoints.Cursor.creditGrantsURL,
        headers: usageHeaders([
          "Authorization": "Bearer \(token)", "Content-Type": "application/json",
          UsageEndpoints.Cursor.connectProtocolHeader: UsageEndpoints.Cursor.connectProtocolVersion,
        ]), body: "{}"))
    let stripe = await read(CursorStripe.self, HTTPRequest(url: UsageEndpoints.Cursor.stripeURL, headers: site))
    let spend = await cursorSpendMemo.value(user: user, now: now) {
      var events: [CursorUsageEvents.Event] = []
      let start = startOfDay(now, daysAgo: TokenTuning.historyDays - 1)
      for page in 1...UsageEndpoints.Cursor.maxEventPages {
        let body =
          #"{"startDate":"\#(Int(start.timeIntervalSince1970 * 1000))","endDate":"\#(Int(now.timeIntervalSince1970 * 1000))","page":\#(page),"pageSize":\#(UsageEndpoints.Cursor.eventsPageSize)}"#
        guard
          let read = await read(
            CursorUsageEvents.self,
            HTTPRequest(
              method: "POST", url: UsageEndpoints.Cursor.usageEventsURL,
              headers: site.merging(["Content-Type": "application/json"]) { _, new in new }, body: body))
        else { return nil }
        let batch = read.usageEventsDisplay ?? []
        events += batch
        if batch.isEmpty || Double(events.count) >= (read.totalUsageEventsCount ?? 0) { break }
      }
      return cursorSpend(events, now: now)
    }
    var next = snapshot
    next.buckets += [cursorGrokBot(grokBot, fetchedAt: now), cursorRequestRow(requests, fetchedAt: now)].compactMap { $0 }
    let added = [cursorCredits(grants, stripe: stripe), spend].compactMap { $0 }
    if !added.isEmpty || next.extras != nil { next.extras = (next.extras ?? []) + added }
    return next
  }

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    // Read straight from Cursor's state store rather than through the sqlite3
    // command the original shells out to: the same query, one process fewer.
    // A store that could not be read, often because Cursor is mid-write,
    // says nothing about the sign-in: keep the last numbers and look again.
    guard
      let rows = await host.queryIfReadable(
        joinPath(host.homeDir, UsageEndpoints.Cursor.stateDatabasePath), UsageEndpoints.Cursor.tokenSQL
      )
    else { throw UsageReadError.unreadable(id) }
    guard let token = cursorTokenFromHex(rows.first?.first), let user = jwtSubject(token) else {
      UsageLog.poller.notice("cursor has no token in its store")
      return unauthenticatedSnapshot(id, fetchedAt: now)
    }
    /// Turned away while the token itself is still good: a passing refusal
    /// (the site's bot screening, say), not a sign-out. Kept as an error so
    /// the last numbers stay and the next poll asks again.
    func refused(_ status: Int) throws -> UsageSnapshot {
      if let expiry = jwtExpiry(token), expiry > now { throw UsageReadError.http(id, status) }
      UsageLog.poller.notice("cursor token expired; showing it as signed out")
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
      if period.status == 401 || period.status == 403 { return try refused(period.status) }
      if period.status == 429 { throw rateLimited(period, now: now) }
      if period.ok, let payload = try? decode(CursorPeriodUsage.self, period, id),
        let snapshot = mapCursorPeriod(payload, fetchedAt: now)
      {
        return await enriched(snapshot, host, token: token, user: user, cookie: cookie, now: now)
      }
    }
    let response = try await summary(host, token: token, user: user)
    if response.status == 401 || response.status == 403 { return try refused(response.status) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapCursorUsage(try decode(CursorSummary.self, response, id), fetchedAt: now)
  }
}

/// Cursor's spend, kept for an hour: paging through a month of events on
/// every poll would cost more than the number is worth.
actor CursorSpendMemo {
  private var user: String?
  private var at: Date?
  private var kept: UsageExtra?

  func value(user: String, now: Date, fetch: () async -> UsageExtra?) async -> UsageExtra? {
    if self.user == user, let at, now.timeIntervalSince(at) < UsageEndpoints.Cursor.spendRefreshSeconds, at <= now {
      return kept
    }
    let fresh = await fetch()
    self.user = user
    at = now
    if fresh != nil { kept = fresh }
    return kept
  }
}

let cursorSpendMemo = CursorSpendMemo()
