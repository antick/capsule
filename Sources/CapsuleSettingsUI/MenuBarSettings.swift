import CapsuleCore
import CapsuleDock
import SwiftUI

/// Where Capsule lives and what its menu-bar item shows.
struct MenuBarSection: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let s = model.settings
    SettingsSection(title: Copy.menuBar, hint: Copy.menuBarHint) {
      SettingRow(label: Copy.presence, hint: Copy.presenceHint) {
        Picker(Copy.presence, selection: binding(\.presence)) {
          ForEach(Presence.allCases, id: \.self) { Text(Copy.label($0)).tag($0) }
        }
        .pickerStyle(.segmented).labelsHidden().fixedSize()
      }
      Divider()
      SettingRow(label: Copy.menuBarStyle, hint: Copy.menuBarStyleHint) {
        Picker(Copy.menuBarStyle, selection: binding(\.menuBarStyle)) {
          ForEach(MenuBarStyle.allCases, id: \.self) { Text(Copy.label($0)).tag($0) }
        }
        .pickerStyle(.segmented).labelsHidden().fixedSize()
      }
      if s.menuBarStyle == .single {
        Divider()
        SettingRow(label: Copy.menuBarMeter, hint: Copy.menuBarMeterHint) {
          Picker(
            Copy.menuBarMeter,
            selection: Binding(get: { s.menuBarMeter ?? "" }, set: { raw in model.change { $0.menuBarMeter = raw.isEmpty ? nil : raw } })
          ) {
            Text(Copy.highestUsage).tag("")
            ForEach(model.snapshots, id: \.meterId) { Text($0.displayName).tag($0.meterId.rawValue) }
          }
          .labelsHidden().fixedSize()
        }
      }
      if s.menuBarStyle == .pinned {
        Divider()
        SettingRow(label: Copy.pinStyle) {
          Picker(Copy.pinStyle, selection: binding(\.pinStyle)) {
            ForEach(PinStyle.allCases, id: \.self) { Text(Copy.label($0)).tag($0) }
          }
          .pickerStyle(.segmented).labelsHidden().fixedSize()
        }
        Divider()
        PinnedMetricsList(model: model)
      }
    }
  }

  private func binding<Value>(_ key: WritableKeyPath<CapsuleSettings, Value>) -> Binding<Value> {
    Binding(get: { model.settings[keyPath: key] }, set: { value in model.change { $0[keyPath: key] = value } })
  }
}

/// Every metric there is a reading for, each with a pin switch.
struct PinnedMetricsList: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let pinned = model.settings.pinnedMetrics
    VStack(alignment: .leading, spacing: 8) {
      Text(Copy.pinnedMetrics).font(.system(size: 13.5, weight: .medium))
      Text(Copy.pinnedMetricsHint).font(.system(size: 12)).foregroundStyle(.secondary)
      if model.snapshots.allSatisfy(\.buckets.isEmpty) {
        Text(Copy.noMetricsYet).font(.system(size: 12)).foregroundStyle(.secondary)
      }
      ForEach(model.snapshots.filter { !$0.buckets.isEmpty }, id: \.meterId) { snapshot in
        HStack(alignment: .top, spacing: 10) {
          ProviderMark(id: snapshot.providerId, tint: .primary).frame(width: 15, height: 15)
          VStack(alignment: .leading, spacing: 4) {
            Text(snapshot.displayName).font(.system(size: 12.5, weight: .medium))
            ForEach(snapshot.buckets, id: \.id) { bucket in
              let key = MetricKey(snapshot.meterId, bucket.id)
              let on = pinned.contains(key)
              Toggle(bucket.label, isOn: Binding(get: { on }, set: { next in toggle(key, next) }))
                .toggleStyle(.checkbox).font(.system(size: 12.5))
                .disabled(!on && pinned.count >= MenuBarLimits.maxPins)
                .accessibilityLabel("\(snapshot.displayName) \(bucket.label)")
            }
          }
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func toggle(_ key: MetricKey, _ on: Bool) {
    model.change { settings in
      settings.pinnedMetrics.removeAll { $0 == key }
      if on, settings.pinnedMetrics.count < MenuBarLimits.maxPins { settings.pinnedMetrics.append(key) }
    }
  }
}
