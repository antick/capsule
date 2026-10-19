import CapsuleCore
import Foundation

/// Antigravity's quota summary: groups of models (Gemini, Claude and GPT),
/// each with windows reporting the share *left*.
public struct AntigravityQuota: Sendable, Codable, Equatable {
  public struct Bucket: Sendable, Codable, Equatable {
    public struct Remaining: Sendable, Codable, Equatable {
      @Lenient public var remainingFraction: Double?
    }
    @Lenient public var bucketId: String?
    @Lenient public var displayName: String?
    @Lenient public var remainingFraction: Double?
    @Lenient public var remaining: Remaining?
    @Lenient public var resetTime: String?
    @Lenient public var window: String?
    @Lenient public var disabled: Bool?
  }
  public struct Group: Sendable, Codable, Equatable {
    @Lenient public var displayName: String?
    @LossyArray public var buckets: [Bucket]?
  }
  @LossyArray public var groups: [Group]?
  /// The language server wraps the same summary in `response`.
  @Lenient public var response: Inner?

  public struct Inner: Sendable, Codable, Equatable {
    @LossyArray public var groups: [Group]?
  }

  var allGroups: [Group] { groups ?? response?.groups ?? [] }
}

/// Each window as used share; a window with no figure is left out rather
/// than shown as full or empty.
public func mapAntigravity(_ payload: AntigravityQuota, now: Date) -> UsageSnapshot {
  var buckets: [UsageBucket] = []
  for group in payload.allGroups {
    for bucket in group.buckets ?? [] where bucket.disabled != true {
      guard let left = bucket.remainingFraction ?? bucket.remaining?.remainingFraction, left.isFinite else { continue }
      let id = bucket.bucketId ?? "\(group.displayName ?? "")-\(bucket.window ?? "")"
      let weekly = bucket.window == "weekly" || id.hasSuffix("weekly")
      let short = id.hasSuffix("5h")
      let window = weekly ? Copy.weeklyWindow : short ? Copy.fiveHourWindow : bucket.displayName ?? ""
      let family = group.displayName.map(antigravityFamily) ?? ""
      guard !buckets.contains(where: { $0.id == id }) else { continue }
      buckets.append(
        UsageBucket(
          id: id, label: [family, window].filter { !$0.isEmpty }.joined(separator: Copy.accountLabelSeparator),
          percentUsed: clampPercent((1 - min(1, max(0, left))) * 100),
          resetsAt: bucket.resetTime ?? isoString(now), resetStyle: short ? .relative : .absolute,
          windowSeconds: weekly ? WindowLengths.week : short ? WindowLengths.fiveHours : nil))
    }
  }
  return UsageSnapshot(
    providerId: .antigravity, displayName: ProviderLabels.label(.antigravity), iconId: .antigravity,
    primaryPercent: buckets.map(\.percentUsed).max(), buckets: Array(buckets.prefix(HudLimits.maxCardBuckets + 1)),
    status: buckets.isEmpty ? .error : .ok, fetchedAt: isoString(now))
}

/// "Gemini Models" → "Gemini", "Claude and GPT models" → "Claude and GPT".
func antigravityFamily(_ name: String) -> String {
  name.replacingOccurrences(of: " models", with: "", options: .caseInsensitive)
}

public struct AntigravityUsageProvider: UsageProvider {
  public let id = ProviderId.antigravity
  public init() {}

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    if let local = await fromLanguageServer(host) { return mapAntigravity(local, now: now) }
    guard let token = await googleToken(host, now: now) else { return unauthenticatedSnapshot(id, fetchedAt: now) }
    let response = try await host.send(
      HTTPRequest(
        method: "POST", url: UsageEndpoints.Antigravity.cloudURL,
        headers: usageHeaders([
          "Authorization": "Bearer \(token)", "Content-Type": "application/json",
          "User-Agent": UsageEndpoints.Antigravity.userAgent,
        ]), body: "{}"))
    if response.status == 401 || response.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapAntigravity(try decode(AntigravityQuota.self, response, id), now: now)
  }

  /// The running app's language server, found by its process and ports,
  /// asked on loopback with its own CSRF token.
  private func fromLanguageServer(_ host: UsageHost) async -> AntigravityQuota? {
    let rules = UsageEndpoints.Antigravity.self
    for process in await host.processes() {
      let words = process.command.split(separator: " ").map(String.init)
      guard let program = words.first.map({ ($0 as NSString).lastPathComponent }),
        rules.processNames.contains(program),
        rules.processMarkers.contains(where: process.command.lowercased().contains),
        let flag = words.firstIndex(of: "--csrf_token"), flag + 1 < words.count
      else { continue }
      let csrf = words[flag + 1]
      let body = jsonBody([
        "metadata": ["ideName": "antigravity", "extensionName": "antigravity", "ideVersion": "unknown", "locale": "en"]
      ])
      for port in await host.listeningPorts(process.pid) {
        for scheme in ["https", "http"] {
          let request = HTTPRequest(
            method: "POST", url: "\(scheme)://127.0.0.1:\(port)\(rules.servicePath)\(rules.quotaMethod)",
            headers: [
              "Content-Type": "application/json",
              UsageEndpoints.Cursor.connectProtocolHeader: UsageEndpoints.Cursor.connectProtocolVersion,
              rules.csrfHeader: csrf,
            ], body: body, loopbackSelfSigned: true)
          guard let response = try? await host.send(request), response.ok,
            let quota = try? JSONDecoder().decode(AntigravityQuota.self, from: response.body), !quota.allGroups.isEmpty
          else { continue }
          return quota
        }
      }
    }
    return nil
  }

  /// The saved Google login's token while it is still valid. An expired one
  /// is not refreshed: that would take Antigravity's own OAuth client, so
  /// the language server is the source once the saved login runs out.
  private func googleToken(_ host: UsageHost, now: Date) async -> String? {
    let rules = UsageEndpoints.Antigravity.self
    guard var raw = await host.readSecret(rules.keychainService, account: rules.keychainAccount) else { return nil }
    if raw.hasPrefix(rules.keychainPrefix),
      let data = Data(base64Encoded: String(raw.dropFirst(rules.keychainPrefix.count)))
    {
      raw = String(decoding: data, as: UTF8.self)
    }
    guard let json = JSONValue.parse(raw) else { return nil }
    let token = json["token"] ?? json
    guard let access = token["access_token"]?.asString, let expiry = token["expiry"]?.asString.flatMap(looseDate),
      expiry.timeIntervalSince(now) > AntigravityRules.expirySlackSeconds
    else { return nil }
    return access
  }
}

public enum AntigravityRules {
  public static let expirySlackSeconds = 60.0
}
