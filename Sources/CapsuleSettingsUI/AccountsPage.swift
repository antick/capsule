import AppKit
import CapsuleCore
import CapsuleDock
import SwiftUI

/// More accounts of a provider, and the keys for providers with no login on
/// this Mac.
struct AccountsPage: View {
  @ObservedObject var model: SettingsModel
  @State private var provider: ProviderId = .claude
  @State private var path = ""
  @State private var problem: String?

  var body: some View {
    SettingsForm(lead: Copy.otherAccountsHint) {
      if !model.foundAccounts.isEmpty {
        SettingsSection(title: Copy.foundAccount) {
          ForEach(model.foundAccounts, id: \.self) { found in
            HStack(spacing: 12) {
              ProviderBadge(id: found.provider, size: 26)
              VStack(alignment: .leading, spacing: 1) {
                Text(ProviderLabels.label(found.provider)).font(.system(size: 13, weight: .semibold))
                Text(AccountPaths.display(found.path, home: model.homeDir))
                  .font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
              }
              Spacer(minLength: 0)
              Button(Copy.addAccount) { submit(found.provider, found.path) }
                .accessibilityLabel("\(Copy.addAccount) \(AccountPaths.display(found.path, home: model.homeDir))")
            }
          }
        }
      }
      SettingsSection(title: Copy.addByFolder, hint: problem ?? Copy.addByFolderHint) {
        Picker(Copy.accountProvider, selection: $provider) {
          ForEach(AccountRules.supported, id: \.self) { Text(ProviderLabels.label($0)).tag($0) }
        }
        .pickerStyle(.segmented)
        HStack(spacing: 8) {
          TextField(Copy.accountFolder, text: $path, prompt: Text(Copy.accountPathPlaceholder))
            .labelsHidden().textFieldStyle(.roundedBorder).frame(maxWidth: .infinity)
            .font(.system(size: 12.5, design: .monospaced))
            .onSubmit { submit(provider, path) }
          Button(Copy.chooseFolder, action: choose)
          Button(Copy.addAccount) { submit(provider, path) }.disabled(jsTrim(path).isEmpty)
            .keyboardShortcut(.defaultAction)
        }
        if let problem {
          Label(problem, systemImage: "exclamationmark.triangle.fill").font(.system(size: 12)).foregroundStyle(.orange)
        }
      }
      ApiKeysSection(model: model)
    }
    .onChange(of: path) { _, _ in problem = nil }
    .onChange(of: provider) { _, _ in problem = nil }
    .onAppear { model.onScanAccounts() }
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

/// Keys and sessions. A saved key is never shown again; it can only be
/// replaced or cleared.
struct ApiKeysSection: View {
  @ObservedObject var model: SettingsModel
  @State private var drafts: [StoredKey: String] = [:]

  var body: some View {
    SettingsSection(title: Copy.apiKeys, hint: Copy.apiKeysHint) {
      ForEach(StoredKey.allCases, id: \.self) { key in
        let saved = model.savedKeys.contains(key)
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 8) {
            Text(Copy.label(key)).font(.system(size: 13, weight: .semibold))
            Spacer(minLength: 0)
            StatusPill(tone: saved ? .good : .neutral, text: saved ? Copy.keySaved : Copy.keyNotSet)
          }
          Text(Copy.hint(key)).font(.system(size: 11.5)).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
          HStack(spacing: 8) {
            SecureField(Copy.label(key), text: Binding(get: { drafts[key] ?? "" }, set: { drafts[key] = $0 }),
              prompt: Text(saved ? Copy.replaceKey : Copy.pasteKey))
              .labelsHidden().textFieldStyle(.roundedBorder).frame(maxWidth: .infinity)
              .accessibilityLabel(Copy.label(key))
              .onSubmit { save(key) }
            Button(Copy.saveKey) { save(key) }.disabled(jsTrim(drafts[key] ?? "").isEmpty)
            if saved {
              Button(Copy.clearKey, role: .destructive) { model.onSaveKey(key, nil) }
                .accessibilityLabel("\(Copy.clearKey) \(Copy.label(key))")
            }
          }
        }
        .padding(.vertical, 3)
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

extension Copy {
  public static let addByFolder = "Add by folder"
  public static let addByFolderHint =
    "The folder CLAUDE_CONFIG_DIR or CODEX_HOME points at for that account, such as ~/.claude-work."
  public static let accountFolder = "Folder"
  public static let replaceKey = "Paste a new key to replace it"
}
