import CapsuleCore
import CapsuleDock
import SwiftUI

struct AppearancePage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let s = model.settings
    VStack(spacing: 16) {
      PageHeader(title: Copy.appearance, description: Copy.appearanceHint)
      SettingsSection(padded: false) { DockPreview(model: model) }
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
        SettingRow(label: Copy.autoHide, hint: Copy.autoHideHint) {
          Toggle("", isOn: binding(\.autoHide)).labelsHidden().toggleStyle(.switch).accessibilityLabel(Copy.autoHide)
        }
        if s.autoHide {
          Divider()
          SettingRow(label: Copy.hideDelay, hint: Copy.hideDelayHint) {
            Picker(Copy.hideDelay, selection: binding(\.hideDelay)) {
              ForEach(HideDelay.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented).labelsHidden().fixedSize()
          }
          Divider()
          SettingRow(label: Copy.showDock, hint: Copy.showDockHint) {
            Button(Copy.showDock) { model.onRevealDock() }
          }
        }
        if s.placementPreset == .topEdge {
          Divider()
          SettingRow(label: Copy.topEdgeNotch, hint: Copy.topEdgeNotchHint) {
            Toggle("", isOn: binding(\.topEdgeNotch)).labelsHidden().toggleStyle(.switch)
              .accessibilityLabel(Copy.topEdgeNotch)
          }
        }
      }
    }
  }

  private func binding<Value>(_ key: WritableKeyPath<CapsuleSettings, Value>) -> Binding<Value> {
    Binding(get: { model.settings[keyPath: key] }, set: { value in model.change { $0[keyPath: key] = value } })
  }
}

struct ProvidersPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    VStack(spacing: 16) {
      PageHeader(title: Copy.providers, description: Copy.providersHint)
      SettingsSection {
        VStack(spacing: 8) {
          ForEach(ProviderId.allCases, id: \.self) { id in row(id) }
        }
      }
    }
  }

  private func row(_ id: ProviderId) -> some View {
    let snapshot = model.snapshots.first { $0.providerId == id }
    let enabled = model.settings.enabledProviderIds.contains(id)
    let percent = snapshot?.primaryPercent.map { jsRound($0) }
    return HStack(spacing: 14) {
      ProviderBadge(id: id)
      VStack(alignment: .leading, spacing: 3) {
        Text(ProviderLabels.label(id)).font(.system(size: 13.5, weight: .medium))
        StatusPill(tone: tone(snapshot?.status), text: Copy.statusLabel(snapshot?.status))
      }
      Spacer(minLength: 0)
      if let percent {
        Text("\(jsString(.number(percent)))\(Copy.percentSuffix)")
          .font(.system(size: 13, weight: .medium).monospacedDigit())
          .foregroundStyle(Tone.severity(percent).color)
      }
      Toggle(
        "",
        isOn: Binding(
          get: { enabled },
          set: { on in
            // Rebuilt from the canonical order rather than appended to, so a
            // provider switched back on returns to where its ring was.
            model.change { settings in
              var wanted = Set(settings.enabledProviderIds)
              if on { wanted.insert(id) } else { wanted.remove(id) }
              settings.enabledProviderIds = ProviderId.allCases.filter { wanted.contains($0) }
            }
          })
      )
      .labelsHidden().toggleStyle(.switch).accessibilityLabel(ProviderLabels.label(id))
    }
    .padding(.horizontal, 14).padding(.vertical, 12)
    .background(RoundedRectangle(cornerRadius: 12).fill(Color.primary.opacity(0.03)))
    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.primary.opacity(0.08)))
    .opacity(enabled ? 1 : 0.6)
  }

  private func tone(_ status: UsageStatus?) -> Tone {
    switch status {
    case .ok: return .good
    case .stale: return .warn
    case .error: return .bad
    case .unauthenticated, .disabled: return .neutral
    case nil: return .busy
    }
  }
}

/// A provider's mark on the dock's own black, as the dock shows it.
struct ProviderBadge: View {
  let id: ProviderId

  var body: some View {
    ZStack {
      Circle().fill(HudTheme.midnight.surface.swiftUI)
      ProviderMark(id: id, tint: HudTheme.midnight.text.swiftUI).frame(width: 19, height: 19)
    }
    .frame(width: 36, height: 36)
  }
}

struct UpdatesPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let state = model.update
    VStack(spacing: 16) {
      PageHeader(title: UpdateCopy.updates, description: UpdateCopy.updatesHint)
      SettingsSection {
        HStack(alignment: .top, spacing: 16) {
          VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
              Text(state.title).font(.system(size: 15, weight: .semibold))
              StatusPill(tone: Tone(state.tone), text: state.availableVersion ?? state.currentVersion)
            }
            if let detail = state.detail {
              Text(detail).font(.system(size: 12.5)).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            }
            Text("\(UpdateCopy.lastChecked): \(lastChecked(state))").font(.system(size: 11.5))
              .foregroundStyle(.tertiary)
          }
          Spacer(minLength: 0)
          actions(state)
        }
      }
      if let notes = state.releaseNotes {
        SettingsSection(title: UpdateCopy.releaseNotes, hint: state.availableVersion.map { "\(AppIdentity.name) \($0)" }) {
          ScrollView {
            Text(notes).font(.system(size: 12.5)).foregroundStyle(.secondary)
              .frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled)
          }
          .frame(maxHeight: 256)
        }
      }
      SettingsSection {
        SettingRow(label: UpdateCopy.autoCheck, hint: UpdateCopy.autoCheckHint) {
          Toggle(
            "", isOn: Binding(get: { model.settings.autoUpdateCheck }, set: { on in model.change { $0.autoUpdateCheck = on } })
          )
          .labelsHidden().toggleStyle(.switch).accessibilityLabel(UpdateCopy.autoCheck)
        }
        Divider()
        SettingRow(label: UpdateCopy.autoDownload, hint: UpdateCopy.autoDownloadHint) {
          Toggle(
            "",
            isOn: Binding(get: { model.settings.autoUpdateDownload }, set: { on in model.change { $0.autoUpdateDownload = on } })
          )
          .labelsHidden().toggleStyle(.switch).accessibilityLabel(UpdateCopy.autoDownload)
          .disabled(!state.canInstall || !model.settings.autoUpdateCheck)
        }
        Divider()
        SettingRow(label: UpdateCopy.currentVersion) {
          Text(state.currentVersion).font(.system(size: 13).monospacedDigit()).foregroundStyle(.secondary)
        }
      }
    }
  }

  private func lastChecked(_ state: UpdateState) -> String {
    guard let at = state.checkedAt, let date = looseDate(at) else { return UpdateCopy.never }
    return formatAgo(since: date, now: Date())
  }

  @ViewBuilder private func actions(_ state: UpdateState) -> some View {
    switch state.phase {
    case .ready:
      Button(UpdateCopy.restartAndInstall) { model.onInstallUpdate() }.keyboardShortcut(.defaultAction)
    case .available:
      HStack {
        Button(UpdateCopy.viewRelease) { model.onOpenRelease() }
        Button(UpdateCopy.download) { model.onDownloadUpdate() }.keyboardShortcut(.defaultAction)
      }
    default:
      HStack {
        if !state.canInstall { Button(UpdateCopy.viewRelease) { model.onOpenRelease() } }
        Button(state.phase == .checking ? UpdateCopy.checking : UpdateCopy.checkNow) { model.onCheckUpdates() }
          .disabled(!state.canCheck)
      }
    }
  }
}

struct GeneralPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let s = model.settings
    VStack(spacing: 16) {
      PageHeader(title: Copy.general, description: Copy.generalHint)
      SettingsSection(title: Copy.usageReadings) {
        SettingRow(label: Copy.pollInterval, hint: Copy.pollIntervalHint) {
          Picker(
            Copy.pollInterval,
            selection: Binding(
              get: {
                PollIntervals.options.contains { $0.ms == s.pollIntervalMs } ? s.pollIntervalMs : SettingsDefaults.pollIntervalMs
              },
              set: { ms in model.change { $0.pollIntervalMs = ms } })
          ) {
            ForEach(PollIntervals.options, id: \.ms) { Text($0.label).tag($0.ms) }
          }
          .labelsHidden().fixedSize()
        }
        Divider()
        SettingRow(label: Copy.usageDisplay, hint: Copy.usageDisplayHint) {
          Picker(Copy.usageDisplay, selection: binding(\.usageDisplay)) {
            Text(Copy.usageDisplayUsed).tag(UsageDisplay.used)
            Text(Copy.usageDisplayRemaining).tag(UsageDisplay.remaining)
          }
          .pickerStyle(.segmented).labelsHidden().fixedSize()
        }
        Divider()
        SettingRow(label: Copy.notificationPopups, hint: Copy.notificationPopupsHint) {
          Toggle("", isOn: binding(\.notificationPopups)).labelsHidden().toggleStyle(.switch)
            .accessibilityLabel(Copy.notificationPopups)
        }
      }
      SettingsSection(title: Copy.system) {
        SettingRow(label: Copy.launchAtLogin, hint: Copy.launchAtLoginHint) {
          Toggle("", isOn: binding(\.launchAtLogin)).labelsHidden().toggleStyle(.switch)
            .accessibilityLabel(Copy.launchAtLogin)
        }
        Divider()
        SettingRow(label: Copy.demoMode, hint: Copy.demoModeHint) {
          Toggle("", isOn: binding(\.demoMode)).labelsHidden().toggleStyle(.switch).accessibilityLabel(Copy.demoMode)
        }
      }
    }
  }

  private func binding<Value>(_ key: WritableKeyPath<CapsuleSettings, Value>) -> Binding<Value> {
    Binding(get: { model.settings[keyPath: key] }, set: { value in model.change { $0[keyPath: key] = value } })
  }
}

struct OnboardingPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    SettingsSection {
      VStack(alignment: .leading, spacing: 16) {
        AppMark(size: 44)
        VStack(alignment: .leading, spacing: 8) {
          Text(Copy.onboardingTitle).font(.system(size: 22, weight: .semibold))
          Text(Copy.onboardingBody).font(.system(size: 13)).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
        }
        HStack(spacing: 8) {
          Button(Copy.enableDemo) {
            model.change { $0.demoMode = true }
            model.page = .appearance
          }
          .keyboardShortcut(.defaultAction)
          Button(Copy.providers) { model.page = .providers }
        }
      }
    }
  }
}
