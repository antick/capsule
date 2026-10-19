import CapsuleCore
import Foundation

private struct CodexAuth {
  var accessToken: String?
  var refreshToken: String?
  var accountId: String?
}

private func codexAuth(_ raw: String?) -> CodexAuth {
  guard let raw, let json = JSONValue.parse(raw) else { return CodexAuth() }
  func field(_ name: String) -> String? {
    json["tokens"]?[name]?.asString ?? json[name]?.asString
  }
  return CodexAuth(
    accessToken: field("access_token"), refreshToken: field("refresh_token"),
    accountId: field("account_id")
  )
}

public struct CodexUsageProvider: UsageProvider {
  public let id = ProviderId.codex
  public let meter: MeterId
  /// An added account's `CODEX_HOME`, or nil for the default sign-in.
  private let codexHome: String?

  public init() {
    meter = MeterId(.codex)
    codexHome = nil
  }

  /// Reads an added account, and only it: never the default sign-in in its place.
  public init(account: UsageAccount) {
    meter = account.meter
    codexHome = account.path
  }

  private func usage(_ host: UsageHost, token: String, account: String?, url: String) async throws
    -> HTTPResponse
  {
    var headers = usageHeaders(["Authorization": "Bearer \(token)"])
    if let account, !account.isEmpty { headers["ChatGPT-Account-Id"] = account }
    return try await host.send(HTTPRequest(url: url, headers: headers))
  }

  private func refresh(_ host: UsageHost, _ refreshToken: String) async throws -> String? {
    let response = try await host.send(
      HTTPRequest(
        method: "POST",
        url: UsageEndpoints.Codex.tokenURL,
        headers: usageHeaders(["Content-Type": "application/x-www-form-urlencoded"]),
        body: formURLEncoded([
          ("grant_type", "refresh_token"),
          ("refresh_token", refreshToken),
          ("client_id", UsageEndpoints.Codex.clientId),
        ])
      )
    )
    guard response.ok else { return nil }
    // A 200 that is not JSON fails the read, as the original's json() does,
    // rather than passing for "no token".
    guard let payload = JSONValue.parse(String(decoding: response.body, as: UTF8.self)) else {
      throw UsageReadError.unreadable(id)
    }
    return payload["access_token"]?.asString
  }

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    let path =
      codexHome.map { joinPath(AccountPaths.resolve($0, home: host.homeDir), [UsageEndpoints.Codex.authFile]) }
      ?? credentialPath(host, env: UsageEndpoints.Codex.homeEnv, UsageEndpoints.Codex.authPath)
    let auth = codexAuth(await host.readFile(path))
    var token = auth.accessToken.flatMap { $0.isEmpty ? nil : $0 }
    if token == nil, let refreshToken = auth.refreshToken, !refreshToken.isEmpty {
      token = try await refresh(host, refreshToken)
    }
    guard let first = token, !first.isEmpty else { return unauthenticatedSnapshot(id, fetchedAt: now) }
    token = first

    var response = try await usage(host, token: first, account: auth.accountId, url: UsageEndpoints.Codex.usageURL)
    if response.status == 401, let refreshToken = auth.refreshToken, !refreshToken.isEmpty,
      let refreshed = try await refresh(host, refreshToken), !refreshed.isEmpty
    {
      token = refreshed
      response = try await usage(host, token: refreshed, account: auth.accountId, url: UsageEndpoints.Codex.usageURL)
    }
    if response.status == 404 {
      response = try await usage(
        host, token: token ?? first, account: auth.accountId, url: UsageEndpoints.Codex.fallbackURL
      )
    }
    if response.status == 401 || response.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapCodexUsage(try decode(CodexUsagePayload.self, response, id), fetchedAt: now)
  }
}
