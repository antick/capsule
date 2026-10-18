import AppKit
import CapsuleCore
import CapsuleSystem

/// One update schedule; the machine-facing service owns Sparkle.
@MainActor
public final class Updater {
  private let service: UpdateService
  public var state: UpdateState { service.state }
  public var onChange: ((UpdateState) -> Void)? {
    get { service.onChange }
    set { service.onChange = newValue }
  }
  public var onFocus: (() -> Void)? {
    get { service.onFocus }
    set { service.onFocus = newValue }
  }
  public var autoDownload: Bool {
    get { service.autoDownload }
    set { service.autoDownload = newValue }
  }
  private let autoCheck: () -> Bool
  private var launchTimer: Timer?
  private var dailyTimer: Timer?

  public init(version: String, autoCheck: @escaping () -> Bool) {
    service = UpdateService(version: version)
    self.autoCheck = autoCheck
  }

  public func syncSchedule() {
    launchTimer?.invalidate()
    dailyTimer?.invalidate()
    launchTimer = nil
    dailyTimer = nil
    guard AppIdentity.channel.allowsUpdates, autoCheck() else { return }
    launchTimer = Timer.scheduledTimer(withTimeInterval: UpdateTiming.launchDelayMs / 1000, repeats: false) {
      [weak self] _ in MainActor.assumeIsolated { self?.check() }
    }
    dailyTimer = Timer.scheduledTimer(withTimeInterval: UpdateTiming.intervalMs / 1000, repeats: true) {
      [weak self] _ in MainActor.assumeIsolated { self?.check() }
    }
  }

  public func stop() {
    launchTimer?.invalidate()
    dailyTimer?.invalidate()
    service.stop()
  }

  public func check() { service.check() }
  public func download() { service.download() }
  public func install() { service.install() }

  public func openReleasePage() {
    guard let url = URL(string: releaseURL(for: state.availableVersion)) else { return }
    NSWorkspace.shared.open(url)
  }
}
