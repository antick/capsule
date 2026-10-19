import AppKit
import CapsuleCore
import CapsuleDock
import SwiftUI

/// One meter's row on the providers page: its mark, name and status, its
/// reading, anything extra, and the switch that shows or hides its ring.
struct MeterRow<Title: View, Trailing: View>: View {
  let id: ProviderId
  let snapshot: UsageSnapshot?
  let enabled: Bool
  /// For VoiceOver, on the switch.
  let label: String
  let onToggle: (Bool) -> Void
  @ViewBuilder let title: Title
  @ViewBuilder let trailing: Trailing

  var body: some View {
    let percent = snapshot?.primaryPercent.map { jsRound($0) }
    HStack(spacing: 14) {
      ProviderBadge(id: id)
      VStack(alignment: .leading, spacing: 3) {
        title
        StatusPill(tone: tone(snapshot?.status), text: Copy.statusLabel(snapshot?.status))
      }
      Spacer(minLength: 0)
      if let percent {
        Text("\(jsString(.number(percent)))\(Copy.percentSuffix)")
          .font(.system(size: 13, weight: .medium).monospacedDigit())
          .foregroundStyle(Tone.severity(percent).color)
      }
      trailing
      Toggle("", isOn: Binding(get: { enabled }, set: onToggle))
        .labelsHidden().toggleStyle(.switch).accessibilityLabel(label)
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

/// An added account: its name, editable in place, and the folder it reads.
struct AccountRow: View {
  @ObservedObject var model: SettingsModel
  let account: UsageAccount
  @State private var name = ""

  var body: some View {
    MeterRow(
      id: account.provider, snapshot: model.snapshots.first { $0.meterId == account.meter },
      enabled: account.enabled, label: account.label,
      onToggle: { on in model.updateAccount(account.id) { $0.enabled = on } }
    ) {
      VStack(alignment: .leading, spacing: 1) {
        TextField(Copy.accountLabel, text: $name)
          .textFieldStyle(.plain).font(.system(size: 13.5, weight: .medium))
          .onSubmit(commit)
          .onChange(of: name) { _, _ in commit() }
        Text(AccountPaths.display(account.path, home: model.homeDir))
          .font(.system(size: 11.5).monospaced()).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
      }
    } trailing: {
      Button { model.removeAccount(account.id) } label: { Image(systemName: "trash") }
        .buttonStyle(.borderless).help(Copy.removeAccount).accessibilityLabel(Copy.removeAccount)
    }
    .onAppear { name = account.label }
  }

  private func commit() {
    let trimmed = jsTrim(name)
    guard !trimmed.isEmpty, trimmed != account.label else { return }
    model.updateAccount(account.id) { $0.label = trimmed }
  }
}

/// Adds another account: one click for a folder found on this Mac, or any
/// folder by path or by picking it.
struct AddAccountSection: View {
  @ObservedObject var model: SettingsModel
  @State private var provider: ProviderId = .claude
  @State private var path = ""
  @State private var problem: String?

  var body: some View {
    SettingsSection(title: Copy.otherAccounts, hint: Copy.otherAccountsHint) {
      if !model.foundAccounts.isEmpty {
        VStack(alignment: .leading, spacing: 6) {
          Text(Copy.foundAccount).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
          ForEach(model.foundAccounts, id: \.self) { found in
            HStack(spacing: 10) {
              ProviderMark(id: found.provider, tint: .primary).frame(width: 15, height: 15)
              Text(ProviderLabels.label(found.provider)).font(.system(size: 13, weight: .medium))
              Text(AccountPaths.display(found.path, home: model.homeDir))
                .font(.system(size: 12).monospaced()).foregroundStyle(.secondary)
              Spacer(minLength: 0)
              Button(Copy.addAccount) { submit(found.provider, found.path) }
            }
          }
        }
        Divider()
      }
      HStack(spacing: 8) {
        Picker(Copy.accountProvider, selection: $provider) {
          ForEach(AccountRules.supported, id: \.self) { Text(ProviderLabels.label($0)).tag($0) }
        }
        .pickerStyle(.segmented).labelsHidden().fixedSize()
        TextField(Copy.accountPathPlaceholder, text: $path)
          .textFieldStyle(.roundedBorder).font(.system(size: 12.5).monospaced())
          .onSubmit { submit(provider, path) }
        Button(Copy.chooseFolder, action: choose)
        Button(Copy.addAccount) { submit(provider, path) }
          .disabled(jsTrim(path).isEmpty)
      }
      if let problem {
        Text(problem).font(.system(size: 12)).foregroundStyle(.red)
      }
    }
    .onChange(of: path) { _, _ in problem = nil }
    .onChange(of: provider) { _, _ in problem = nil }
  }

  private func submit(_ provider: ProviderId, _ path: String) {
    let check = model.addAccount(provider, path: path)
    problem = Copy.accountCheck(check)
    if check == .ok { self.path = "" }
  }

  /// The system folder picker, showing the dot-folders accounts live in.
  private func choose() {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.allowsMultipleSelection = false
    panel.showsHiddenFiles = true
    panel.directoryURL = URL(fileURLWithPath: model.homeDir, isDirectory: true)
    guard panel.runModal() == .OK, let url = panel.url else { return }
    path = AccountPaths.display(url.path, home: model.homeDir)
  }
}
