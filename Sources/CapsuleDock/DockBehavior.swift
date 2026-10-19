import CapsuleCore
import CapsuleUsage
import Foundation

/// What the dock is showing and why: hover, pin, auto-hide, reveal, drag and
/// notices, with their delays. A port of `UsageDock`'s state and handlers;
/// the view reads the derived values and reports pointer events.
@MainActor
public final class DockBehavior {
  public struct Inputs: Equatable {
    public var snapshots: [UsageSnapshot] = []
    public var activity: [ProviderId: [AgentSession]] = [:]
    public var tokens: [ProviderId: TokenUsage] = [:]
    public var autoHide = false
    public var hideDelayMs = Motion.peekHoldMs
    /// Held out by a gesture or a menu, so it stays unrolled.
    public var keepOpen = false
    public var notificationPopups = true
    /// A card to show regardless, for the settings preview.
    public var forceOpen: MeterId?

    public init() {}
  }

  public let notices: NoticePresenter
  private let clock: DockClock
  public private(set) var inputs = Inputs()

  /// Something the view draws changed.
  public var onChange: (() -> Void)?
  public var onKeepOpenChange: ((Bool) -> Void)?
  /// The user asked for a provider to be read again.
  public var onRefresh: ((MeterId) -> Void)?

  public private(set) var hovered: MeterId?
  public private(set) var pinned: MeterId?
  public private(set) var woken = false
  public private(set) var held = false
  public private(set) var dragging = false
  /// Set for the rest of a gesture that moved the dock, so its click is not
  /// taken as a click.
  private var didDrag = false
  private var pointerInside: Bool?
  private var lastCard: UsageSnapshot?
  private var lastNotices: [ActivityNotice] = []
  private var openTimer: DockTimer?
  private var closeTimer: DockTimer?
  private var peekTimer: DockTimer?
  private var holdTimer: DockTimer?

  public init(clock: DockClock) {
    self.clock = clock
    notices = NoticePresenter(clock: clock)
    notices.onChange = { [weak self] in self?.changed() }
  }

  // MARK: Derived

  /// The meters shown: the readings, or the defaults' placeholders.
  public var meters: [UsageSnapshot] {
    inputs.snapshots.isEmpty ? placeholderSnapshots([], now: Date()) : inputs.snapshots
  }

  /// Retracted into the edge, showing only the latch.
  public var peek: Bool {
    inputs.autoHide && !woken && !held && !dragging && !inputs.keepOpen
      && notices.providerId == nil
      && (!inputs.notificationPopups || notices.waiting.isEmpty)
      && inputs.forceOpen == nil
  }

  /// The meter whose card is open. Notices belong to a provider's own
  /// sign-in, so they open its meter.
  public var openId: MeterId? {
    if dragging || peek { return nil }
    return notices.providerId.map { MeterId($0) } ?? inputs.forceOpen ?? pinned ?? hovered
  }

  public var openSnapshot: UsageSnapshot? {
    openId.flatMap { id in meters.first { $0.meterId == id } }
  }

  /// What the card shows: the open one, or the last one while it closes.
  public var cardSnapshot: UsageSnapshot? { openSnapshot ?? lastCard }

  /// The meter the card's tail aims at.
  public var joinIndex: Int {
    let id = openId ?? lastCard?.meterId ?? inputs.snapshots.first?.meterId
    return max(0, meters.firstIndex { $0.meterId == id } ?? 0)
  }

  /// Notices the card lists instead of readings, if any.
  public var cardNotices: [ActivityNotice] {
    openId == nil ? lastNotices : (notices.providerId != nil ? notices.visible : [])
  }

  /// Agent activity is read from each tool's default folder, so it belongs
  /// to the provider's own meter, never to an added account's.
  public var cardSessions: [AgentSession] {
    cardSnapshot.flatMap { $0.accountId == nil ? inputs.activity[$0.providerId] : nil } ?? []
  }

  public var cardTokens: TokenUsage? {
    cardSnapshot.flatMap { $0.accountId == nil ? inputs.tokens[$0.providerId] : nil }
  }

  /// What a folded dock says at a glance: amber if any agent waits on you,
  /// white if any is working.
  public var beacon: ActivityState? {
    let overall = summarizeActivity(inputs.activity.values.flatMap { $0 })?.state
    if !notices.unread.isEmpty || overall == .waiting { return .waiting }
    return overall == .working ? .working : nil
  }

  // MARK: Inputs

  public func update(_ next: Inputs) {
    let autoHideTurnedOn = next.autoHide && !inputs.autoHide
    inputs = next
    // Turning auto-hide on puts the dock away rather than waiting for the
    // pointer to leave first.
    if autoHideTurnedOn { woken = false }
    changed()
  }

  public func updateNotices(_ next: [ActivityNotice]) {
    notices.update(next, autoPopups: inputs.notificationPopups)
  }

  // MARK: Pointer

  /// The host's hit test: the authority on the pointer leaving, since a
  /// click-through window raises no exit event.
  public func pointer(inside: Bool) {
    guard inside != pointerInside else { return }
    pointerInside = inside
    if inside {
      if !dragging { clearTimers() }
      wake()
    } else {
      notices.pointerLeft()
      leave()
    }
    changed()
  }

  public func meterEntered(_ id: MeterId) {
    if dragging || didDrag { return }
    clearTimers()
    notices.close()
    if Motion.hoverOpenDelayMs <= 0 {
      hovered = id
    } else {
      openTimer = clock.after(Motion.hoverOpenDelayMs) { [weak self] in
        self?.hovered = id
        self?.changed()
      }
    }
    changed()
  }

  public func meterClicked(_ id: MeterId) {
    if didDrag {
      didDrag = false
      return
    }
    notices.close()
    wake()
    pinned = pinned == id ? nil : id
    hovered = id
    // Asking for a provider re-reads it.
    onRefresh?(id)
    changed()
  }

  public func noticeBadgeClicked(_ id: ProviderId) {
    clearTimers()
    wake()
    pinned = nil
    hovered = nil
    notices.reopen(id)
    changed()
  }

  public func cardEntered() {
    guard !dragging else { return }
    clearTimers()
    if notices.providerId != nil {
      notices.pause()
    } else if let id = cardSnapshot?.meterId {
      hovered = id
    }
    changed()
  }

  public func cardLeft() { notices.resume() }

  /// A click on the rail itself holds an auto-hiding dock out, or lets it go.
  public func railClicked() {
    if didDrag || !inputs.autoHide { return }
    onKeepOpenChange?(!inputs.keepOpen)
  }

  // MARK: Drag

  public func dragBegan() {
    didDrag = true
    notices.close()
    pinned = nil
    hovered = nil
    clearTimers()
    dragging = true
    changed()
  }

  public func dragEnded() {
    dragging = false
    changed()
  }

  /// The press that started a gesture is over; a click after it is a click.
  public func pressEnded() {
    let wasDrag = didDrag
    DispatchQueue.main.async { [weak self] in
      MainActor.assumeIsolated {
        if wasDrag { self?.didDrag = false }
      }
    }
  }

  // MARK: Reveal

  /// "Show Dock": unroll and stay put for a beat, then go back to whatever
  /// the cursor says.
  public func reveal() {
    peekTimer?.cancel()
    holdTimer?.cancel()
    woken = true
    held = true
    holdTimer = clock.after(Motion.revealHoldMs) { [weak self] in
      guard let self else { return }
      self.held = false
      if self.pointerInside != true { self.woken = false }
      self.changed()
    }
    changed()
  }

  // MARK: Helpers

  private func clearTimers() {
    openTimer?.cancel()
    closeTimer?.cancel()
    peekTimer?.cancel()
  }

  private func wake() {
    peekTimer?.cancel()
    woken = true
  }

  /// The cursor has gone. Unlike a hover-out this also drops a pin: a pin
  /// that survived leaving would strand the card open.
  private func leave() {
    if dragging { return }
    pinned = nil
    clearTimers()
    closeTimer = clock.after(Motion.hoverCloseDelayMs) { [weak self] in
      self?.hovered = nil
      self?.changed()
    }
    if inputs.autoHide && !held && !inputs.keepOpen {
      peekTimer = clock.after(inputs.hideDelayMs) { [weak self] in
        self?.woken = false
        self?.changed()
      }
    }
  }

  private func changed() {
    if let open = openSnapshot { lastCard = open }
    if openId != nil { lastNotices = notices.providerId != nil ? notices.visible : [] }
    onChange?()
  }
}
