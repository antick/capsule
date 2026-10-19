import Foundation

/// An amount in a provider's currency, the way the cards write it:
/// "$12.40", "€3.00". The only place money is formatted.
public func formatMoney(_ amount: Double, currency: String = MoneyDefaults.currency) -> String {
  let formatter = NumberFormatter()
  formatter.numberStyle = .currency
  formatter.locale = MoneyDefaults.locale
  let code = jsTrim(currency).uppercased()
  formatter.currencyCode = code.isEmpty ? MoneyDefaults.currency : code
  formatter.minimumFractionDigits = 2
  formatter.maximumFractionDigits = 2
  return formatter.string(from: NSNumber(value: amount)) ?? "\(code) \(amount)"
}

/// A whole count with grouping: "1,250".
public func formatWhole(_ value: Double) -> String {
  let formatter = NumberFormatter()
  formatter.numberStyle = .decimal
  formatter.locale = MoneyDefaults.locale
  formatter.maximumFractionDigits = 0
  return formatter.string(from: NSNumber(value: value.rounded(.down))) ?? "\(Int(value))"
}

public enum MoneyDefaults {
  public static let currency = "USD"
  public static let locale = Locale(identifier: "en_US")
}

/// Midnight UTC on the first of the month after `date`: when a monthly
/// allowance that names no reset of its own starts again.
public func startOfNextMonthUTC(after date: Date) -> Date {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(identifier: "UTC")!
  let month = calendar.dateComponents([.year, .month], from: date)
  let start = calendar.date(from: month) ?? date
  return calendar.date(byAdding: .month, value: 1, to: start) ?? date
}

/// Something on a card that is not a percentage window: money spent
/// against a cap, a balance, credits. Drawn in a window's shape, with a bar
/// only when there is a share to show.
public struct UsageExtra: Sendable, Codable, Equatable {
  public var id: String
  public var label: String
  /// The amount, written out: "$12.40 of $50.00", "821 credits".
  public var value: String
  /// The share used, when the amount has a ceiling.
  public var percentUsed: Double?
  /// When it starts again or runs out, ISO.
  public var resetsAt: String?
  /// A short note opposite the label when there is no reset to show.
  public var note: String?

  public init(
    id: String, label: String, value: String, percentUsed: Double? = nil, resetsAt: String? = nil, note: String? = nil
  ) {
    self.id = id
    self.label = label
    self.value = value
    self.percentUsed = percentUsed
    self.resetsAt = resetsAt
    self.note = note
  }
}

extension Copy {
  public static let extraUsage = "Extra usage"
  public static let codexCredits = "Credits"
  public static let unlimited = "Unlimited"
  public static let spent = "spent"
  public static let of = "of"
  public static let left = "left"
  public static let credits = "credits"
  public static let atLeast = "≥"
  public static let tokensAndSpend = "Tokens and spend"
  public static let spendHint =
    "Estimated from the local logs at list price; not a bill. ≥ means some models had no known price."
}
