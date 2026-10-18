import CapsuleCore
import Foundation

/// When an activity notice pops up on the dock, and for how long. The host
/// owns the notices themselves; this owns only their presentation. A port of
/// `useActivityNotices`.
@MainActor
public final class NoticePresenter {
  private let clock: DockClock
  /// Marks notices read on the host.
  public var onRead: (([String]) -> Void)?
  /// Something visible changed.
  public var onChange: (() -> Void)?

  public private(set) var notices: [ActivityNotice] = []
  private var autoPopups = true
  private var shownProvider: ProviderId?
  private var hovered = false
  private var seen: Set<String> = []
  private var remainingMs = NoticePresentation.visibleMs
  private var visibleTimer: DockTimer?
  private var visibleStarted = 0.0
  private var readTimer: DockTimer?
  private var readKey = ""
  private var visibleKey = ""

  public init(clock: DockClock) {
    self.clock = clock
  }

  // MARK: What the dock reads

  /// The provider whose notices are showing, if any are.
  public var providerId: ProviderId? { visible.isEmpty ? nil : shownProvider }
  public var visible: [ActivityNotice] { notices.filter { $0.providerId == shownProvider } }
  public var unread: [ActivityNotice] { notices.filter { $0.read != true } }
  public var waiting: [ActivityNotice] { notices.filter { $0.kind == .waiting } }
  public func hasNotices(_ id: ProviderId) -> Bool { notices.contains { $0.providerId == id } }
  public func unreadCount(_ id: ProviderId) -> Int {
    notices.filter { $0.providerId == id && $0.read != true }.count
  }

  // MARK: What the host and the dock tell it

  public func update(_ next: [ActivityNotice], autoPopups popups: Bool) {
    let fresh = next.filter { !seen.contains($0.id) && $0.read != true }
    seen = Set(next.map(\.id))
    notices = next
    if autoPopups != popups {
      autoPopups = popups
      if !popups { shownProvider = nil }
    }
    if let newest = fresh.last, autoPopups {
      shownProvider = newest.providerId
      restartVisibleTime()
    }
    reconcile()
  }

  /// The pointer is over the notice card: hold it open and start reading.
  public func pause() {
    hovered = true
    reconcile()
  }

  public func resume() {
    hovered = false
    reconcile()
  }

  /// The host's hit test says the pointer has left the dock.
  public func pointerLeft() {
    hovered = false
    reconcile()
  }

  public func close() {
    shownProvider = nil
    reconcile()
  }

  /// Opens a provider's notices on request, marking them read.
  @discardableResult
  public func reopen(_ id: ProviderId) -> Bool {
    guard notices.contains(where: { $0.providerId == id }) else { return false }
    onRead?(notices.filter { $0.providerId == id && $0.read != true }.map(\.id))
    shownProvider = id
    restartVisibleTime()
    reconcile()
    return true
  }

  // MARK: Timers

  private func restartVisibleTime() {
    remainingMs = NoticePresentation.visibleMs
    visibleTimer?.cancel()
    visibleTimer = nil
    visibleKey = ""
  }

  /// Re-derives both timers from the current state, as the hook's effects do.
  private func reconcile() {
    let shown = visible
    // Reading: a second under the pointer marks what is showing as read.
    let unreadIds = shown.filter { $0.read != true }.map(\.id)
    let key = hovered ? unreadIds.joined(separator: "\n") : ""
    if key != readKey {
      readTimer?.cancel()
      readTimer = nil
      readKey = key
      if !key.isEmpty {
        readTimer = clock.after(NoticePresentation.readDelayMs) { [weak self] in
          self?.onRead?(unreadIds)
        }
      }
    }
    // Showing: counts down while nobody is looking, and resumes where it
    // stopped rather than starting again.
    let running = shownProvider != nil && !shown.isEmpty && !hovered
    let showKey = running ? shown.map(\.id).joined(separator: "\n") : ""
    if showKey != visibleKey {
      if let timer = visibleTimer, timer.isPending {
        timer.cancel()
        remainingMs = max(0, remainingMs - (clock.nowMs - visibleStarted))
      }
      visibleTimer = nil
      visibleKey = showKey
      if running {
        visibleStarted = clock.nowMs
        visibleTimer = clock.after(remainingMs) { [weak self] in
          guard let self else { return }
          self.shownProvider = nil
          self.visibleKey = ""
          self.reconcile()
          self.onChange?()
        }
      }
    }
    onChange?()
  }
}
