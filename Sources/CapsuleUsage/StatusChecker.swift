import CapsuleCore
import Foundation

/// Reads each provider's public status page. A page that cannot be read
/// keeps what it said last rather than claiming all clear.
public actor StatusChecker {
  private let host: UsageHost
  public private(set) var statuses: [ProviderId: ProviderStatus] = [:]

  public init(host: UsageHost) { self.host = host }

  public func check(_ providers: [ProviderId], now: Date) async -> [ProviderId: ProviderStatus] {
    var next: [ProviderId: ProviderStatus] = [:]
    var googleFeed: String??
    for provider in Set(providers) {
      guard let source = StatusSource.of(provider) else { continue }
      var fresh: ProviderStatus?
      switch source {
      case .statuspage(let base):
        if let text = await read(base + StatusTuning.statuspagePath) { fresh = parseStatuspage(text, checkedAt: now) }
      case .google(let product):
        // One feed covers every Google product; read it once.
        if googleFeed == nil { googleFeed = .some(await read(StatusTuning.googleFeed)) }
        if let text = googleFeed ?? nil { fresh = parseGoogleIncidents(text, product: product, checkedAt: now) }
      }
      if let status = fresh ?? statuses[provider] { next[provider] = status }
    }
    statuses = next
    return next
  }

  private func read(_ url: String) async -> String? {
    guard let response = try? await host.send(HTTPRequest(url: url, headers: usageHeaders())), response.ok else {
      return nil
    }
    return String(decoding: response.body, as: UTF8.self)
  }
}

/// A provider's incident as a row on its card, or nil when all is clear.
public func statusExtra(_ status: ProviderStatus?) -> UsageExtra? {
  guard let status, status.level != .none else { return nil }
  return UsageExtra(
    id: "status", label: Copy.statusRow,
    value: status.description.isEmpty ? Copy.label(status.level) : status.description, note: Copy.label(status.level))
}
