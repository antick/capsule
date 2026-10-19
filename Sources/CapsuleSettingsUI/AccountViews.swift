import AppKit
import CapsuleCore
import CapsuleDock
import SwiftUI

/// A provider's mark on the dock's own black, as the dock shows it.
struct ProviderBadge: View {
  let id: ProviderId
  var size = 30.0

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).fill(HudTheme.midnight.surface.swiftUI)
      ProviderMark(id: id, tint: HudTheme.midnight.text.swiftUI).frame(width: size * 0.55, height: size * 0.55)
    }
    .frame(width: size, height: size)
  }
}

/// Every provider, each followed by the accounts added for it.
struct ProvidersPage: View {
  @ObservedObject var model: SettingsModel

  var body: some View {
    SettingsForm(lead: Copy.providersHint) {
      ForEach(ProviderId.allCases, id: \.self) { id in
        Section {
          row(id)
          ForEach(model.settings.accounts.filter { $0.provider == id }) { account in
            AccountRow(model: model, account: account)
          }
        }
      }
    }
    .onAppear { model.onScanAccounts() }
  }

  private func row(_ id: ProviderId) -> some View {
    let enabled = model.settings.enabledProviderIds.contains(id)
    let name = model.settings.label(for: MeterId(id))
    // The default folder shows once another account sits beside it.
    let paired = model.settings.accounts.contains { $0.provider == id }
    let folder = AccountRules.defaultFolder(id).map { "~/" + $0.joined(separator: "/") }
    return MeterRow(
      id: id, snapshot: model.snapshots.first { $0.meterId == MeterId(id) }, enabled: enabled, label: name,
      onToggle: { on in
        // Rebuilt from the canonical order, so a provider switched back on
        // returns to where its ring was.
        model.change { settings in
          var wanted = Set(settings.enabledProviderIds)
          if on { wanted.insert(id) } else { wanted.remove(id) }
          settings.enabledProviderIds = ProviderId.allCases.filter { wanted.contains($0) }
        }
      }
    ) {
      MeterTitle(name: name, placeholder: ProviderLabels.label(id), folder: paired ? folder : nil) { next in
        model.change { $0.setName(next, for: id) }
      }
    } trailing: {
      EmptyView()
    }
  }
}

/// One meter's row: its mark, name and status, its reading, and its switch.
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
    HStack(spacing: 12) {
      ProviderBadge(id: id)
      VStack(alignment: .leading, spacing: 2) {
        title
        StatusPill(tone: tone(snapshot?.status), text: Copy.statusLabel(snapshot?.status))
      }
      Spacer(minLength: 0)
      if let percent, enabled {
        Text("\(jsString(.number(percent)))\(Copy.percentSuffix)")
          .font(.system(size: 13, weight: .semibold).monospacedDigit())
          .foregroundStyle(Tone.severity(percent).color)
      }
      trailing
      Toggle("", isOn: Binding(get: { enabled }, set: onToggle))
        .labelsHidden().toggleStyle(.switch).accessibilityLabel(label)
    }
    .padding(.vertical, 2)
    .opacity(enabled ? 1 : 0.55)
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
          .labelsHidden().textFieldStyle(.plain).font(.system(size: 13, weight: .semibold)).fixedSize()
          .onSubmit(commit)
          .onChange(of: draft) { _, _ in commit() }
          .accessibilityLabel(Copy.accountLabel)
        Image(systemName: "pencil").font(.system(size: 10)).foregroundStyle(.tertiary)
      }
      .help(Copy.renameHint)
      if let folder {
        Text(folder).font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
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
      Button(role: .destructive) { model.removeAccount(account.id) } label: { Image(systemName: "trash") }
        .buttonStyle(.borderless).help(Copy.removeAccount).accessibilityLabel(Copy.removeAccount)
    }
  }
}
