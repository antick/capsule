import CapsuleCore
import Foundation

/// What a provider with no credentials reports. `primaryPercent` is absent
/// rather than 0: a provider that was never asked is not one at zero usage.
public func unauthenticatedSnapshot(
  _ providerId: ProviderId,
  fetchedAt: Date
) -> UsageSnapshot {
  UsageSnapshot(
    providerId: providerId,
    displayName: ProviderLabels.label(providerId),
    iconId: providerId,
    primaryPercent: nil,
    buckets: [],
    status: .unauthenticated,
    fetchedAt: isoString(fetchedAt)
  )
}
