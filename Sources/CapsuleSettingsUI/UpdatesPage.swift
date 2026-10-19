import CapsuleCore
import SwiftUI

/// The installed version, what is waiting, and how updates arrive.
struct UpdatesPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    let state = model.update
    SettingsForm(lead: UpdateCopy.updatesHint) {
      Section {
        HStack(alignment: .center, spacing: 14) {
          AppMark(size: 44)
          VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
              Text(state.title).font(.system(size: 15, weight: .semibold))
              StatusPill(tone: Tone(state.tone), text: state.availableVersion ?? state.currentVersion)
            }
            if let detail = state.detail {
              Text(detail).font(.system(size: 12)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Text("\(UpdateCopy.lastChecked): \(lastChecked(state))").font(.system(size: 11)).foregroundStyle(.tertiary)
          }
          Spacer(minLength: 0)
          actions(state)
        }
        .padding(.vertical, 4)
        if state.phase == .downloading {
          if let progress = state.progress, progress.totalBytes > 0 {
            VStack(alignment: .leading, spacing: 4) {
              ProgressView(value: progress.fraction)
              Text(formatProgress(progress)).font(.caption).foregroundStyle(.secondary)
            }
          } else {
            ProgressView().controlSize(.small)
          }
        }
      }
      if let notes = state.releaseNotes {
        SettingsSection(title: UpdateCopy.releaseNotes) {
          ScrollView {
            Text(notes).font(.system(size: 12.5)).foregroundStyle(.secondary)
              .frame(maxWidth: .infinity, alignment: .leading).textSelection(.enabled)
          }
          .frame(maxHeight: 240)
        }
      }
      SettingsSection(title: UpdateCopy.automaticUpdates) {
        SwitchRow(label: UpdateCopy.autoCheck, hint: UpdateCopy.autoCheckHint, isOn: model.binding(\.autoUpdateCheck))
          .disabled(!state.canInstall)
        SwitchRow(
          label: UpdateCopy.autoDownload, hint: UpdateCopy.autoDownloadHint, isOn: model.binding(\.autoUpdateDownload)
        )
        .disabled(!state.canInstall || !model.settings.autoUpdateCheck)
        LabeledContent(UpdateCopy.currentVersion) {
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
        if state.canInstall {
          Button(UpdateCopy.download) { model.onDownloadUpdate() }.keyboardShortcut(.defaultAction)
        }
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

extension UpdateCopy {
  public static let automaticUpdates = "Automatic updates"
}
