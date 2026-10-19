import CapsuleCore
import Foundation

/// The Console's prepaid credit: amounts in minor units, divided by ten to
/// the `exponent`.
public struct ClaudeConsoleCredits: Sendable, Codable, Equatable {
  public struct Tranche: Sendable, Codable, Equatable {
    @Lenient public var program_id: String?
    @Lenient public var granted_amount_minor_units: Double?
    @Lenient public var remaining_amount_minor_units: Double?
    @Lenient public var expires_at: String?
  }
  public struct Balance: Sendable, Codable, Equatable {
    public struct Credits: Sendable, Codable, Equatable {
      @Lenient public var exponent: Double?
    }
    @Lenient public var credits: Credits?
  }
  @Lenient public var currency: String?
  @Lenient public var balance: Balance?
  @LossyArray public var promo_tranches: [Tranche]?
  @LossyArray public var tranches: [Tranche]?
}

/// The API credit a Max plan includes each month: what is left of the
/// soonest-expiring grant, and when it expires.
public func claudeSubscriptionCredit(_ credits: ClaudeConsoleCredits, now: Date) -> UsageExtra? {
  let exponent = min(4, max(0, credits.balance?.credits?.exponent ?? 2))
  let unit = pow(10, exponent)
  let currency = credits.currency ?? MoneyDefaults.currency
  let grants = ((credits.promo_tranches ?? []) + (credits.tranches ?? []))
    .filter { $0.program_id == UsageEndpoints.ClaudeConsole.subscriptionProgram }
    .filter { ($0.granted_amount_minor_units ?? 0) > 0 }
    .filter { $0.expires_at.flatMap(looseDate).map { $0 > now } ?? true }
    .sorted { ($0.expires_at.flatMap(looseDate) ?? .distantFuture) < ($1.expires_at.flatMap(looseDate) ?? .distantFuture) }
  guard let grant = grants.first(where: { ($0.remaining_amount_minor_units ?? 0) > 0 }) ?? grants.first,
    let granted = grant.granted_amount_minor_units
  else { return nil }
  let left = max(0, grant.remaining_amount_minor_units ?? 0) / unit
  let total = granted / unit
  return UsageExtra(
    id: "api-credit", label: Copy.apiCredit,
    value: "\(formatMoney(left, currency: currency)) \(Copy.left) \(Copy.of) \(formatMoney(total, currency: currency))",
    percentUsed: max(0, min(100, (total - left) / total * 100)), resetsAt: grant.expires_at)
}

/// Reads the grant with the Console session the user pasted, at most hourly
/// once it has an answer. A new session is read at once, and a failed read
/// is tried again on the next poll rather than held for the hour.
actor ClaudeConsoleMemo {
  private var session: String?
  private var at: Date?
  private var kept: UsageExtra?

  func value(_ host: UsageHost, now: Date) async -> UsageExtra? {
    guard let session = await host.storedKey(.claudeConsole) else {
      self.session = nil
      kept = nil
      return nil
    }
    if session != self.session {
      self.session = session
      at = nil
      kept = nil
    }
    if let at, now.timeIntervalSince(at) < UsageEndpoints.ClaudeConsole.refreshSeconds, at <= now { return kept }
    let rules = UsageEndpoints.ClaudeConsole.self
    let headers = usageHeaders(["Cookie": "\(rules.cookieName)=\(session)"])
    guard
      let orgs = try? await host.send(HTTPRequest(url: rules.base + rules.organizationsPath, headers: headers)),
      orgs.ok, let list = JSONValue.parse(String(decoding: orgs.body, as: UTF8.self))?.asArray
    else { return kept }
    // Only an organization with API access holds Console credit.
    let candidates = list.filter { org in
      org["capabilities"]?.asArray?.contains { $0.asString == "api" } == true
    }.compactMap { $0["uuid"]?.asString }
    for uuid in candidates {
      guard
        let response = try? await host.send(
          HTTPRequest(url: "\(rules.base)\(rules.organizationsPath)/\(uuid)/prepaid/credits", headers: headers)),
        response.ok, let credits = try? JSONDecoder().decode(ClaudeConsoleCredits.self, from: response.body),
        let extra = claudeSubscriptionCredit(credits, now: now)
      else { continue }
      kept = extra
      at = now
      return extra
    }
    return kept
  }
}

let claudeConsoleMemo = ClaudeConsoleMemo()

extension Copy {
  public static let apiCredit = "API credit"
}
