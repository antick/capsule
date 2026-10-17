import CapsuleCore

/// What the dock keeps showing when a read fails. A blank meter is worse than
/// a slightly old number, so the previous reading survives — dated, so it
/// cannot pass itself off as live.
///
/// Losing credentials is reported rather than papered over: an
/// `unauthenticated` result is the truth, not a failure to be smoothed.
public func mergeSnapshot(
  previous: UsageSnapshot?,
  next: UsageSnapshot
) -> UsageSnapshot {
  if next.status == .ok || next.status == .unauthenticated { return next }
  guard let previous, previous.status != .unauthenticated else { return next }

  var merged = previous
  merged.status = .stale
  merged.fetchedAt = next.fetchedAt
  // The numbers are the old reading's, so they keep the old reading's date.
  merged.staleSince = previous.staleSince ?? previous.fetchedAt
  return merged
}
