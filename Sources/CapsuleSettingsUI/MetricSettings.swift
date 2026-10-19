import CapsuleCore
import CapsuleDock
import SwiftUI

/// Every window of every meter: show or hide it, star it to the top of its
/// card, and move it up or down.
struct MetricsSection: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    SettingsSection(title: Copy.metrics, hint: Copy.metricsHint) {
      let readings = model.snapshots.filter { !$0.buckets.isEmpty || !($0.extras ?? []).isEmpty }
      if readings.isEmpty {
        Text(Copy.noMetricsYet).font(.system(size: 12)).foregroundStyle(.secondary)
      }
      ForEach(readings, id: \.meterId) { snapshot in
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 8) {
            ProviderMark(id: snapshot.providerId, tint: .primary).frame(width: 15, height: 15)
            Text(snapshot.displayName).font(.system(size: 13, weight: .medium))
          }
          let ordered = ordering(snapshot)
          ForEach(Array(ordered.enumerated()), id: \.element.id) { index, bucket in
            row(snapshot, bucket, index: index, count: ordered.count)
          }
          ForEach(snapshot.extras ?? [], id: \.id) { extra in
            let key = MetricKey(snapshot.meterId, extra.id)
            let hidden = model.settings.hiddenMetrics.contains(key)
            Toggle(extra.label, isOn: Binding(get: { !hidden }, set: { on in model.change { $0.setHidden(key, !on) } }))
              .toggleStyle(.checkbox).font(.system(size: 12.5))
              .accessibilityLabel("\(Copy.showMetric) \(snapshot.displayName) \(extra.label)")
              .padding(.leading, 23).opacity(hidden ? 0.55 : 1)
          }
        }
        .padding(.vertical, 4)
      }
    }
  }

  /// The windows in card order, hidden ones included so they can come back.
  private func ordering(_ snapshot: UsageSnapshot) -> [UsageBucket] {
    var settings = model.settings
    settings.hiddenMetrics = []
    return arrangeBuckets(snapshot, settings).buckets
  }

  private func row(_ snapshot: UsageSnapshot, _ bucket: UsageBucket, index: Int, count: Int) -> some View {
    let key = MetricKey(snapshot.meterId, bucket.id)
    let hidden = model.settings.hiddenMetrics.contains(key)
    let starred = model.settings.starredMetrics.contains(key)
    let name = "\(snapshot.displayName) \(bucket.label)"
    let ids = snapshot.buckets.map(\.id)
    return HStack(spacing: 10) {
      Toggle(bucket.label, isOn: Binding(get: { !hidden }, set: { on in model.change { $0.setHidden(key, !on) } }))
        .toggleStyle(.checkbox).font(.system(size: 12.5)).accessibilityLabel("\(Copy.showMetric) \(name)")
      Spacer(minLength: 0)
      Button { model.change { $0.setStarred(key, !starred) } } label: {
        Image(systemName: starred ? "star.fill" : "star")
      }
      .buttonStyle(.borderless).help(starred ? Copy.unstarMetric : Copy.starMetric)
      .accessibilityLabel("\(starred ? Copy.unstarMetric : Copy.starMetric) \(name)")
      Button { model.change { $0.moveMetric(key, by: -1, among: ids) } } label: { Image(systemName: "chevron.up") }
        .buttonStyle(.borderless).disabled(index == 0 || starred).help(Copy.moveUp)
        .accessibilityLabel("\(Copy.moveUp) \(name)")
      Button { model.change { $0.moveMetric(key, by: 1, among: ids) } } label: { Image(systemName: "chevron.down") }
        .buttonStyle(.borderless).disabled(index == count - 1 || starred).help(Copy.moveDown)
        .accessibilityLabel("\(Copy.moveDown) \(name)")
    }
    .padding(.leading, 23)
    .opacity(hidden ? 0.55 : 1)
  }
}
