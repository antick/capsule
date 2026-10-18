import CapsuleCore
import Foundation

/// Sample readings in place of a provider's real ones, for demo mode.
public struct DemoUsageProvider: UsageProvider {
  public let id: ProviderId

  public init(_ id: ProviderId) { self.id = id }

  public func fetchSnapshot(_ host: UsageHost, now: Date) async throws -> UsageSnapshot {
    guard let snapshot = Demo.snapshots.first(where: { $0.providerId == id }) else {
      throw UsageReadError.unreadable(id)
    }
    return snapshot
  }
}
