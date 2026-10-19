import CapsuleCore
import SwiftUI

/// How often Capsule reads, how it reads out, what it tells you, and how it
/// starts.
struct GeneralPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let s = model.settings
    SettingsForm(lead: Copy.generalHint) {
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
        SwitchRow(label: Copy.adaptiveRefresh, hint: Copy.adaptiveRefreshHint, isOn: model.binding(\.adaptiveRefresh))
        SettingRow(label: Copy.usageDisplay, hint: Copy.usageDisplayHint) {
          Picker(Copy.usageDisplay, selection: model.binding(\.usageDisplay)) {
            Text(Copy.usageDisplayUsed).tag(UsageDisplay.used)
            Text(Copy.usageDisplayRemaining).tag(UsageDisplay.remaining)
          }
          .pickerStyle(.segmented).labelsHidden().fixedSize()
        }
        SwitchRow(label: Copy.showPace, hint: Copy.showPaceHint, isOn: model.binding(\.showPace))
        SwitchRow(label: Copy.checkStatus, hint: Copy.checkStatusHint, isOn: model.binding(\.checkStatus))
      }
      SettingsSection(title: Copy.notificationsSection) {
        SwitchRow(label: Copy.quotaAlerts, hint: Copy.quotaAlertsHint, isOn: model.binding(\.quotaAlerts))
        if s.quotaAlerts {
          SettingRow(label: Copy.alertThresholds) {
            Picker(
              Copy.alertThresholds,
              selection: Binding(get: { s.effectiveThresholds }, set: { next in model.change { $0.alertThresholds = next } })
            ) {
              ForEach(AlertPresets.options, id: \.self) { option in
                Text(option.map { "\($0)\(Copy.percentLeftSuffix)" }.joined(separator: ", ")).tag(option)
              }
            }
            .labelsHidden().fixedSize()
          }
        }
        SwitchRow(label: Copy.celebrateResets, hint: Copy.celebrateResetsHint, isOn: model.binding(\.celebrateResets))
        SwitchRow(
          label: Copy.notificationPopups, hint: Copy.notificationPopupsHint, isOn: model.binding(\.notificationPopups))
      }
      if model.hasCommandLine {
        SettingsSection(title: Copy.commandLine, hint: Copy.commandLineHint) {
          LabeledContent {
            Button(model.commandLinePath == nil ? Copy.installCommandLine : Copy.reinstallCommandLine) {
              model.onInstallCommandLine()
            }
          } label: {
            Text(Copy.commandName).font(.system(size: 13, design: .monospaced))
            Text(model.commandLinePath.map { AccountPaths.display($0, home: model.homeDir) } ?? Copy.notInstalled)
          }
        }
      }
      SettingsSection(title: Copy.system) {
        SwitchRow(label: Copy.launchAtLogin, hint: Copy.launchAtLoginHint, isOn: model.binding(\.launchAtLogin))
      }
    }
  }
}

extension Copy {
  public static let notificationsSection = "Notifications"
  public static let commandName = "capsule"
  public static let notInstalled = "Not installed"
}
