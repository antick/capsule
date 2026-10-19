import CapsuleCore
import Combine
import Foundation

/// The pages of the settings window.
public enum SettingsPage: String, CaseIterable, Sendable {
  case appearance, providers, updates, general, onboarding
}

/// What the settings window shows and what it can ask for. The app owns the
/// truth; the window edits a copy and hands each change back.
@MainActor
public final class SettingsModel: ObservableObject {
  @Published public var settings: CapsuleSettings
  @Published public var snapshots: [UsageSnapshot] = []
  @Published public var update: UpdateState
  @Published public var page: SettingsPage = .appearance
  @Published public var appearance: HudAppearance = .dark
  /// Folders on this Mac that look like accounts not added yet.
  @Published public var foundAccounts: [AccountCandidate] = []
  /// The user's home, for showing paths with `~`.
  public var homeDir = ""

  public var onApply: (CapsuleSettings) -> Void = { _ in }
  public var onRevealDock: () -> Void = {}
  public var onCheckUpdates: () -> Void = {}
  public var onDownloadUpdate: () -> Void = {}
  public var onInstallUpdate: () -> Void = {}
  public var onOpenRelease: () -> Void = {}
  /// Looks for account folders again and updates ``foundAccounts``.
  public var onScanAccounts: () -> Void = {}
  /// Whether a folder can be added, by what is on disk.
  public var onCheckAccount: (ProviderId, String) -> AccountCheck = { _, _ in .ok }

  public init(settings: CapsuleSettings, update: UpdateState) {
    self.settings = settings
    self.update = update
  }

  /// Applies one edit and hands the result back to the app.
  public func change(_ edit: (inout CapsuleSettings) -> Void) {
    var next = settings
    edit(&next)
    guard next != settings else { return }
    settings = next
    onApply(next)
  }

  /// Adds the folder as an account if it is one, and says why not otherwise.
  @discardableResult
  public func addAccount(_ provider: ProviderId, path: String) -> AccountCheck {
    guard settings.accounts.count < AccountRules.maxAccounts else { return .full }
    let check = onCheckAccount(provider, path)
    guard check == .ok else { return check }
    change { settings in
      settings.accounts.append(
        UsageAccount(
          id: settings.newAccountId(), provider: provider, path: AccountPaths.display(path, home: homeDir),
          label: AccountPaths.defaultLabel(provider, path: path, home: homeDir)
        )
      )
    }
    onScanAccounts()
    return .ok
  }

  public func updateAccount(_ id: String, _ edit: (inout UsageAccount) -> Void) {
    change { settings in
      guard let index = settings.accounts.firstIndex(where: { $0.id == id }) else { return }
      edit(&settings.accounts[index])
    }
  }

  public func removeAccount(_ id: String) {
    change { $0.accounts.removeAll { $0.id == id } }
    onScanAccounts()
  }
}
