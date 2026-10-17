import CapsuleCore
import Foundation

public struct GrokPeriod: Sendable, Codable, Equatable {
  public var type: String?
  public var start: String?
  public var end: String?
}

public struct GrokAmount: Sendable, Codable, Equatable {
  public var val: NumberOrString?
}

public struct GrokProductUsage: Sendable, Codable, Equatable {
  public var product: String?
  public var usagePercent: Double?
}

public struct GrokCreditsConfig: Sendable, Codable, Equatable {
  public var creditUsagePercent: Double?
  public var currentPeriod: GrokPeriod?
  public var billingPeriodEnd: String?
  public var onDemandCap: GrokAmount?
  public var onDemandUsed: GrokAmount?
  public var productUsage: [GrokProductUsage]?
}

public struct GrokBillingPayload: Sendable, Codable, Equatable {
  public var config: GrokCreditsConfig?
  public var creditUsagePercent: Double?
}

// MARK: - Credits

private func amountValue(_ amount: GrokAmount?) -> Double? {
  guard let value = amount?.val?.asDouble, value.isFinite else { return nil }
  return value
}

/// `PRODUCT_GROK_BUILD` reads as "Grok Build"; anything else is title-cased
/// from whatever xAI called it.
public func grokProductLabel(_ product: String?) -> String {
  guard let product, !product.isEmpty else { return Copy.grokBuild }
  var normalized = product
  for prefix in ["PRODUCT_", "product_"] where normalized.hasPrefix(prefix) {
    normalized.removeFirst(prefix.count)
  }
  normalized = normalized.replacingOccurrences(of: "_", with: " ")
  if normalized.lowercased().contains("build") { return Copy.grokBuild }
  return normalized
    .split(separator: " ", omittingEmptySubsequences: false)
    .map { word in
      guard let first = word.first else { return "" }
      return String(first).uppercased() + word.dropFirst()
    }
    .joined(separator: " ")
}

public func mapGrokCredits(
  _ payload: GrokBillingPayload,
  fetchedAt: Date
) -> UsageSnapshot {
  let config = payload.config
  let credits = config?.creditUsagePercent ?? payload.creditUsagePercent
  // No credit percent is not zero credits used: a bill xAI did not report has
  // no bar to draw, and drawing it at 0% invents a reading.
  let weeklyPercent: Double? =
    (credits?.isFinite == true) ? toPercent(credits) : nil

  let resetsAt = resetIso(
    (config?.currentPeriod?.end ?? config?.billingPeriodEnd)
      .map(NumberOrString.string),
    fallback: fetchedAt
  )

  var buckets: [UsageBucket] = []
  if let weeklyPercent {
    buckets.append(
      UsageBucket(
        id: "weekly", label: Copy.grokWeekly, percentUsed: weeklyPercent,
        resetsAt: resetsAt, resetStyle: .absolute
      )
    )
  }

  let products = (config?.productUsage ?? []).filter {
    $0.usagePercent?.isFinite == true
  }
  let build = products.first { ($0.product ?? "").lowercased().contains("build") }
  let extra = build ?? products.first

  // xAI reports the headline credit percent again as a product row; skip the
  // echo. With no headline there is nothing to echo, so the row stays.
  if let extra, let percent = extra.usagePercent,
    toPercent(percent) != weeklyPercent
  {
    buckets.append(
      UsageBucket(
        id: "product", label: grokProductLabel(extra.product),
        percentUsed: toPercent(percent), resetsAt: resetsAt,
        resetStyle: .absolute
      )
    )
  } else if let cap = amountValue(config?.onDemandCap), cap > 0,
    let used = amountValue(config?.onDemandUsed)
  {
    buckets.append(
      UsageBucket(
        id: "on-demand", label: Copy.grokOnDemand,
        percentUsed: toPercent((used / cap) * 100), resetsAt: resetsAt,
        resetStyle: .absolute
      )
    )
  }

  return UsageSnapshot(
    providerId: .grok,
    displayName: ProviderLabels.label(.grok),
    iconId: .grok,
    primaryPercent: buckets.first?.percentUsed,
    buckets: buckets,
    // A 200 carrying no percentage told us nothing. Calling that "ok" would
    // publish the nothing over the last good numbers; "error" keeps them.
    status: buckets.isEmpty ? .error : .ok,
    fetchedAt: isoString(fetchedAt)
  )
}

// MARK: - Auth

public struct GrokAuth: Sendable, Equatable {
  public let token: String
  public let userId: String?
}

private struct GrokCandidate {
  let token: String
  let expired: Bool
  let userId: String?
}

private func isLikelyJwt(_ value: String) -> Bool {
  value.hasPrefix("eyJ") && value.split(separator: ".").count >= 3
}

/// Whether the entry says it has already lapsed.
///
/// This reads the wall clock, exactly as the original does, so it is not a
/// pure function of its input. It only ever decides *preference* between
/// several tokens — an expired token is still returned when it is the only
/// one — so the outcome stays stable for a file with a single entry.
private func isExpired(_ record: [String: JSONValue], now: Date) -> Bool {
  let raw =
    record["expires_at"] ?? record["expiresAt"] ?? record["expires"]
  let cutoff = now.addingTimeInterval(-30).timeIntervalSince1970
  switch raw {
  case .number(let value):
    let seconds = value < 1e12 ? value : value / 1000
    return seconds > 0 && seconds < cutoff
  case .string(let value) where !value.isEmpty:
    guard let parsed = looseDate(value) else { return false }
    return parsed.timeIntervalSince1970 < cutoff
  default:
    return false
  }
}

private let tokenKeys = ["key", "access_token", "accessToken"]

private func readUserId(_ record: [String: JSONValue]) -> String? {
  for key in ["user_id", "userId", "principal_id", "sub"] {
    if let value = record[key]?.asString, !value.isEmpty { return value }
  }
  return nil
}

private func collect(
  _ value: JSONValue, into found: inout [GrokCandidate], now: Date
) {
  switch value {
  case .array(let items):
    for item in items { collect(item, into: &found, now: now) }
  case .object(let record):
    let expired = isExpired(record, now: now)
    let userId = readUserId(record)
    for key in tokenKeys {
      if let token = record[key]?.asString, isLikelyJwt(token) {
        found.append(
          GrokCandidate(token: token, expired: expired, userId: userId)
        )
      }
    }
    for (key, nested) in record.sorted(by: { $0.key < $1.key })
    where !tokenKeys.contains(key) {
      collect(nested, into: &found, now: now)
    }
  default:
    break
  }
}

public func grokAuthFromFile(_ raw: String, now: Date = Date()) -> GrokAuth? {
  guard let parsed = JSONValue.parse(raw) else {
    let token = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return isLikelyJwt(token) ? GrokAuth(token: token, userId: nil) : nil
  }
  var found: [GrokCandidate] = []
  collect(parsed, into: &found, now: now)
  guard let preferred = found.first(where: { !$0.expired }) ?? found.first
  else { return nil }
  return GrokAuth(token: preferred.token, userId: preferred.userId)
}

public func grokTokenFromFile(_ raw: String, now: Date = Date()) -> String? {
  grokAuthFromFile(raw, now: now)?.token
}
