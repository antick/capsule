import AppKit
import CapsuleCore
import CapsuleHUD

extension DockView {
  // MARK: Frame loop

  func startLink() {
    guard link == nil else { return }
    if reduceMotion {
      settle()
      return
    }
    let next = displayLink(target: self, selector: #selector(step(_:)))
    next.add(to: .main, forMode: .common)
    link = next
    lastStep = nil
  }

  private func stopLink() {
    link?.invalidate()
    link = nil
    lastStep = nil
  }

  @objc private func step(_ sender: CADisplayLink) {
    let time = sender.timestamp
    let dt = lastStep.map { time - $0 } ?? 1.0 / 60
    lastStep = time
    openness.step(Springs.unfold, toward: targets.openness, seconds: dt)
    join.step(Springs.glide, toward: targets.joinOffset, seconds: dt)
    along.step(Springs.glide, toward: targets.cardAlong, seconds: dt)
    let nowMs = CACurrentMediaTime() * 1000
    if scaleTween == nil {
      revealScale.step(Springs.unfold, toward: revealed ? 1 : Motion.closedBubbleScale, seconds: dt)
    }
    let settled =
      openness.settled(at: targets.openness, scale: 1)
      && join.settled(at: targets.joinOffset, scale: targets.joinOffset)
      && along.settled(at: targets.cardAlong, scale: targets.cardAlong)
      && (scaleTween.map { $0.done(at: nowMs) } ?? revealScale.settled(at: revealed ? 1 : Motion.closedBubbleScale, scale: 1))
      && revealOpacity.done(at: nowMs)
    if settled {
      openness.value = targets.openness
      join.value = targets.joinOffset
      along.value = targets.cardAlong
      if scaleTween == nil { revealScale.value = revealed ? 1 : Motion.closedBubbleScale }
    }
    draw()
    if settled { stopLink() }
  }

  // MARK: Drawing

  func draw() {
    let spec = look.spec
    let motion = FrameMotion(
      openness: min(1, max(0, openness.value)), joinOffset: join.value, cardAlong: max(0, along.value)
    )
    let frame = frameLayout(spec, motion)
    current = frame
    let nowMs = CACurrentMediaTime() * 1000
    let scale = currentScale(at: nowMs)
    let opacity = Float(revealOpacity.value(at: nowMs))
    let folding = motion.openness < 1

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for layer in [ambient, contact] { layer.frame = bounds }
    for shape in [railShape, railEdge] {
      shape.bounds = bounds
      shape.path = frame.rail
    }
    // Picked up, the rail rises a touch off the edge it was resting on.
    let lift = behavior.dragging ? scaled(about: railOrigin(frame), by: Motion.liftScale) : CATransform3DIdentity
    railShape.transform = lift
    railEdge.transform = lift
    railEdge.isHidden = !(spec.style.outline || (folding && spec.joined == nil))
    railEdge.opacity = spec.style.outline ? 1 : Float(1 - motion.openness)

    let tip = frame.tip
    for shape in [bubbleShape, bubbleEdge] {
      shape.bounds = bounds
      shape.path = frame.bubble
      shape.transform = scaled(about: tip, by: scale)
      shape.opacity = opacity
    }
    bubbleEdge.isHidden = !spec.style.outline

    cardView.frame = frame.card
    cardView.layer?.transform = scaled(
      about: CGPoint(x: tip.x - frame.card.minX, y: tip.y - frame.card.minY), by: scale
    )
    cardView.alphaValue = CGFloat(opacity)
    cardView.isHidden = opacity <= 0

    railView.frame = frame.railBox
    if folding {
      railMask.frame = railView.bounds
      railMask.path = frame.railClip
      railView.layer?.mask = railMask
    } else {
      railView.layer?.mask = nil
    }
    drawBeacon(frame: frame, openness: motion.openness)
    CATransaction.commit()
  }

  /// A dot on the folded dock while an agent works or waits, so the glance
  /// works while the dock is hidden, which is when it matters most.
  private func drawBeacon(frame: FrameLayout, openness: Double) {
    guard let state = behavior.beacon, openness < 1 else {
      beacon.isHidden = true
      beaconHalo.removeAllAnimations()
      return
    }
    let m = look.spec.metrics
    let color = activityColor(state, theme: look.theme).cgColor
    let center = CGPoint(x: frame.latch.midX, y: frame.latch.midY)
    beacon.isHidden = false
    beacon.frame = bounds
    beacon.opacity = Float(1 - openness)
    func circle(_ radius: Double) -> CGPath {
      CGPath(
        ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2),
        transform: nil
      )
    }
    beaconDot.path = circle(m.beaconSize / 2)
    beaconDot.fillColor = color
    beaconHalo.isHidden = state != .waiting
    beaconHalo.path = circle(m.beaconSize)
    beaconHalo.fillColor = color
    if state == .waiting, beaconHalo.animation(forKey: "pulse") == nil, !reduceMotion {
      beaconHalo.add(pulse(), forKey: "pulse")
    }
  }
}

extension DockView {
  /// The middle of the rail's edge-facing side: what a lifted rail grows from.
  func railOrigin(_ frame: FrameLayout) -> CGPoint {
    let box = frame.railBox
    switch look.spec.growth {
    case .left: return CGPoint(x: box.maxX, y: box.midY)
    case .right: return CGPoint(x: box.minX, y: box.midY)
    case .up: return CGPoint(x: box.midX, y: box.maxY)
    case .down: return CGPoint(x: box.midX, y: box.minY)
    }
  }
}

/// Scales about a point rather than about the layer's anchor.
func scaled(about point: CGPoint, by scale: Double) -> CATransform3D {
  var transform = CATransform3DMakeTranslation(point.x, point.y, 0)
  transform = CATransform3DScale(transform, scale, scale, 1)
  return CATransform3DTranslate(transform, -point.x, -point.y, 0)
}
