import AppKit
import CapsuleCore

extension DockView {
  /// Where the pointer is, from the host's own tracking: called for every
  /// move anywhere on screen, since a click-through window hears nothing.
  /// `point` is in this view's coordinates, nil when it is nowhere near.
  public func pointer(at point: CGPoint?) {
    let slop = Motion.hoverSlop
    let inside = point.map { p in hitRects.contains { $0.insetBy(dx: -slop, dy: -slop).contains(p) } } ?? false
    behavior.pointer(inside: inside || moving)
    guard inside, let point, !moving else {
      hoveredMeter = nil
      if overCard {
        overCard = false
        behavior.cardLeft()
      }
      return
    }
    let meter = meterAt(point)
    if let meter, meter != hoveredMeter { behavior.meterEntered(meter) }
    hoveredMeter = meter
    let onCard = cardInteractive && cardView.frame.contains(point)
    if onCard != overCard {
      overCard = onCard
      onCard ? behavior.cardEntered() : behavior.cardLeft()
    }
  }

  /// Whether the pointer is over something the dock answers.
  public func answers(_ point: CGPoint) -> Bool {
    let slop = Motion.hoverSlop
    return hitRects.contains { $0.insetBy(dx: -slop, dy: -slop).contains(point) }
  }

  func meterAt(_ point: CGPoint) -> ProviderId? {
    let local = railView.convert(point, from: self)
    return meters.first { $0.frame.contains(local) }?.providerId
  }

  func badgeAt(_ point: CGPoint) -> ProviderId? {
    for meter in meters where !meter.badge.isHidden {
      let local = meter.badge.convert(point, from: self)
      if meter.badge.bounds.contains(local) { return meter.providerId }
    }
    return nil
  }

  public override func hitTest(_ point: NSPoint) -> NSView? {
    let local = convert(point, from: superview)
    guard answers(local) else { return nil }
    if cardInteractive, cardView.frame.contains(local), let hit = super.hitTest(point), hit !== self {
      return hit
    }
    return self
  }

  public override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

  /// Where an event happened, on screen.
  func screenPoint(_ event: NSEvent) -> NSPoint {
    window?.convertPoint(toScreen: event.locationInWindow) ?? NSEvent.mouseLocation
  }

  /// The cursor for where the pointer is: a pointing hand on a meter or a
  /// badge, an open hand on the rail, which can be dragged.
  public override func mouseMoved(with event: NSEvent) {
    guard !moving else { return }
    let point = convert(event.locationInWindow, from: nil)
    (badgeAt(point) != nil || meterAt(point) != nil ? NSCursor.pointingHand : NSCursor.openHand).set()
  }

  public override func mouseDown(with event: NSEvent) {
    NSCursor.closedHand.set()
    let point = convert(event.locationInWindow, from: nil)
    pressStart = screenPoint(event)
    moving = false
    if let id = badgeAt(point) {
      pressTarget = .badge(id)
    } else if let id = meterAt(point) {
      pressTarget = .meter(id)
    } else {
      pressTarget = .rail
    }
    onPressedChange?(true)
  }

  public override func mouseDragged(with event: NSEvent) {
    guard let start = pressStart else { return }
    let at = screenPoint(event)
    if !moving {
      guard hypot(at.x - start.x, at.y - start.y) >= Motion.dragThreshold else { return }
      moving = true
      behavior.dragBegan()
      onMoveStart?(start)
    }
    onMove?(at)
  }

  public override func mouseUp(with event: NSEvent) {
    defer {
      NSCursor.openHand.set()
      pressStart = nil
      moving = false
      onPressedChange?(false)
      behavior.pressEnded()
    }
    if moving {
      onMoveEnd?()
      behavior.dragEnded()
      return
    }
    switch pressTarget {
    case .badge(let id): behavior.noticeBadgeClicked(id)
    case .meter(let id): behavior.meterClicked(id)
    case .rail: behavior.railClicked()
    }
  }

  public override func rightMouseDown(with event: NSEvent) {
    onContextMenu?(event)
  }
}
