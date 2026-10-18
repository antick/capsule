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

  public var onApply: (CapsuleSettings) -> Void = { _ in }
  public var onRevealDock: () -> Void = {}
  public var onCheckUpdates: () -> Void = {}
  public var onDownloadUpdate: () -> Void = {}
  public var onInstallUpdate: () -> Void = {}
  public var onOpenRelease: () -> Void = {}

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
}
