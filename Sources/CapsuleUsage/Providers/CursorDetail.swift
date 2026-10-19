import CapsuleCore
import Foundation

/// Spend against the on-demand limit, from the current-period response.
/// Money is in cents.
public struct CursorSpendLimit: Sendable, Codable, Equatable {
  @Lenient public var individualLimit: Double?
  @Lenient public var individualUsed: Double?
  @Lenient public var individualRemaining: Double?
  @Lenient public var pooledLimit: Double?
  @Lenient public var pooledUsed: Double?
  @Lenient public var pooledRemaining: Double?
  @Lenient public var totalSpend: Double?
}

/// Prepaid credit grants. Money is in cents.
public struct CursorCreditGrants: Sendable, Codable, Equatable {
  @Lenient public var hasCreditGrants: Bool?
  @Lenient public var totalCents: NumberOrString?
  @Lenient public var usedCents: NumberOrString?
}

/// The Stripe account: a negative balance is credit the user holds, in cents.
public struct CursorStripe: Sendable, Codable, Equatable {
  @Lenient public var customerBalance: Double?
}

/// The Grok Bot allowance.
public struct CursorGrokBot: Sendable, Codable, Equatable {
  @Lenient public var usagePercent: Double?
  @Lenient public var nextResetTimestampUtc: String?
  @Lenient public var currentPeriodStart: String?
  @Lenient public var usesPooledEnterpriseAllowance: Bool?
  @Lenient public var hasNonZeroIncludedLimit: Bool?
  @Lenient public var includedLimitZero: Bool?
}

/// Request-based plans count requests to the premium models.
public struct CursorRequests: Sendable, Codable, Equatable {
  public struct Model: Sendable, Codable, Equatable {
    @Lenient public var numRequests: Double?
    @Lenient public var maxRequestUsage: Double?
  }
  @Lenient public var startOfMonth: String?
  public var gpt4: Model?

  enum CodingKeys: String, CodingKey {
    case startOfMonth
    case gpt4 = "gpt-4"
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    _startOfMonth = try container.decode(Lenient<String>.self, forKey: .startOfMonth)
    gpt4 = try? container.decodeIfPresent(Model.self, forKey: .gpt4)
  }
}

private func cents(_ value: NumberOrString?) -> Double? {
  switch value {
  case .number(let number): return number
  case .string(let text): return Double(jsTrim(text))
  case nil: return nil
  }
}

/// On-demand spend: against its limit when there is one, or the amount spent.
public func cursorOnDemand(_ spend: CursorSpendLimit?, resetsAt: String) -> UsageExtra? {
  guard let spend else { return nil }
  let limit = spend.individualLimit ?? spend.pooledLimit
  let remaining = spend.individualRemaining ?? spend.pooledRemaining
  let spent =
    [spend.individualUsed, spend.pooledUsed, spend.totalSpend].compactMap { $0 }.first { $0 > 0 }
    ?? limit.flatMap { limit in remaining.map { max(0, limit - $0) } } ?? 0
  if let limit, limit > 0 {
    return UsageExtra(
      id: "on-demand", label: Copy.cursorOnDemand,
      value: "\(formatMoney(spent / 100)) \(Copy.of) \(formatMoney(limit / 100))",
      percentUsed: clampPercent(spent / limit * 100), resetsAt: resetsAt)
  }
  guard spent > 0 else { return nil }
  return UsageExtra(
    id: "on-demand", label: Copy.cursorOnDemand, value: "\(formatMoney(spent / 100)) \(Copy.spent)", resetsAt: resetsAt)
}

/// Credit left: prepaid grants plus any Stripe credit, less what the grants
/// have paid for.
public func cursorCredits(_ grants: CursorCreditGrants?, stripe: CursorStripe?) -> UsageExtra? {
  let total = grants?.hasCreditGrants == true ? max(0, cents(grants?.totalCents) ?? 0) : 0
  let used = grants?.hasCreditGrants == true ? max(0, cents(grants?.usedCents) ?? 0) : 0
  let held = stripe?.customerBalance.map { $0 < 0 ? -$0 : 0 } ?? 0
  let pool = total + held
  guard pool > 0 else { return nil }
  let left = max(0, pool - used)
  return UsageExtra(
    id: "credits", label: Copy.codexCredits, value: "\(formatMoney(left / 100)) \(Copy.left)",
    percentUsed: total > 0 ? clampPercent(used / pool * 100) : nil)
}

/// The Grok Bot allowance, unless the account has none of its own.
public func cursorGrokBot(_ status: CursorGrokBot?, fetchedAt: Date) -> UsageBucket? {
  guard let status, let percent = status.usagePercent, percent.isFinite,
    status.usesPooledEnterpriseAllowance != true, status.includedLimitZero != true,
    status.hasNonZeroIncludedLimit != false
  else { return nil }
  let resets = status.nextResetTimestampUtc.flatMap(looseDate)
  let start = status.currentPeriodStart.flatMap(looseDate)
  let length = resets.flatMap { end in start.map { end.timeIntervalSince($0) } }.flatMap { $0 > 0 ? $0 : nil }
  return UsageBucket(
    id: "grok-bot", label: Copy.cursorGrokBot, percentUsed: clampPercent(percent),
    resetsAt: status.nextResetTimestampUtc ?? isoString(fetchedAt), resetStyle: .absolute, windowSeconds: length)
}

/// Premium requests on a request-based plan, resetting a month after the
/// period began.
public func cursorRequestRow(_ usage: CursorRequests?, fetchedAt: Date) -> UsageBucket? {
  guard let model = usage?.gpt4, let max = model.maxRequestUsage, max > 0 else { return nil }
  let used = model.numRequests ?? 0
  let start = usage?.startOfMonth.flatMap(looseDate)
  let resets = start.flatMap { Calendar(identifier: .gregorian).date(byAdding: .month, value: 1, to: $0) } ?? fetchedAt
  return UsageBucket(
    id: "requests", label: "\(Copy.cursorRequests) · \(formatWhole(used))/\(formatWhole(max))",
    percentUsed: clampPercent(used / max * 100), resetsAt: isoString(resets), resetStyle: .absolute)
}

extension Copy {
  public static let cursorOnDemand = "On-demand"
  public static let cursorGrokBot = "Grok Bot"
  public static let cursorRequests = "Requests"
}

/// One page of Cursor's usage events. Money is in cents; times are epoch
/// milliseconds as text.
public struct CursorUsageEvents: Sendable, Codable, Equatable {
  public struct Event: Sendable, Codable, Equatable {
    public struct Tokens: Sendable, Codable, Equatable {
      @Lenient public var totalCents: Double?
    }
    @Lenient public var timestamp: NumberOrString?
    @Lenient public var tokenUsage: Tokens?
    @Lenient public var chargedCents: Double?
  }
  @Lenient public var totalUsageEventsCount: Double?
  @LossyArray public var usageEventsDisplay: [Event]?
}

/// Spend today and over the window, from Cursor's own events: the API-rate
/// cost of each request, summed per local day.
public func cursorSpend(_ events: [CursorUsageEvents.Event], now: Date, timeZone: TimeZone = .current) -> UsageExtra? {
  var days: [String: Double] = [:]
  for event in events {
    let cents = event.tokenUsage?.totalCents ?? event.chargedCents ?? 0
    guard cents > 0, let stamp = event.timestamp else { continue }
    let ms: Double?
    switch stamp {
    case .number(let value): ms = value
    case .string(let text): ms = Double(jsTrim(text))
    }
    guard let ms, let at = jsDate(milliseconds: ms) else { continue }
    days[dayKey(at, timeZone: timeZone), default: 0] += cents / 100
  }
  guard !days.isEmpty else { return nil }
  let totals = histogramTotalsOf(days, now: now, timeZone: timeZone)
  return UsageExtra(
    id: "spend", label: Copy.spendLabel,
    value: "\(Copy.tokensToday) \(formatMoney(totals.today)) · \(Copy.tokensMonth) \(formatMoney(totals.month))",
    note: Copy.estimated)
}

/// Today's and the window's sums of a day histogram.
func histogramTotalsOf(_ days: [String: Double], now: Date, timeZone: TimeZone) -> (today: Double, month: Double) {
  let today = dayKey(now, timeZone: timeZone)
  let floor = dayKey(startOfDay(now, daysAgo: TokenTuning.historyDays - 1, timeZone: timeZone), timeZone: timeZone)
  return (days[today] ?? 0, days.filter { $0.key >= floor && $0.key <= today }.values.reduce(0, +))
}

extension Copy {
  public static let spendLabel = "Spend"
  public static let estimated = "Estimated"
}
