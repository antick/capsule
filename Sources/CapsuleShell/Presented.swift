import CapsuleCore
import CapsuleUsage

/// Readings as every surface shows them: rows arranged as the user chose,
/// and a provider's incident added as a row and marked for its ring.
func presented(_ snapshots: [UsageSnapshot], _ settings: CapsuleSettings, statuses: [ProviderId: ProviderStatus])
  -> [UsageSnapshot]
{
  snapshots.map { snapshot in
    var shown = arrangeBuckets(snapshot, settings)
    if let status = statuses[snapshot.providerId], let row = statusExtra(status),
      !settings.hiddenMetrics.contains(MetricKey(snapshot.meterId, row.id))
    {
      shown.extras = [row] + (shown.extras ?? [])
      shown.statusLevel = status.level
    }
    return shown
  }
}
