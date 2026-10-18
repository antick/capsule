import AppKit
import CapsuleCore
import Sparkle

/// Sparkle owns verification and app replacement; Capsule owns the settings UI.
@MainActor
public final class UpdateService: NSObject, SPUUserDriver, SPUUpdaterDelegate {
  public private(set) var state: UpdateState
  public var onChange: ((UpdateState) -> Void)?
  public var onFocus: (() -> Void)?
  public var autoDownload = false
  private var updater: SPUUpdater?
  private var choice: ((SPUUserUpdateChoice) -> Void)?
  private var cancelCheck: (() -> Void)?
  private var watchdog: Timer?
  private var received = 0.0
  private var expected = 0.0
  private var informationOnly = false

  public init(version: String, channel: AppChannel = AppIdentity.channel) {
    state = .initial(version: version, canInstall: channel.allowsUpdates)
    super.init()
    guard channel.allowsUpdates else { return }
    let updater = SPUUpdater(hostBundle: .main, applicationBundle: .main, userDriver: self, delegate: self)
    self.updater = updater
    // Capsule owns the schedule, so there are never two sets of timers.
    updater.automaticallyChecksForUpdates = false
    updater.automaticallyDownloadsUpdates = false
    do { try updater.start() } catch { fail(error) }
  }

  public func check() {
    guard let updater, state.canCheck else { return }
    updater.checkForUpdates()
  }

  public func download() {
    guard state.phase == .available, !informationOnly else { return }
    respond(.install)
  }

  public func install() {
    guard state.phase == .ready else { return }
    respond(.install)
  }

  public func stop() {
    watchdog?.invalidate()
    cancelCheck?()
    cancelCheck = nil
  }

  private func respond(_ response: SPUUserUpdateChoice) {
    let reply = choice
    choice = nil
    reply?(response)
  }

  private func publish(_ change: (inout UpdateState) -> Void) {
    change(&state)
    onChange?(state)
  }

  private func checked() {
    watchdog?.invalidate()
    watchdog = nil
    cancelCheck = nil
    publish { $0.checkedAt = isoString(Date()) }
  }

  private func fail(_ error: Error) {
    checked()
    choice = nil
    publish { $0.phase = .error; $0.error = error.localizedDescription; $0.progress = nil }
  }

  public func show(_ request: SPUUpdatePermissionRequest,
                                         reply: @escaping (SUUpdatePermissionResponse) -> Void) {
    reply(SUUpdatePermissionResponse(automaticUpdateChecks: false, sendSystemProfile: false))
  }

  public func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) {
    cancelCheck = cancellation
    publish { $0.phase = .checking; $0.error = nil; $0.progress = nil }
    watchdog?.invalidate()
    watchdog = Timer.scheduledTimer(withTimeInterval: UpdateTiming.timeoutMs / 1000, repeats: false) {
      [weak self] _ in MainActor.assumeIsolated {
        guard let self, self.state.phase == .checking else { return }
        let cancel = self.cancelCheck
        self.checked()
        cancel?()
        self.publish { $0.phase = .error; $0.error = UpdateCopy.timedOut }
      }
    }
  }

  public func showUpdateFound(with appcastItem: SUAppcastItem, state update: SPUUserUpdateState,
                              reply: @escaping (SPUUserUpdateChoice) -> Void) {
    checked()
    informationOnly = appcastItem.isInformationOnlyUpdate
    choice = reply
    publish {
      $0.phase = update.stage == .installing ? .ready : .available
      $0.availableVersion = appcastItem.displayVersionString
      $0.releaseNotes = plainReleaseNotes(appcastItem.itemDescription.map(JSONValue.string))
      $0.canInstall = !informationOnly
      $0.error = nil
    }
    if informationOnly {
      respond(.dismiss)
    } else if autoDownload && update.stage != .installing {
      download()
    }
  }

  public func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {
    let text = String(data: downloadData.data, encoding: .utf8)
    publish { $0.releaseNotes = plainReleaseNotes(text.map(JSONValue.string)) }
  }

  public func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) {
    // Release notes are optional; failure does not invalidate a signed archive.
  }

  public func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) {
    checked()
    let reason = (error as NSError).userInfo[SPUNoUpdateFoundReasonKey] as? NSNumber
    if reason?.intValue != Int(SPUNoUpdateFoundReason.onLatestVersion.rawValue) &&
       reason?.intValue != Int(SPUNoUpdateFoundReason.onNewerThanLatestVersion.rawValue) {
      fail(error)
      acknowledgement()
      return
    }
    publish {
      $0.phase = .current; $0.availableVersion = nil; $0.releaseNotes = nil; $0.error = nil
    }
    acknowledgement()
  }

  public func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) {
    fail(error)
    acknowledgement()
  }

  public func showDownloadInitiated(cancellation: @escaping () -> Void) {
    received = 0; expected = 0
    publish { $0.phase = .downloading; $0.error = nil; $0.progress = nil }
  }

  public func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) {
    expected = Double(expectedContentLength)
    progress()
  }

  public func showDownloadDidReceiveData(ofLength length: UInt64) {
    received += Double(length)
    progress()
  }

  private func progress() {
    publish {
      $0.progress = UpdateProgress(fraction: expected > 0 ? min(1, received / expected) : 0,
                                  transferredBytes: received, totalBytes: expected, bytesPerSecond: 0)
    }
  }

  public func showDownloadDidStartExtractingUpdate() {
    publish { $0.phase = .downloading; $0.progress = nil }
  }

  public func showExtractionReceivedProgress(_ progress: Double) {}

  public func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) {
    choice = reply
    publish { $0.phase = .ready; $0.progress = nil }
  }

  public func showInstallingUpdate(withApplicationTerminated applicationTerminated: Bool,
                                   retryTerminatingApplication: @escaping () -> Void) {
    publish { $0.phase = .downloading; $0.progress = nil }
  }

  public func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) {
    acknowledgement()
  }

  public func dismissUpdateInstallation() {
    choice = nil
    watchdog?.invalidate()
    cancelCheck = nil
  }

  public func showUpdateInFocus() { onFocus?() }

  public func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
    let error = error as NSError
    // The user driver already reports the no-update reason, including OS constraints.
    guard error.domain != SUSparkleErrorDomain || error.code != SUError.noUpdateError.rawValue else { return }
    fail(error)
  }
}
