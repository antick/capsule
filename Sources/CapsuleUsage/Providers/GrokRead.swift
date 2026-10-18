import CapsuleCore
import Foundation

public struct GrokUsageProvider: UsageProvider {
  public let id = ProviderId.grok
  public init() {}

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    let path = credentialPath(host, env: UsageEndpoints.Grok.homeEnv, UsageEndpoints.Grok.authPath)
    guard let raw = await host.readFile(path), let auth = grokAuthFromFile(raw, now: now) else {
      return unauthenticatedSnapshot(id, fetchedAt: now)
    }
    var headers = usageHeaders([
      "Authorization": "Bearer \(auth.token)",
      "X-XAI-Token-Auth": UsageEndpoints.Grok.tokenAuthValue,
    ])
    if let user = auth.userId { headers[UsageEndpoints.Grok.userIdHeader] = user }
    let response = try await host.send(HTTPRequest(url: UsageEndpoints.Grok.billingURL, headers: headers))
    if response.status == 401 || response.status == 403 { return unauthenticatedSnapshot(id, fetchedAt: now) }
    // Told to wait: say so, so the poller backs off rather than knocking
    // again next minute.
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapGrokCredits(try decode(GrokBillingPayload.self, response, id), fetchedAt: now)
  }
}
