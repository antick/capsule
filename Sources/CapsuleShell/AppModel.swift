import AppKit
import CapsuleCore
import CapsuleDock
import CapsuleHUD
import CapsuleSettingsUI
import CapsuleSystem
import os

/// The app: settings and where they are kept, the engine reading usage and
/// activity, the dock, the menus, the updater and the settings window, and
/// what each asks of the others. The Electron main process's `index.ts`.
@MainActor
public final class AppModel: MenuHandlers {
  public private(set) var settings: CapsuleSettings
  /// Holding an auto-hiding dock out. A gesture, not a setting: it lasts as
  /// long as this run of the app, and lives here so the dock and the menus
  /// agree on it.
  public private(set) var keepOpen = false
  public var update: UpdateState { updater.state }

  private let store: JSONStore
  private let engine: Engine
  private let dock: DockController
  private let updater: Updater
  private let settingsModel: SettingsModel
  private var menus: Menus?
  private var statusItem: StatusItemController?
  private let notifier = Notifier()
  private let confetti = Confetti()
  private lazy var alertState: [String: QuotaWindowState] =
    store.load(QuotaAlertRules.stateFile) ?? [:]
  private lazy var history: UsageHistory = pruneHistory(store.load(HistoryTuning.file) ?? [:], now: Date())
  /// The readings history last saw, so activity and status changes do not
  /// re-record them.
  private var recordedSnapshots: [UsageSnapshot] = []
  private var historySave: DispatchWorkItem?
  private lazy var settingsWindow = SettingsWindowController(model: settingsModel)

  public init(store: JSONStore = .applicationSupport(AppIdentity.supportDirectory), events: ShellEvents = .mac) {
    self.store = store
    // Take over from the Electron app before reading anything, once.
    firstRun = CarryOver.run(store) == .fresh
    var loaded = Engine.loadSettings(store)
    // The system is the truth about the login item; the setting follows it.
    if LoginItem.enabled != loaded.launchAtLogin { loaded.launchAtLogin = LoginItem.enabled }
    settings = loaded
    Engine.saveSettings(loaded, to: store)
    engine = Engine(store: store, events: events, settings: loaded)
    dock = DockController(settings: loaded)
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    let autoCheck = LockedFlag(loaded.autoUpdateCheck)
    updater = Updater(version: version) { autoCheck.value }
    updater.autoDownload = loaded.autoUpdateDownload
    autoCheckBox = autoCheck
    settingsModel = SettingsModel(settings: loaded, update: updater.state)
    wire()
  }

  private let autoCheckBox: LockedFlag
  /// No settings to adopt from anywhere: show where to start.
  private let firstRun: Bool

  private func wire() {
    engine.onChange = { [weak self] state in self?.stateChanged(state) }
    engine.onFirstReading = { [weak self] state in
      // Someone not signed in anywhere is shown where to start. One provider
      // switched on but not signed in is not a new user.
      if !state.snapshots.isEmpty, state.snapshots.allSatisfy({ $0.status == .unauthenticated }) {
        self?.openSettings(.onboarding)
      }
    }
    let behavior = dock.behavior
    behavior.onRefresh = { [weak self] id in self?.engine.refreshProvider(id) }
    behavior.onInteract = { [weak self] in self?.engine.noteInteraction() }
    behavior.onKeepOpenChange = { [weak self] next in self?.setKeepOpen(next) }
    behavior.notices.onRead = { [weak self] ids in self?.engine.markRead(ids) }
    dock.view.onDismissNotice = { [weak self] id in self?.engine.dismiss(id) }
    dock.view.onClearNotices = { [weak self] in self?.engine.dismissAll() }
    dock.onMoved = { [weak self] preset, position in
      guard let self else { return }
      var next = self.settings
      next.placementPreset = preset
      next.customPosition = position
      next.customCorner = nil
      self.apply(next)
    }
    dock.contextMenu = { [weak self] in self?.menus?.contextMenu() ?? NSMenu() }
    dock.onEdit = { [weak self] edit in self?.edit(edit) }
    updater.onFocus = { [weak self] in self?.openSettings(.updates) }
    updater.onChange = { [weak self] state in self?.settingsModel.update = state }
    settingsModel.onApply = { [weak self] next in self?.apply(next) }
    settingsModel.onRevealDock = { [weak self] in self?.revealDock() }
    settingsModel.onCheckUpdates = { [weak self] in self?.updater.check() }
    settingsModel.onDownloadUpdate = { [weak self] in self?.updater.download() }
    settingsModel.onOpenRelease = { [weak self] in self?.updater.openReleasePage() }
    settingsModel.onInstallUpdate = { [weak self] in self?.installUpdate() }
    settingsModel.homeDir = userHome
    settingsModel.hasCommandLine = CommandLineTool.bundled != nil
    settingsModel.commandLinePath = CommandLineTool.isInstalled ? CommandLineTool.linkPath : nil
    settingsModel.onInstallCommandLine = { [weak self] in
      CommandLineTool.install()
      self?.settingsModel.commandLinePath = CommandLineTool.isInstalled ? CommandLineTool.linkPath : nil
    }
    let keys = KeyFile(directory: store.directory)
    settingsModel.savedKeys = Set(StoredKey.allCases.filter(keys.has))
    settingsModel.onSaveKey = { [weak self] key, value in
      keys.set(key, value)
      self?.settingsModel.savedKeys = Set(StoredKey.allCases.filter(keys.has))
      // Read the provider the key is for straight away.
      let provider: ProviderId
      switch key {
      case .openrouter: provider = .openrouter
      case .deepseek: provider = .deepseek
      case .devin: provider = .devin
      case .claudeConsole: provider = .claude
      }
      self?.engine.refreshProvider(MeterId(provider))
    }
    settingsModel.onScanAccounts = { [weak self] in self?.scanAccounts() }
    settingsModel.onCheckAccount = { [weak self] provider, path in
      checkAccountFolder(provider, path: path, existing: self?.settings.accounts ?? [])
    }
  }

  public func start() {
    NSApp.applicationIconImage = BrandIcon.image()
    menus = Menus(handlers: self)
    let status = StatusItemController(settings: settings)
    status.commands = { [weak self] in self?.menus?.contextMenu() ?? NSMenu() }
    status.onPanelOpened = { [weak self] in self?.engine.noteInteraction() }
    statusItem = status
    settingsModel.appearance = systemAppearance
    pushToDock()
    if settings.presence.showsDock { dock.show() }
    engine.start()
    updater.syncSchedule()
    if firstRun { openSettings(.onboarding) }
  }

  public func stop() {
    // A save still waiting is written now, so quitting keeps the last readings.
    if historySave != nil, historySave?.isCancelled == false {
      historySave?.cancel()
      store.save(HistoryTuning.file, history)
    }
    engine.stop()
    updater.stop()
    dock.hide()
  }

  private var systemAppearance: HudAppearance {
    NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? .dark : .light
  }

  private func stateChanged(_ state: ShellState) {
    pushToDock()
    settingsModel.snapshots = state.snapshots
    alertOnChanges(state.snapshots)
    recordReadings(state.snapshots)
  }

  /// Adds the readings to the history when they changed, and writes it down
  /// a little later, off the main thread, however often they change.
  private func recordReadings(_ snapshots: [UsageSnapshot]) {
    guard snapshots != recordedSnapshots else { return }
    recordedSnapshots = snapshots
    let recorded = recordHistory(history, snapshots, now: Date())
    guard recorded != history else { return }
    history = recorded
    // Only an open settings window needs it as it changes.
    if settingsWindow.window?.isVisible == true { settingsModel.history = recorded }
    historySave?.cancel()
    let store = store
    let save = DispatchWorkItem { DispatchQueue.global(qos: .utility).async { store.save(HistoryTuning.file, recorded) } }
    historySave = save
    DispatchQueue.main.asyncAfter(deadline: .now() + HistoryTuning.saveDelaySeconds, execute: save)
  }


  private func pushToDock() {
    dock.update(
      state: engine.state, notices: engine.state.notices, keepOpen: keepOpen,
      demoNow: nil
    )
    let state = engine.state
    let arranged = presented(state.snapshots, settings, statuses: state.statuses)
    var panel = UsagePanelContent(
        snapshots: arranged, activity: state.activity, tokens: state.tokens, display: settings.usageDisplay,
        theme: resolveHudTheme(settings.hudTheme, system: systemAppearance), now: Date(),
        onRefreshAll: { [weak self] in self?.engine.refreshAll() },
        onOpenSettings: { [weak self] in self?.openSettings(.appearance) }
      )
    panel.rows = CardRows(settings) { [weak self] edit in self?.edit(edit) }
    panel.history = history
    statusItem?.update(panel)
  }

  /// Low-quota warnings and reset notices for windows that just crossed.
  /// Each window is followed even with alerts off, so turning them on
  /// later does not announce everything at once.
  private func alertOnChanges(_ snapshots: [UsageSnapshot]) {
    let result = evaluateQuotaAlerts(snapshots, thresholds: settings.effectiveThresholds, state: alertState)
    guard result.state != alertState else { return }
    alertState = result.state
    store.save(QuotaAlertRules.stateFile, result.state)
    let wanted = result.alerts.filter { alert in
      switch alert.kind {
      case .low: return settings.quotaAlerts
      case .reset: return settings.celebrateResets
      }
    }
    notifier.post(wanted)
    if wanted.contains(where: { $0.kind == .reset && $0.weekly }) { confetti.burst(on: dock.panel.screen) }
  }

  /// One edit made on a card, applied like any other change of settings.
  private func edit(_ change: (inout CapsuleSettings) -> Void) {
    var next = settings
    change(&next)
    guard next != settings else { return }
    apply(next)
  }

  /// Takes new settings from anywhere — the window, a menu, a drag — and
  /// passes on only what changed. The Electron app's `applySettings`.
  public func apply(_ next: CapsuleSettings) {
    let previous = settings
    settings = next
    Engine.saveSettings(next, to: store)
    if next.launchAtLogin != previous.launchAtLogin { LoginItem.set(next.launchAtLogin) }
    // Always shown, the dock is already held out by a setting; a hand-made
    // hold would only outlive a later switch back.
    if !next.autoHide { keepOpen = false }
    engine.apply(next)
    dock.apply(settings: next)
    statusItem?.apply(next)
    if next.presence.showsDock { dock.show() } else { dock.hide() }
    pushToDock()
    updater.autoDownload = next.autoUpdateDownload
    if next.autoUpdateCheck != previous.autoUpdateCheck {
      autoCheckBox.value = next.autoUpdateCheck
      updater.syncSchedule()
    }
    if settingsModel.settings != next { settingsModel.settings = next }
    settingsModel.appearance = systemAppearance
  }

  /// Folders under home that look like accounts not added yet.
  private func scanAccounts() {
    settingsModel.foundAccounts = discoverAccounts(
      home: userHome, entries: accountFolderEntries(), existing: settings.accounts
    )
  }

  // MARK: MenuHandlers

  public func revealDock() { dock.reveal() }

  public func toggleKeepOpen() { setKeepOpen(!keepOpen) }

  private func setKeepOpen(_ next: Bool) {
    guard keepOpen != next else { return }
    keepOpen = next
    pushToDock()
  }

  public func openSettings(_ page: SettingsPage) {
    engine.noteInteraction()
    settingsModel.appearance = systemAppearance
    settingsModel.snapshots = engine.state.snapshots
    settingsModel.history = history
    settingsWindow.show(page)
  }

  public func applyPlacement(_ preset: PlacementPreset) {
    var next = settings
    next.placementPreset = preset
    next.customPosition = nil
    next.customCorner = nil
    apply(next)
  }

  public func checkForUpdates() { updater.check() }

  public func installUpdate() { updater.install() }
}

/// A flag the updater's timer reads from its own closure.
final class LockedFlag: @unchecked Sendable {
  private let lock: OSAllocatedUnfairLock<Bool>

  init(_ value: Bool) { lock = OSAllocatedUnfairLock(initialState: value) }

  var value: Bool {
    get { lock.withLock { $0 } }
    set { lock.withLock { $0 = newValue } }
  }
}
