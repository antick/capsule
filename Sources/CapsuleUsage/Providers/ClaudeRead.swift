import CapsuleCore
import CryptoKit
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

/// The keychain service Claude Code keeps a `CLAUDE_CONFIG_DIR` account's
/// sign-in under: the usual name, a dash, and the start of the folder path's
/// SHA-256 in hex.
public func claudeKeychainService(configDir: String) -> String {
  let digest = SHA256.hash(data: Data(configDir.precomposedStringWithCanonicalMapping.utf8))
  let hex = digest.map { String(format: "%02x", $0) }.joined()
  return "\(UsageEndpoints.Claude.keychainService)-\(hex.prefix(UsageEndpoints.Claude.keychainHashLength))"
}

/// Where one Claude sign-in lives: the default one under home, or an account
/// in its own config folder.
struct ClaudeLocation: Sendable {
  var keychainServices: [String]
  var credentialsFile: String
  var cacheFile: String

  init(host: UsageHost, configDir: String?) {
    guard let configDir else {
      keychainServices = [UsageEndpoints.Claude.keychainService]
      credentialsFile = joinPath(host.homeDir, UsageEndpoints.Claude.credentialsPath)
      cacheFile = joinPath(host.homeDir, [UsageEndpoints.Claude.usageCacheFile])
      return
    }
    let folder = AccountPaths.resolve(configDir, home: host.homeDir)
    // Claude Code hashes the folder as the variable named it, so the form
    // typed with a trailing slash is tried too.
    keychainServices = [folder, folder + "/"].map(claudeKeychainService(configDir:))
    credentialsFile = joinPath(folder, [UsageEndpoints.Claude.credentialsFile])
    cacheFile = joinPath(folder, [UsageEndpoints.Claude.usageCacheFile])
  }
}

/// The usage Claude Code cached locally, if any of its windows still runs.
private func cachedClaudeSnapshot(_ host: UsageHost, _ location: ClaudeLocation, now: Date) async -> UsageSnapshot? {
  guard let raw = await host.readFile(location.cacheFile),
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
  public let meter: MeterId
  /// An added account's `CLAUDE_CONFIG_DIR`, or nil for the default sign-in.
  private let configDir: String?

  public init() {
    meter = MeterId(.claude)
    configDir = nil
  }

  /// Reads an added account, and only it: never the default sign-in in its place.
  public init(account: UsageAccount) {
    meter = account.meter
    configDir = account.path
  }

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    let location = ClaudeLocation(host: host, configDir: configDir)
    let file = await host.readFile(location.credentialsFile)
    var found: [String?] = []
    for service in location.keychainServices { found.append(claudeToken(await host.readSecret(service))) }
    found.append(claudeToken(file))
    var tokens: [String] = []
    for token in found {
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
          var snapshot = mapClaudeUsage(try decode(ClaudeUsagePayload.self, response, id), fetchedAt: now)
          // The Console's API credit belongs to the account behind the
          // pasted session, shown on the default sign-in's card.
          if configDir == nil, let credit = await claudeConsoleMemo.value(host, now: now) {
            snapshot.extras = (snapshot.extras ?? []) + [credit]
          }
          return snapshot
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

    let cached = await cachedClaudeSnapshot(host, location, now: now)
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
