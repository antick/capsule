import AppKit
import CapsuleCore
import CapsuleHUD
import SwiftUI

/// What the dock looks like, apart from what its behaviour says.
public struct DockLook: Equatable {
  public var spec: FrameSpec
  public var theme: HudTheme
  public var display: UsageDisplay
  /// A frozen clock for demo mode; nil reads the real one.
  public var demoNow: Date?

  public init(spec: FrameSpec, theme: HudTheme, display: UsageDisplay, demoNow: Date? = nil) {
    self.spec = spec
    self.theme = theme
    self.display = display
    self.demoNow = demoNow
  }
}

/// The dock: one silhouette — rail, tail and card — under a shared shadow,
/// the meters on the rail, and the card's contents. The fold, the tail's
/// glide, the card's height and its reveal are springs stepped once per
/// display frame, and the outline is traced again on each step, because the
/// shape changes rather than merely moving.
@MainActor
public final class DockView: FlippedView {
  public let behavior: DockBehavior
  public private(set) var look: DockLook
  /// Areas that answer the mouse, in this view's coordinates.
  public private(set) var hitRects: [CGRect] = []
  public var onHitRectsChange: (() -> Void)?
  public var onPressedChange: ((Bool) -> Void)?
  /// A drag began, moved, or ended, at a point on screen.
  public var onMoveStart: ((NSPoint) -> Void)?
  public var onMove: ((NSPoint) -> Void)?
  public var onMoveEnd: (() -> Void)?
  public var onContextMenu: ((NSEvent) -> Void)?
  public var onDismissNotice: ((String) -> Void)?
  public var onClearNotices: (() -> Void)?

  let ambient = CALayer()
  let contact = CALayer()
  let railShape = CAShapeLayer()
  let railEdge = CAShapeLayer()
  let bubbleShape = CAShapeLayer()
  let bubbleEdge = CAShapeLayer()
  let beacon = CALayer()
  let beaconHalo = CAShapeLayer()
  let beaconDot = CAShapeLayer()
  let railView = FlippedView()
  let railMask = CAShapeLayer()
  let cardView = FlippedView()
  let hosting = CardHost(rootView: AnyView(EmptyView()))
  var meters: [MeterView] = []
  var meterKey = ""

  var openness = SpringState(value: 1)
  var join = SpringState(value: 0)
  var along = SpringState(value: 0)
  var revealScale = SpringState(value: Motion.closedBubbleScale)
  var scaleTween: Tween?
  var revealOpacity = Tween(value: 0)
  var revealed = false
  var targets = FrameMotion(openness: 1, joinOffset: 0, cardAlong: 0)
  var link: CADisplayLink?
  var lastStep: CFTimeInterval?
  var current: FrameLayout?
  /// Pointer bookkeeping for the input half.
  var pressStart: NSPoint?
  var pressTarget: PressTarget = .rail
  var moving = false
  var hoveredMeter: ProviderId?
  var overCard = false

  enum PressTarget { case rail, meter(ProviderId), badge(ProviderId) }

  public init(look: DockLook, behavior: DockBehavior) {
    self.look = look
    self.behavior = behavior
    super.init(frame: .zero)
    for layer in [ambient, contact] { layer.masksToBounds = false }
    layer?.addSublayer(ambient)
    ambient.addSublayer(contact)
    for shape in [railShape, bubbleShape] { contact.addSublayer(shape) }
    for edge in [railEdge, bubbleEdge] {
      edge.fillColor = nil
      edge.lineWidth = ShellTuning.outlineWidth
      contact.addSublayer(edge)
    }
    for shape in [railShape, railEdge, bubbleShape, bubbleEdge, beaconHalo, beaconDot] {
      shape.anchorPoint = .zero
      shape.position = .zero
    }
    beacon.addSublayer(beaconHalo)
    beacon.addSublayer(beaconDot)
    contact.addSublayer(beacon)
    cardView.layer?.masksToBounds = true
    cardView.addSubview(hosting)
    addSubview(cardView)
    addSubview(railView)
    railMask.fillColor = NSColor.black.cgColor
    behavior.onChange = { [weak self] in self?.refresh() }
    applyLook()
  }

  public func update(look next: DockLook) {
    guard next != look else { return }
    // Meters are rebuilt only for what they draw themselves; a drag that
    // only slides the rail must not throw away their animations.
    let meterLook =
      next.spec.metrics != look.spec.metrics || next.theme != look.theme
      || next.spec.compact != look.spec.compact
    look = next
    if meterLook { meterKey = "" }
    applyLook()
  }

  /// Snaps every spring to where it is heading, for a first frame or a
  /// placement change that should not animate.
  public func settle() {
    refresh()
    openness.value = targets.openness
    join.value = targets.joinOffset
    along.value = targets.cardAlong
    for state in [\DockView.openness, \.join, \.along] { self[keyPath: state].velocity = 0 }
    revealScale = SpringState(value: revealed ? 1 : Motion.closedBubbleScale)
    scaleTween = nil
    revealOpacity = Tween(value: revealed ? 1 : 0)
    draw()
  }

  /// The view's whole size: the dock's frame plus its shadow gutter.
  public var frameSize: CGSize { frameLayout(look.spec, targets).size }

  private func applyLook() {
    let m = look.spec.metrics
    let theme = look.theme
    setFrameSize(frameSize)
    for shape in [railShape, bubbleShape] { shape.fillColor = theme.surface.cgColor }
    for edge in [railEdge, bubbleEdge] { edge.strokeColor = theme.surfaceEdge.cgColor }
    // Two casts: a tight contact shadow and a wide, faint ambient one. Both
    // scale with the dock, so the lighting is the same at every size.
    func px(_ value: Double) -> Double { jsRound(value * m.unit) }
    contact.shadowColor = theme.shadowContact.with(alpha: 1).cgColor
    contact.shadowOpacity = Float(theme.shadowContact.alpha)
    contact.shadowOffset = CGSize(width: 0, height: px(Motion.shadowContactDy))
    contact.shadowRadius = px(Motion.shadowContactBlur) / 2
    ambient.shadowColor = theme.shadow.with(alpha: 1).cgColor
    ambient.shadowOpacity = Float(theme.shadow.alpha)
    ambient.shadowOffset = CGSize(width: 0, height: px(Motion.shadowDy))
    ambient.shadowRadius = px(Motion.shadowBlur) / 2
    cardView.layer?.cornerRadius = m.cardRadius
    refresh()
    layoutMeters()
    settle()
  }

  // MARK: State to targets

  func refresh() {
    let b = behavior
    let spec = look.spec
    let m = spec.metrics
    let readings = b.meters
    rebuildMeters(readings)
    let shift = stowShift(m, spec.growth)
    let summaryWaiting = b.notices.waiting
    for (index, meter) in meters.enumerated() {
      guard let snapshot = readings.first(where: { $0.providerId == meter.providerId }) else { continue }
      meter.show(
        MeterState(
          providerId: snapshot.providerId, percent: snapshot.primaryPercent, display: look.display,
          active: b.openId == snapshot.providerId, compact: spec.compact,
          refreshing: snapshot.refreshing == true,
          activity: summarizeActivity(b.inputs.activity[snapshot.providerId]),
          waitingCount: summaryWaiting.filter { $0.providerId == snapshot.providerId }.count,
          unreadCount: b.notices.unreadCount(snapshot.providerId),
          hasNotices: b.notices.hasNotices(snapshot.providerId), stowed: b.peek,
          stowShift: CGPoint(x: shift.x, y: shift.y),
          revealDelayMs: min(Double(index) * Motion.meterStaggerMs, Motion.meterStaggerCapMs)
        )
      )
    }
    let visible = b.openSnapshot != nil && !b.dragging && !b.peek
    let cardHeight = dockCardHeight(
      m, snapshot: b.cardSnapshot, sessions: b.cardSessions.count, notices: b.cardNotices.count,
      tokens: b.cardTokens != nil
    )
    let spread = railEndSpread(m, readings.count, compact: spec.compact, railLength: spec.railLength)
    targets = FrameMotion(
      openness: b.peek ? 0 : 1,
      joinOffset: joinOffsetForIndex(m, b.joinIndex, compact: spec.compact) + spread,
      cardAlong: cardHeight
    )
    updateCard(height: cardHeight)
    setReveal(visible)
    updateHitRects(open: visible)
    startLink()
  }

  private func rebuildMeters(_ readings: [UsageSnapshot]) {
    let key = readings.map(\.providerId.rawValue).joined(separator: ",")
    guard key != meterKey else { return }
    meterKey = key
    for meter in meters { meter.removeFromSuperview() }
    meters = readings.map { MeterView(providerId: $0.providerId, metrics: look.spec.metrics, theme: look.theme) }
    for meter in meters { railView.addSubview(meter) }
    layoutMeters()
  }

  /// Meters centred in the rail, inside its padding, one after another.
  func layoutMeters() {
    let spec = look.spec
    let m = spec.metrics
    let box = frameLayout(spec, targets).railBox
    railView.frame = box
    let size = MeterView.size(m, compact: spec.compact)
    let insets = frameLayout(spec, targets).railInsets
    let inner = CGRect(
      x: insets.left, y: insets.top, width: box.width - insets.left - insets.right,
      height: box.height - insets.top - insets.bottom
    )
    let count = Double(meters.count)
    let stride = (spec.vertical ? size.height : size.width) + m.itemGap
    let span = count * (spec.vertical ? size.height : size.width) + (count - 1) * m.itemGap
    for (index, meter) in meters.enumerated() {
      let offset = Double(index) * stride
      meter.frame =
        spec.vertical
        ? CGRect(
          x: inner.midX - size.width / 2, y: inner.midY - span / 2 + offset, width: size.width,
          height: size.height)
        : CGRect(
          x: inner.midX - span / 2 + offset, y: inner.midY - size.height / 2, width: size.width,
          height: size.height)
    }
  }

  private func updateCard(height: Double) {
    let b = behavior
    guard let snapshot = b.cardSnapshot else { return }
    let now = look.demoNow ?? Date()
    let content = CardContent(
      snapshot: snapshot, sessions: b.cardSessions, notices: b.cardNotices, tokens: b.cardTokens,
      display: look.display, unreadCount: b.notices.unreadCount(snapshot.providerId),
      hasNotices: b.notices.hasNotices(snapshot.providerId), now: now,
      onOpenNotices: { [weak self] in self?.behavior.noticeBadgeClicked(snapshot.providerId) },
      onDismissNotice: { [weak self] id in self?.onDismissNotice?(id) },
      onClearAll: { [weak self] in self?.onClearNotices?() }
    )
    hosting.rootView = AnyView(DockCardView(content: content, m: look.spec.metrics, theme: look.theme))
    hosting.frame = CGRect(x: 0, y: 0, width: look.spec.metrics.cardWidth, height: height)
  }

  private func setReveal(_ visible: Bool) {
    guard visible != revealed else { return }
    revealed = visible
    let now = CACurrentMediaTime() * 1000
    if visible {
      // Out on the fold spring, so it arrives with momentum.
      revealScale.value = currentScale(at: now)
      scaleTween = nil
      revealOpacity.retarget(1, at: now, durationMs: Motion.openMs, easing: .out)
    } else {
      // Back in on an ease-in: a thing being absorbed accelerates as it goes.
      var tween = Tween(value: currentScale(at: now))
      tween.retarget(Motion.closedBubbleScale, at: now, durationMs: Motion.closeMs, easing: .close)
      scaleTween = tween
      revealOpacity.retarget(0, at: now, durationMs: Motion.closeMs, easing: .close)
    }
  }

  func currentScale(at nowMs: Double) -> Double { scaleTween?.value(at: nowMs) ?? revealScale.value }

  private func updateHitRects(open: Bool) {
    let spec = look.spec
    let settled = frameLayout(spec, targets)
    let zone =
      behavior.peek ? latchHotZone(spec.metrics, spec.growth, settled.blob, joined: spec.joined) : nil
    let regions = hitRegions(settled.blob, padding: settled.padding, open: open, latchZone: zone)
    let rects = (regions.rail + (regions.open.map { [$0] } ?? [])).map {
      CGRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height)
    }
    guard rects != hitRects else { return }
    hitRects = rects
    onHitRectsChange?()
  }

  /// Whether the card is showing and answers the mouse.
  var cardInteractive: Bool { revealed }
}

/// The card's SwiftUI host. Takes the first click, since the dock's app is
/// never the active one.
final class CardHost: NSHostingView<AnyView> {
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
