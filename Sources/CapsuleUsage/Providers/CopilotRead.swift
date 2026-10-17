import CapsuleCore
import Foundation

public struct CopilotUsageProvider: UsageProvider {
  public let id = ProviderId.copilot
  public init() {}

  /// Whatever GitHub login this Mac already has, in the order a developer
  /// would expect: an explicit token, the gh CLI's, then Copilot's own.
  private func githubToken(_ host: UsageHost) async -> String? {
    if let fromEnv = host.environment(UsageEndpoints.Copilot.tokenEnv).map(jsTrim), !fromEnv.isEmpty {
      return fromEnv
    }
    if let fromCli = await host.runCommand(
      UsageEndpoints.Copilot.ghCommand, UsageEndpoints.Copilot.ghTokenArguments
    ).map(jsTrim), !fromCli.isEmpty {
      return fromCli
    }
    guard let apps = await host.readFile(joinPath(host.homeDir, UsageEndpoints.Copilot.appsPath)) else {
      return nil
    }
    return copilotTokenFromApps(apps)
  }

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    guard let token = await githubToken(host) else { return unauthenticatedSnapshot(id, fetchedAt: now) }
    let response = try await host.send(
      HTTPRequest(url: UsageEndpoints.Copilot.usageURL, headers: usageHeaders(["Authorization": "token \(token)"]))
    )
    // 404 is GitHub's way of saying this account has no Copilot at all.
    if [401, 403, 404].contains(response.status) { return unauthenticatedSnapshot(id, fetchedAt: now) }
    if response.status == 429 { throw rateLimited(response, now: now) }
    guard response.ok else { throw UsageReadError.http(id, response.status) }
    return mapCopilotUsage(try decode(CopilotUser.self, response, id), fetchedAt: now)
  }
}
