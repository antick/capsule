import CapsuleCore
import CapsuleDock
import SwiftUI

/// How the dock looks and where it lives, previewed as it changes.
struct AppearancePage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let s = model.settings
    SettingsForm(lead: Copy.appearanceHint) {
      Section { DockPreview(model: model).listRowInsets(EdgeInsets()) }
      SettingsSection(title: Copy.dockStyle, hint: Copy.dockStyleHint) {
        StylePicker(value: s.dockStyle) { id in model.change { $0.dockStyle = id } }
      }
      SettingsSection(title: Copy.theme, hint: Copy.themeHint) {
        ThemePicker(value: s.hudTheme) { choice in model.change { $0.hudTheme = choice } }
      }
      SettingsSection(title: Copy.dockSize, hint: Copy.dockSizeHint) {
        SizeStepper(value: s.hudScale) { scale in model.change { $0.hudScale = clampHudScale(scale) } }
      }
      SettingsSection(title: Copy.placement, hint: Copy.placementHint) {
        if s.customPosition != nil {
          Button(Copy.recentre) { model.change { $0.customPosition = nil; $0.customCorner = nil } }
            .help(Copy.recentreHint)
        }
      } content: {
        PlacementPicker(value: s.placementPreset) { preset in
          model.change {
            $0.placementPreset = preset
            $0.customPosition = nil
            $0.customCorner = nil
          }
        }
      }
      SettingsSection(title: Copy.behaviour, hint: Copy.behaviourHint) {
        SwitchRow(label: Copy.autoHide, hint: Copy.autoHideHint, isOn: model.binding(\.autoHide))
        if s.autoHide {
          SettingRow(label: Copy.hideDelay, hint: Copy.hideDelayHint) {
            Picker(Copy.hideDelay, selection: model.binding(\.hideDelay)) {
              ForEach(HideDelay.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented).labelsHidden().fixedSize()
          }
          SettingRow(label: Copy.showDock, hint: Copy.showDockHint) {
            Button(Copy.showDock) { model.onRevealDock() }
          }
        }
        if s.placementPreset == .topEdge {
          SwitchRow(label: Copy.topEdgeNotch, hint: Copy.topEdgeNotchHint, isOn: model.binding(\.topEdgeNotch))
        }
      }
    }
  }
}

/// Where someone with nothing set up yet starts.
struct OnboardingPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    SettingsForm {
      Section {
        VStack(alignment: .leading, spacing: 14) {
          AppMark(size: 52)
          Text(Copy.onboardingTitle).font(.system(size: 22, weight: .semibold))
          Text(Copy.onboardingBody).font(.system(size: 13)).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
          HStack(spacing: 8) {
            Button(Copy.providers) { model.page = .providers }.keyboardShortcut(.defaultAction)
            Button(Copy.accountsPane) { model.page = .accounts }
          }
        }
        .padding(.vertical, 8)
      }
    }
  }
}
