import CapsuleCore
import Foundation

/// What Devin's seat service reports. Percentages are what is *left*;
/// resets are epoch seconds; the overage balance is in millionths of a dollar.
public struct DevinStatus: Sendable, Codable, Equatable {
  public struct PlanStatus: Sendable, Codable, Equatable {
    public struct PlanInfo: Sendable, Codable, Equatable {
      @Lenient public var planName: String?
      @Lenient public var hideDailyQuota: Bool?
    }
    @Lenient public var dailyQuotaRemainingPercent: Double?
    @Lenient public var weeklyQuotaRemainingPercent: Double?
    @Lenient public var dailyQuotaResetAtUnix: NumberOrString?
    @Lenient public var weeklyQuotaResetAtUnix: NumberOrString?
    @Lenient public var overageBalanceMicros: NumberOrString?
    @Lenient public var planInfo: PlanInfo?
  }
  public struct UserStatus: Sendable, Codable, Equatable {
    @Lenient public var planStatus: PlanStatus?
  }
  @Lenient public var userStatus: UserStatus?
}

private func number(_ value: NumberOrString?) -> Double? {
  switch value {
  case .number(let value): return value
  case .string(let text): return Double(jsTrim(text))
  case nil: return nil
  }
}

/// The daily and weekly quotas, and the overage balance.
public func mapDevin(_ payload: DevinStatus, now: Date) -> UsageSnapshot {
  let plan = payload.userStatus?.planStatus
  func window(_ id: String, _ label: String, left: Double?, resets: NumberOrString?, seconds: Double) -> UsageBucket? {
    let reset = number(resets).map { Date(timeIntervalSince1970: $0) }
    // A weekly reset with no figure means the week is used up.
    guard let used = left.map({ 100 - $0 }) ?? (reset != nil && id == "weekly" ? 100 : nil) else { return nil }
    return UsageBucket(
      id: id, label: label, percentUsed: clampPercent(used), resetsAt: isoString(reset ?? now),
      resetStyle: id == "daily" ? .relative : .absolute, windowSeconds: seconds)
  }
  var buckets: [UsageBucket] = []
  if plan?.planInfo?.hideDailyQuota != true,
    let daily = window(
      "daily", Copy.dailyWindow, left: plan?.dailyQuotaRemainingPercent, resets: plan?.dailyQuotaResetAtUnix,
      seconds: WindowLengths.day)
  {
    buckets.append(daily)
  }
  if let weekly = window(
    "weekly", Copy.weeklyWindow, left: plan?.weeklyQuotaRemainingPercent, resets: plan?.weeklyQuotaResetAtUnix,
    seconds: WindowLengths.week)
  {
    buckets.append(weekly)
  }
  let balance = number(plan?.overageBalanceMicros).map { $0 / DevinRules.microsPerDollar }
  let extras = balance.map { [UsageExtra(id: "overage", label: Copy.extraUsage, value: "\(formatMoney($0)) \(Copy.left)")] }
  return UsageSnapshot(
    providerId: .devin, displayName: ProviderLabels.label(.devin), iconId: .devin,
    primaryPercent: buckets.first?.percentUsed, buckets: buckets,
    status: buckets.isEmpty && extras == nil ? .error : .ok, fetchedAt: isoString(now), extras: extras)
}

public enum DevinRules {
  public static let microsPerDollar = 1_000_000.0
}

/// A Windsurf API key and the server to ask, from wherever Devin left one.
struct DevinLogin {
  var key: String
  var server: String
}

/// Devin's desktop app first, then its CLI's file, then a key from Settings.
func devinLogins(_ host: UsageHost) async -> [DevinLogin] {
  var found: [DevinLogin] = []
  let rows = await host.query(
    joinPath(host.homeDir, UsageEndpoints.Devin.stateDatabasePath), UsageEndpoints.Devin.authSQL)
  if let raw = rows.first?.first, let key = JSONValue.parse(raw)?["apiKey"]?.asString, !key.isEmpty {
    found.append(DevinLogin(key: key, server: UsageEndpoints.Devin.defaultServer))
  }
  if let toml = await host.readFile(joinPath(host.homeDir, UsageEndpoints.Devin.credentialsPath)) {
    func value(_ name: String) -> String? {
      for line in toml.split(separator: "\n") {
        let parts = line.split(separator: "=", maxSplits: 1).map { jsTrim(String($0)) }
        if parts.count == 2, parts[0] == name { return parts[1].trimmingCharacters(in: CharacterSet(charactersIn: "\"'")) }
      }
      return nil
    }
    if let key = value("windsurf_api_key"), !key.isEmpty {
      found.append(DevinLogin(key: key, server: value("api_server_url") ?? UsageEndpoints.Devin.defaultServer))
    }
  }
  if let pasted = await host.storedKey(.devin) {
    found.append(DevinLogin(key: pasted, server: UsageEndpoints.Devin.defaultServer))
  }
  return found.reduce(into: []) { kept, next in if !kept.contains(where: { $0.key == next.key }) { kept.append(next) } }
}

public struct DevinUsageProvider: UsageProvider {
  public let id = ProviderId.devin
  public init() {}

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    let version = UsageEndpoints.Devin.clientVersion
    for login in await devinLogins(host) {
      let body = jsonBody([
        "metadata": [
          "apiKey": login.key, "ideName": "devin", "ideVersion": version, "extensionName": "devin",
          "extensionVersion": version, "locale": "en",
        ]
      ])
      let response = try await host.send(
        HTTPRequest(
          method: "POST", url: login.server + UsageEndpoints.Devin.statusPath,
          headers: usageHeaders([
            "Content-Type": "application/json",
            UsageEndpoints.Cursor.connectProtocolHeader: UsageEndpoints.Cursor.connectProtocolVersion,
          ]), body: body))
      // A rejected key is dead; the next one may not be.
      if response.status == 401 || response.status == 403 { continue }
      if response.status == 429 { throw rateLimited(response, now: now) }
      guard response.ok else { throw UsageReadError.http(id, response.status) }
      return mapDevin(try decode(DevinStatus.self, response, id), now: now)
    }
    return unauthenticatedSnapshot(id, fetchedAt: now)
  }
}
