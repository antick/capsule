import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import SwiftUI

/// Where Capsule lives and what its menu-bar item shows, with the item
/// itself previewed from the current readings.
struct MenuBarPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let s = model.settings
    SettingsForm(lead: Copy.menuBarHint) {
      Section { MenuBarPreview(model: model) }
      SettingsSection(title: Copy.presence, hint: Copy.presenceHint) {
        HStack(spacing: 8) {
          ForEach(Presence.allCases, id: \.self) { presence in
            OptionCard(selected: s.presence == presence, label: Copy.label(presence), action: {
              model.change { $0.presence = presence }
            }) {
              Image(systemName: Self.symbol(presence)).font(.system(size: 22, weight: .light))
                .frame(maxWidth: .infinity).frame(height: 36).foregroundStyle(.secondary)
            }
          }
        }
      }
      SettingsSection(title: Copy.menuBarStyle, hint: Copy.menuBarStyleHint) {
        HStack(spacing: 8) {
          ForEach(MenuBarStyle.allCases, id: \.self) { style in
            OptionCard(selected: s.menuBarStyle == style, label: Copy.label(style), action: {
              model.change { $0.menuBarStyle = style }
            }) {
              MenuBarSample(entries: sample(style), style: s.pinStyle, height: 22).frame(maxWidth: .infinity).frame(height: 36)
            }
          }
        }
        if s.menuBarStyle != .icon {
          SettingRow(label: Copy.pinStyle) {
            Picker(Copy.pinStyle, selection: model.binding(\.pinStyle)) {
              ForEach(PinStyle.allCases, id: \.self) { Text(Copy.label($0)).tag($0) }
            }
            .pickerStyle(.segmented).labelsHidden().fixedSize()
          }
        }
        if s.menuBarStyle == .single {
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
      }
      if s.menuBarStyle == .pinned { PinnedMetricsSection(model: model) }
    }
  }

  private static func symbol(_ presence: Presence) -> String {
    switch presence {
    case .dock: return "dock.rectangle"
    case .menuBar: return "menubar.rectangle"
    case .both: return "rectangle.split.2x1"
    }
  }

  /// A made-up reading for each style's card, so the card shows the look.
  private func sample(_ style: MenuBarStyle) -> [MenuBarEntry] {
    let low = MenuBarValue(percent: 12, used: 12)
    let mid = MenuBarValue(percent: 48, used: 48)
    switch style {
    case .icon: return []
    case .single: return [MenuBarEntry(provider: .claude, values: [low, mid])]
    case .pinned:
      return [MenuBarEntry(provider: .claude, values: [low, mid]), MenuBarEntry(provider: .codex, values: [mid])]
    }
  }
}

/// The real menu-bar picture for the current settings and readings, on a
/// light strip and a dark one.
struct MenuBarPreview: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let entries = menuBarEntries(model.settings, model.snapshots)
    HStack(spacing: 10) {
      strip(entries, dark: false)
      strip(entries, dark: true)
    }
    .padding(.vertical, 6)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Copy.menuBarPreview)
  }

  private func strip(_ entries: [MenuBarEntry], dark: Bool) -> some View {
    MenuBarSample(entries: entries, style: model.settings.pinStyle, height: 24, dark: dark)
      .frame(maxWidth: .infinity).frame(height: 44)
      .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(dark ? Color(white: 0.16) : Color(white: 0.93)))
  }
}

/// The menu-bar picture for some entries, or Capsule's mark for none,
/// scaled up and drawn in fixed ink so a light or dark strip reads true.
struct MenuBarSample: View {
  let entries: [MenuBarEntry]
  let style: PinStyle
  var height = 22.0
  /// Drawn for a dark strip; nil follows the window.
  var dark: Bool? = nil
  @Environment(\.colorScheme) private var scheme

  var body: some View {
    let onDark = dark ?? (scheme == .dark)
    let ink = onDark ? NSColor.white : NSColor.black
    Group {
      if entries.isEmpty {
        Image(nsImage: BrandIcon.image(template: true)).renderingMode(.template).resizable().scaledToFit()
          .foregroundStyle(Color(nsColor: ink))
      } else {
        Image(nsImage: MenuBarImage.render(entries, style: style, ink: ink)).resizable().scaledToFit()
      }
    }
    .frame(height: height)
  }
}

/// The metrics to pin, as chips grouped by meter.
struct PinnedMetricsSection: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let pinned = model.settings.pinnedMetrics
    SettingsSection(title: Copy.pinnedMetrics, hint: Copy.pinnedMetricsHint) {
      let readings = model.snapshots.filter { !$0.buckets.isEmpty }
      if readings.isEmpty { Text(Copy.noMetricsYet).foregroundStyle(.secondary) }
      ForEach(readings, id: \.meterId) { snapshot in
        LabeledContent {
          FlowLayout {
            ForEach(snapshot.buckets, id: \.id) { bucket in
              let key = MetricKey(snapshot.meterId, bucket.id)
              let on = pinned.contains(key)
              Chip(provider: nil, label: bucket.label, selected: on, disabled: pinned.count >= MenuBarLimits.maxPins) {
                toggle(key, !on)
              }
              .accessibilityLabel("\(snapshot.displayName) \(bucket.label)")
            }
          }
        } label: {
          HStack(spacing: 8) {
            ProviderBadge(id: snapshot.providerId, size: 22)
            Text(snapshot.displayName)
          }
        }
      }
    }
  }

  private func toggle(_ key: MetricKey, _ on: Bool) {
    model.change { settings in
      settings.pinnedMetrics.removeAll { $0 == key }
      if on, settings.pinnedMetrics.count < MenuBarLimits.maxPins { settings.pinnedMetrics.append(key) }
    }
  }
}

extension Copy {
  public static let menuBarPreview = "How the menu bar item looks now"
}
