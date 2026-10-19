import CapsuleCore
import CapsuleDock
import SwiftUI

/// What each card shows: every window of every meter, to show or hide,
/// star to the top, and move up or down.
struct CardsPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let readings = model.snapshots.filter { !$0.buckets.isEmpty || !($0.extras ?? []).isEmpty }
    SettingsForm(lead: Copy.metricsHint) {
      if readings.isEmpty {
        Section { Text(Copy.noMetricsYet).foregroundStyle(.secondary) }
      }
      ForEach(readings, id: \.meterId) { snapshot in
        Section {
          let ordered = ordering(snapshot)
          ForEach(Array(ordered.enumerated()), id: \.element.id) { index, bucket in
            row(snapshot, bucket, index: index, count: ordered.count)
          }
          ForEach(snapshot.extras ?? [], id: \.id) { extra in
            amountRow(snapshot, extra)
          }
        } header: {
          HStack(spacing: 8) {
            ProviderBadge(id: snapshot.providerId, size: 20)
            Text(snapshot.displayName)
          }
        }
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
      Button { model.change { $0.setStarred(key, !starred) } } label: {
        Image(systemName: starred ? "star.fill" : "star").foregroundStyle(starred ? Color.yellow : Color.secondary)
          .frame(width: 18)
      }
      .buttonStyle(.borderless).help(starred ? Copy.unstarMetric : Copy.starMetric)
      .accessibilityLabel("\(starred ? Copy.unstarMetric : Copy.starMetric) \(name)")
      VStack(alignment: .leading, spacing: 1) {
        Text(bucket.label).font(.system(size: 13))
        Text("\(jsString(.number(jsRound(bucket.percentUsed))))\(Copy.percentUsedSuffix)")
          .font(.system(size: 11).monospacedDigit()).foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
      ControlGroup {
        Button { model.change { $0.moveMetric(key, by: -1, among: ids) } } label: { Image(systemName: "chevron.up") }
          .disabled(index == 0 || starred).accessibilityLabel("\(Copy.moveUp) \(name)")
        Button { model.change { $0.moveMetric(key, by: 1, among: ids) } } label: { Image(systemName: "chevron.down") }
          .disabled(index == count - 1 || starred).accessibilityLabel("\(Copy.moveDown) \(name)")
      }
      .controlSize(.small).fixedSize()
      Toggle("", isOn: Binding(get: { !hidden }, set: { on in model.change { $0.setHidden(key, !on) } }))
        .labelsHidden().toggleStyle(.switch).controlSize(.small).accessibilityLabel("\(Copy.showMetric) \(name)")
    }
    .opacity(hidden ? 0.5 : 1)
  }

  private func amountRow(_ snapshot: UsageSnapshot, _ extra: UsageExtra) -> some View {
    let key = MetricKey(snapshot.meterId, extra.id)
    let hidden = model.settings.hiddenMetrics.contains(key)
    return HStack(spacing: 10) {
      Image(systemName: "dollarsign.circle").foregroundStyle(.secondary).frame(width: 18)
      VStack(alignment: .leading, spacing: 1) {
        Text(extra.label).font(.system(size: 13))
        Text(extra.value).font(.system(size: 11).monospacedDigit()).foregroundStyle(.secondary).lineLimit(1)
      }
      Spacer(minLength: 0)
      Toggle("", isOn: Binding(get: { !hidden }, set: { on in model.change { $0.setHidden(key, !on) } }))
        .labelsHidden().toggleStyle(.switch).controlSize(.small)
        .accessibilityLabel("\(Copy.showMetric) \(snapshot.displayName) \(extra.label)")
    }
    .opacity(hidden ? 0.5 : 1)
  }
}
