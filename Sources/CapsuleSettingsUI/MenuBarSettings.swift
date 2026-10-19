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
      if s.presence.showsMenuBarItem {
        Section { MenuBarPreview(model: model) }
        SettingsSection(title: Copy.menuBarStyle, hint: Copy.menuBarStyleHint) {
          HStack(spacing: 8) {
            ForEach(MenuBarStyle.allCases, id: \.self) { style in
              OptionCard(selected: s.menuBarStyle == style, label: Copy.label(style), action: {
                model.change { settings in
                  settings.menuBarStyle = style
                  if style == .figures { settings.seedFigures(model.snapshots) }
                }
              }) {
                MenuBarSample(entries: sample(style), style: s.pinStyle, height: 22).frame(maxWidth: .infinity)
                  .frame(height: 36)
              }
            }
          }
          if s.menuBarStyle == .figures {
            SettingRow(label: Copy.pinStyle) {
              Picker(Copy.pinStyle, selection: model.binding(\.pinStyle)) {
                ForEach(PinStyle.allCases, id: \.self) { Text(Copy.label($0)).tag($0) }
              }
              .pickerStyle(.segmented).labelsHidden().fixedSize()
            }
          }
        }
        if s.menuBarStyle == .figures { FiguresSection(model: model) }
      } else {
        Section {
          Label(Copy.noMenuBarItem, systemImage: "menubar.rectangle").foregroundStyle(.secondary)
        }
      }
    }
  }

  private static func symbol(_ presence: Presence) -> String {
    switch presence {
    case .dock: return "rectangle.righthalf.inset.filled"
    case .menuBar: return "menubar.rectangle"
    case .both: return "rectangle.inset.topright.filled"
    }
  }

  /// A made-up reading for each style's card, so the card shows the look.
  private func sample(_ style: MenuBarStyle) -> [MenuBarEntry] {
    switch style {
    case .icon: return []
    case .figures:
      return [
        MenuBarEntry(provider: .claude, values: [MenuBarValue(percent: 12, used: 12), MenuBarValue(percent: 48, used: 48)]),
        MenuBarEntry(provider: .codex, values: [MenuBarValue(percent: 30, used: 30)]),
      ]
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

/// Which figures each provider shows, as chips: at most two per provider,
/// each marked with where it sits.
struct FiguresSection: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    SettingsSection(title: Copy.pinnedMetrics, hint: Copy.pinnedMetricsHint) {
      let readings = model.snapshots.filter { !$0.buckets.isEmpty }
      if readings.isEmpty { Text(Copy.noMetricsYet).foregroundStyle(.secondary) }
      ForEach(readings, id: \.meterId) { snapshot in
        let placed = places(snapshot)
        LabeledContent {
          FlowLayout {
            ForEach(snapshot.buckets, id: \.id) { bucket in
              let key = MetricKey(snapshot.meterId, bucket.id)
              Chip(provider: nil, label: bucket.label, selected: placed[key] != nil, place: placed[key]) {
                model.change { $0.toggleFigure(key, placed[key] == nil) }
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

  /// Where each chosen figure of a meter sits: on top or below.
  private func places(_ snapshot: UsageSnapshot) -> [MetricKey: ChipPlace] {
    var settings = model.settings
    settings.menuBarStyle = .figures
    guard let entry = menuBarEntries(settings, [snapshot]).first else { return [:] }
    let chosen = Set(model.settings.pinnedMetrics)
    let ordered = snapshot.buckets.filter { chosen.contains(MetricKey(snapshot.meterId, $0.id)) }
      .sorted {
        (WindowLengths.seconds(snapshot.providerId, $0) ?? .infinity)
          < (WindowLengths.seconds(snapshot.providerId, $1) ?? .infinity)
      }
      .prefix(entry.values.count)
    var result: [MetricKey: ChipPlace] = [:]
    for (index, bucket) in ordered.enumerated() {
      result[MetricKey(snapshot.meterId, bucket.id)] = ordered.count == 1 ? .only : index == 0 ? .top : .bottom
    }
    return result
  }
}

extension Copy {
  public static let noMenuBarItem =
    "Capsule has no menu-bar item while it lives in the edge dock. Right-click the dock for Settings, or open Capsule again from Applications."
  public static let menuBarPreview = "How the menu bar item looks now"
}
