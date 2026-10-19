import CapsuleCore
import Foundation

/// A key from Settings, else the provider's own environment variable.
func providerKey(_ host: UsageHost, _ key: StoredKey, env: String) async -> String? {
  if let saved = await host.storedKey(key), !saved.isEmpty { return saved }
  return host.environment(env).map(jsTrim).flatMap { $0.isEmpty ? nil : $0 }
}

/// A reading made only of amounts: balances and spend, with no windows.
func amountsSnapshot(_ id: ProviderId, _ extras: [UsageExtra], primary: Double?, now: Date) -> UsageSnapshot {
  UsageSnapshot(
    providerId: id, displayName: ProviderLabels.label(id), iconId: id, primaryPercent: primary, buckets: [],
    status: extras.isEmpty ? .error : .ok, fetchedAt: isoString(now), extras: extras)
}

// MARK: OpenRouter

public struct OpenRouterCredits: Sendable, Codable, Equatable {
  public struct Data: Sendable, Codable, Equatable {
    @Lenient public var total_credits: Double?
    @Lenient public var total_usage: Double?
  }
  @Lenient public var data: Data?
}

public struct OpenRouterKey: Sendable, Codable, Equatable {
  public struct Data: Sendable, Codable, Equatable {
    @Lenient public var limit: Double?
    @Lenient public var limit_remaining: Double?
    @Lenient public var usage_daily: Double?
    @Lenient public var usage_weekly: Double?
    @Lenient public var usage_monthly: Double?
  }
  @Lenient public var data: Data?
}

/// The balance left of what was bought, the key's spending cap if it has
/// one, and its spend by day, week and month. Amounts are dollars.
public func mapOpenRouter(_ credits: OpenRouterCredits?, _ key: OpenRouterKey?, now: Date) -> UsageSnapshot {
  var extras: [UsageExtra] = []
  var primary: Double?
  if let total = credits?.data?.total_credits, total > 0 {
    let used = max(0, credits?.data?.total_usage ?? 0)
    primary = clampPercent(used / total * 100)
    extras.append(
      UsageExtra(
        id: "balance", label: Copy.balance,
        value: "\(formatMoney(max(0, total - used))) \(Copy.left) \(Copy.of) \(formatMoney(total))", percentUsed: primary))
  }
  if let limit = key?.data?.limit, limit > 0 {
    let used = max(0, limit - (key?.data?.limit_remaining ?? limit))
    extras.append(
      UsageExtra(
        id: "key-limit", label: Copy.keyLimit, value: "\(formatMoney(used)) \(Copy.of) \(formatMoney(limit))",
        percentUsed: clampPercent(used / limit * 100)))
  }
  if let data = key?.data, data.usage_daily != nil || data.usage_monthly != nil {
    extras.append(
      UsageExtra(
        id: "spend", label: Copy.spendLabel,
        value: "\(Copy.tokensToday) \(formatMoney(data.usage_daily ?? 0)) · \(Copy.week) \(formatMoney(data.usage_weekly ?? 0)) · \(Copy.month) \(formatMoney(data.usage_monthly ?? 0))"))
  }
  return amountsSnapshot(.openrouter, extras, primary: primary, now: now)
}

public struct OpenRouterUsageProvider: UsageProvider {
  public let id = ProviderId.openrouter
  public init() {}

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    guard let key = await providerKey(host, .openrouter, env: UsageEndpoints.OpenRouter.keyEnv) else {
      return unauthenticatedSnapshot(id, fetchedAt: now)
    }
    let headers = usageHeaders(["Authorization": "Bearer \(key)"])
    let credits = try await host.send(HTTPRequest(url: UsageEndpoints.OpenRouter.creditsURL, headers: headers))
    if credits.status == 401 || credits.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if credits.status == 429 { throw rateLimited(credits, now: now) }
    guard credits.ok else { throw UsageReadError.http(id, credits.status) }
    // The key's own figures are a bonus; the balance stands without them.
    let keyInfo = try? await host.send(HTTPRequest(url: UsageEndpoints.OpenRouter.keyURL, headers: headers))
    return mapOpenRouter(
      try decode(OpenRouterCredits.self, credits, id),
      keyInfo.flatMap { $0.ok ? try? decode(OpenRouterKey.self, $0, id) : nil }, now: now)
  }
}

// MARK: DeepSeek

public struct DeepSeekBalance: Sendable, Codable, Equatable {
  public struct Info: Sendable, Codable, Equatable {
    @Lenient public var currency: String?
    @Lenient public var total_balance: NumberOrString?
    @Lenient public var granted_balance: NumberOrString?
    @Lenient public var topped_up_balance: NumberOrString?
  }
  @Lenient public var is_available: Bool?
  @LossyArray public var balance_infos: [Info]?
}

private func amount(_ value: NumberOrString?) -> Double? {
  switch value {
  case .number(let number): return number
  case .string(let text): return Double(jsTrim(text))
  case nil: return nil
  }
}

/// The balance, in dollars when there is a dollar wallet, split into what
/// was paid for and what was granted.
public func mapDeepSeek(_ payload: DeepSeekBalance, now: Date) -> UsageSnapshot {
  let infos = payload.balance_infos ?? []
  guard let info = infos.first(where: { $0.currency?.uppercased() == MoneyDefaults.currency }) ?? infos.first,
    let total = amount(info.total_balance)
  else { return amountsSnapshot(.deepseek, [], primary: nil, now: now) }
  let currency = info.currency ?? MoneyDefaults.currency
  let paid = amount(info.topped_up_balance) ?? 0
  let granted = amount(info.granted_balance) ?? 0
  let note = total <= 0 ? Copy.addCredits : payload.is_available == false ? Copy.unavailableForCalls : nil
  return amountsSnapshot(
    .deepseek,
    [
      UsageExtra(
        id: "balance", label: Copy.balance,
        value:
          "\(formatMoney(total, currency: currency)) (\(Copy.paid) \(formatMoney(paid, currency: currency)) · \(Copy.granted) \(formatMoney(granted, currency: currency)))",
        note: note)
    ], primary: nil, now: now)
}

public struct DeepSeekUsageProvider: UsageProvider {
  public let id = ProviderId.deepseek
  public init() {}

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    guard let key = await providerKey(host, .deepseek, env: UsageEndpoints.DeepSeek.keyEnv) else {
      return unauthenticatedSnapshot(id, fetchedAt: now)
    }
    let response = try await host.send(
      HTTPRequest(url: UsageEndpoints.DeepSeek.balanceURL, headers: usageHeaders(["Authorization": "Bearer \(key)"])))
    if response.status == 401 || response.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapDeepSeek(try decode(DeepSeekBalance.self, response, id), now: now)
  }
}

extension Copy {
  public static let balance = "Balance"
  public static let keyLimit = "Key limit"
  public static let week = "Week"
  public static let month = "Month"
  public static let paid = "paid"
  public static let granted = "granted"
  public static let addCredits = "Add credits to use the API"
  public static let unavailableForCalls = "Not available for API calls"
}
