import Foundation

/// A meter's windows as the user arranged them: starred first in the order
/// starred, then the rest in the chosen order (the provider's own for any
/// not placed), with hidden ones left out.
public func arrangeBuckets(_ snapshot: UsageSnapshot, _ settings: CapsuleSettings) -> UsageSnapshot {
  let meter = snapshot.meterId
  let key = { (bucket: UsageBucket) in MetricKey(meter, bucket.id) }
  let visible = snapshot.buckets.enumerated().filter { !settings.hiddenMetrics.contains(key($0.element)) }
  func rank(_ item: (offset: Int, element: UsageBucket)) -> (Int, Int) {
    let id = key(item.element)
    if let star = settings.starredMetrics.firstIndex(of: id) { return (0, star) }
    if let placed = settings.metricOrder.firstIndex(of: id) { return (1, placed) }
    return (2, item.offset)
  }
  var arranged = snapshot
  arranged.buckets = visible.sorted { rank($0) < rank($1) }.map(\.element)
  // The ring follows the top row, so a star decides what the ring shows.
  if let first = arranged.buckets.first, first.id != snapshot.buckets.first?.id {
    arranged.primaryPercent = first.percentUsed
  }
  return arranged
}

extension CapsuleSettings {
  /// Moves one window up or down among its meter's windows, writing the
  /// whole meter's order so later moves are stable.
  public mutating func moveMetric(_ key: MetricKey, by offset: Int, among buckets: [String]) {
    let meter = key.meter
    var order = buckets.map { MetricKey(meter: meter, bucket: $0) }
    order.sort { (metricOrder.firstIndex(of: $0) ?? Int.max) < (metricOrder.firstIndex(of: $1) ?? Int.max) }
    guard let from = order.firstIndex(of: key) else { return }
    let to = max(0, min(order.count - 1, from + offset))
    guard to != from else { return }
    order.insert(order.remove(at: from), at: to)
    metricOrder.removeAll { $0.meter == meter }
    metricOrder.append(contentsOf: order)
  }

  public mutating func setHidden(_ key: MetricKey, _ hidden: Bool) {
    hiddenMetrics.removeAll { $0 == key }
    if hidden { hiddenMetrics.append(key) }
  }

  public mutating func setStarred(_ key: MetricKey, _ starred: Bool) {
    starredMetrics.removeAll { $0 == key }
    if starred { starredMetrics.append(key) }
  }
}
