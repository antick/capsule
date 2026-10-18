import CapsuleCore
import Foundation

/// The OAuth token in a credentials file or keychain item: JSON as Claude Code
/// writes it, or failing that the raw text, if it is long enough to be one.
func claudeToken(_ raw: String?) -> String? {
  guard let raw else { return nil }
  if let json = JSONValue.parse(raw) {
    return json["claudeAiOauth"]?["accessToken"]?.asString ?? json["accessToken"]?.asString
  }
  let trimmed = jsTrim(raw)
  return trimmed.utf16.count > 20 ? trimmed : nil
}

/// The usage Claude Code cached locally, if any of its windows still runs.
private func cachedClaudeSnapshot(_ host: UsageHost, now: Date) async -> UsageSnapshot? {
  guard let raw = await host.readFile(joinPath(host.homeDir, [UsageEndpoints.Claude.usageCacheFile])),
    let payload = claudeUsageFromCache(raw)
  else { return nil }
  // A cache whose windows have all rolled over says nothing about today.
  guard claudeWindowIsCurrent(payload.five_hour, now: now)
    || claudeWindowIsCurrent(payload.seven_day, now: now)
  else { return nil }
  var snapshot = mapClaudeUsage(payload, fetchedAt: now)
  // A cached window with no utilization in it is no reading to remember.
  guard !snapshot.buckets.isEmpty else { return nil }
  snapshot.status = .stale
  return snapshot
}

public struct ClaudeUsageProvider: UsageProvider {
  public let id = ProviderId.claude
  public init() {}

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    let file = await host.readFile(joinPath(host.homeDir, UsageEndpoints.Claude.credentialsPath))
    var tokens: [String] = []
    for token in [
      claudeToken(await host.readSecret(UsageEndpoints.Claude.keychainService)),
      claudeToken(file),
    ] {
      // The same token in both places is sent once.
      if let token, !tokens.contains(token) { tokens.append(token) }
    }

    var lastError: Error?
    var refused: RateLimited?
    for token in tokens {
      do {
        let response = try await host.send(
          HTTPRequest(
            url: UsageEndpoints.Claude.usageURL,
            headers: usageHeaders([
              "Authorization": "Bearer \(token)",
              "anthropic-beta": UsageEndpoints.Claude.betaHeader,
            ])
          )
        )
        if response.ok {
          return mapClaudeUsage(try decode(ClaudeUsagePayload.self, response, id), fetchedAt: now)
        }
        if response.status == 429 {
          refused = rateLimited(response, now: now)
          break
        }
        // A rejected credential is dead; the next one may not be.
        if response.status != 401 && response.status != 403 {
          lastError = UsageReadError.http(id, response.status)
          break
        }
      } catch {
        lastError = error
        break
      }
    }

    let cached = await cachedClaudeSnapshot(host, now: now)
    // Told to wait: say so, so the poller backs off instead of knocking again
    // next minute. The local cache rides along for it to show meanwhile.
    if let refused {
      throw RateLimited(retryAfterMs: refused.retryAfterMs, fallback: cached)
    }
    if let cached {
      // The live read failed, so say why: the cache would otherwise hide it.
      let reason =
        tokens.isEmpty
        ? "no token in the keychain or the credentials file"
        : lastError.map { "\($0)" } ?? "every token was rejected"
      UsageLog.poller.notice("claude showing its cached reading: \(reason, privacy: .public)")
      return cached
    }
    if let lastError { throw lastError }
    return unauthenticatedSnapshot(id, fetchedAt: now)
  }
}
