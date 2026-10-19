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

/// A meter's name, edited in place, and the folder it reads if it has one.
struct MeterTitle: View {
  let name: String
  let placeholder: String
  let folder: String?
  let onRename: (String) -> Void
  @State private var draft = ""

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 5) {
        TextField(placeholder, text: $draft)
          .textFieldStyle(.plain).font(.system(size: 13.5, weight: .medium)).fixedSize()
          .onSubmit(commit)
          .onChange(of: draft) { _, _ in commit() }
          .accessibilityLabel(Copy.accountLabel)
        Image(systemName: "pencil").font(.system(size: 10.5)).foregroundStyle(.tertiary)
      }
      .help(Copy.renameHint)
      if let folder {
        Text(folder).font(.system(size: 11.5).monospaced()).foregroundStyle(.secondary)
          .lineLimit(1).truncationMode(.middle)
      }
    }
    .onAppear { draft = name }
    .onChange(of: name) { _, next in if jsTrim(draft) != next { draft = next } }
  }

  private func commit() {
    let trimmed = jsTrim(draft)
    guard !trimmed.isEmpty, trimmed != name else { return }
    onRename(trimmed)
  }
}

/// An added account: its name, editable in place, and the folder it reads.
struct AccountRow: View {
  @ObservedObject var model: SettingsModel
  let account: UsageAccount

  var body: some View {
    MeterRow(
      id: account.provider, snapshot: model.snapshots.first { $0.meterId == account.meter },
      enabled: account.enabled, label: account.label,
      onToggle: { on in model.updateAccount(account.id) { $0.enabled = on } }
    ) {
      MeterTitle(
        name: account.label, placeholder: ProviderLabels.label(account.provider),
        folder: AccountPaths.display(account.path, home: model.homeDir)
      ) { name in model.updateAccount(account.id) { $0.label = name } }
    } trailing: {
      Button { model.removeAccount(account.id) } label: { Image(systemName: "trash") }
        .buttonStyle(.borderless).help(Copy.removeAccount).accessibilityLabel(Copy.removeAccount)
    }
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

/// Keys and sessions for providers with no login on this Mac. A saved key is
/// never shown again; it can only be replaced or cleared.
struct ApiKeysSection: View {
  @ObservedObject var model: SettingsModel
  @State private var drafts: [StoredKey: String] = [:]

  var body: some View {
    SettingsSection(title: Copy.apiKeys, hint: Copy.apiKeysHint) {
      ForEach(StoredKey.allCases, id: \.self) { key in
        let saved = model.savedKeys.contains(key)
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 8) {
            Text(Copy.label(key)).font(.system(size: 13, weight: .medium))
            StatusPill(tone: saved ? .good : .neutral, text: saved ? Copy.keySaved : Copy.keyNotSet)
            Spacer(minLength: 0)
          }
          Text(Copy.hint(key)).font(.system(size: 12)).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
          HStack(spacing: 8) {
            SecureField(Copy.pasteKey, text: Binding(get: { drafts[key] ?? "" }, set: { drafts[key] = $0 }))
              .textFieldStyle(.roundedBorder).accessibilityLabel(Copy.label(key))
              .onSubmit { save(key) }
            Button(Copy.saveKey) { save(key) }.disabled(jsTrim(drafts[key] ?? "").isEmpty)
            if saved {
              Button(Copy.clearKey) { model.onSaveKey(key, nil) }.accessibilityLabel("\(Copy.clearKey) \(Copy.label(key))")
            }
          }
        }
        .padding(.vertical, 4)
        if key != StoredKey.allCases.last { Divider() }
      }
    }
  }

  private func save(_ key: StoredKey) {
    let value = jsTrim(drafts[key] ?? "")
    guard !value.isEmpty else { return }
    model.onSaveKey(key, value)
    drafts[key] = ""
  }
}
