import AppKit
import CapsuleCore

/// What one meter shows.
public struct MeterState: Equatable {
  public var providerId: ProviderId
  /// What the meter is called, for VoiceOver: the account's label or the
  /// provider's name.
  public var label: String
  public var percent: Double?
  /// The week's share used, drawn as a second ring inside, when the dock
  /// shows session and week.
  public var inner: Double? = nil
  public var display: UsageDisplay
  public var active: Bool
  public var compact: Bool
  public var refreshing: Bool
  public var activity: ActivitySummary?
  public var waitingCount: Int
  public var unreadCount: Int
  public var hasNotices: Bool
  public var stowed: Bool
  /// An incident on the provider's status page.
  public var incident: StatusLevel? = nil
  /// Which way it slides toward the edge while stowed.
  public var stowShift: CGPoint
  public var revealDelayMs: Double
}

/// One provider's ring on the rail: the reading as an arc that sweeps to its
/// value, a chasing arc while it reloads, a thinner arc inside for what its
/// agents are doing, the mark, the percentage, and a badge for notices.
@MainActor
public final class MeterView: FlippedView {
  public let providerId: ProviderId
  public let meterId: MeterId
  private let metrics: HudMetrics
  private let theme: HudTheme
  private let ring = CALayer()
  private let track = CAShapeLayer()
  private let value = CAShapeLayer()
  private let sweep = CAShapeLayer()
  private let agent = CAShapeLayer()
  private var icon = CALayer()
  /// A dot at the ring's lower left while the provider has an incident.
  private let incident = CAShapeLayer()
  private let caption: NSTextField
  public let badge: BadgeView
  private var state: MeterState?
  /// The week, inside the session ring, when the dock shows both.
  private let innerTrack = CAShapeLayer()
  private let innerValue = CAShapeLayer()
  /// VoiceOver, or any assistive app, pressed the meter: the same as a click.
  public var onPress: (() -> Void)?

  public init(meterId: MeterId, metrics: HudMetrics, theme: HudTheme) {
    self.meterId = meterId
    self.providerId = meterId.provider
    self.metrics = metrics
    self.theme = theme
    caption = dockLabel(size: metrics.percentFontSize, color: theme.text)
    badge = BadgeView(metrics: metrics, theme: theme)
    super.init(frame: .zero)
    let size = metrics.meterSize
    let stroke = metrics.ringStroke
    let radius = (size - stroke) / 2
    ring.frame = CGRect(x: 0, y: 0, width: size, height: size)
    for shape in [track, value, sweep] {
      shape.frame = ring.bounds
      shape.path = ringPath(size: size, radius: radius)
      shape.fillColor = nil
      shape.lineWidth = stroke
      ring.addSublayer(shape)
    }
    // The week's ring sits just inside the session's, clear of the agent ring.
    let innerStroke = stroke * DualRing.strokeShare
    let innerRadius = radius - stroke / 2 - stroke * DualRing.gapShare - innerStroke / 2
    for shape in [innerTrack, innerValue] {
      shape.frame = ring.bounds
      shape.path = ringPath(size: size, radius: innerRadius)
      shape.fillColor = nil
      shape.lineWidth = innerStroke
      shape.isHidden = true
      ring.addSublayer(shape)
    }
    innerTrack.strokeColor = theme.ringTrack.cgColor
    innerValue.lineCap = .round
    innerValue.strokeEnd = 0
    track.strokeColor = theme.ringTrack.cgColor
    value.lineCap = .round
    value.strokeEnd = 0
    sweep.lineCap = .round
    sweep.strokeColor = theme.text.cgColor
    sweep.strokeEnd = Motion.sweepArc
    sweep.isHidden = true
    agent.frame = ring.bounds
    agent.path = ringPath(size: size, radius: (metrics.activitySize - metrics.activityStroke) / 2)
    agent.fillColor = nil
    agent.lineWidth = metrics.activityStroke
    agent.lineCap = .round
    agent.isHidden = true
    ring.addSublayer(agent)
    icon = iconLayer(providerId, size: metrics.iconSize, color: theme.text)
    icon.position = CGPoint(x: size / 2, y: size / 2)
    ring.addSublayer(icon)
    let dot = metrics.cardStatusDot
    incident.frame = CGRect(x: 0, y: size - dot, width: dot, height: dot)
    incident.path = CGPath(ellipseIn: CGRect(x: 0, y: 0, width: dot, height: dot), transform: nil)
    incident.strokeColor = theme.surface.cgColor
    incident.lineWidth = metrics.cardStatusStroke
    incident.isHidden = true
    ring.addSublayer(incident)
    layer?.addSublayer(ring)
    addSubview(caption)
    addSubview(badge)
    badge.isHidden = true
    setAccessibilityElement(true)
    setAccessibilityRole(.button)
  }

  public override func accessibilityPerformPress() -> Bool {
    guard let onPress else { return false }
    onPress()
    return true
  }

  /// The meter's footprint on the rail.
  public static func size(_ m: HudMetrics, compact: Bool) -> CGSize {
    CGSize(width: m.meterSize, height: compact ? m.meterSize : m.meterSize + m.meterLabelGap + m.percentBlock)
  }

  public override func layout() {
    super.layout()
    caption.frame = CGRect(
      x: -metrics.meterSize / 2, y: metrics.meterSize + metrics.meterLabelGap,
      width: metrics.meterSize * 2, height: metrics.percentBlock
    )
    let dot = metrics.cardStatusDot * 2
    badge.frame = CGRect(x: bounds.width - dot, y: 0, width: dot, height: dot)
  }

  public func show(_ next: MeterState) {
    let previous = state
    state = next
    let rounded = next.percent.map { jsRound($0) }
    // The colour always answers "how close to the wall", whichever end the
    // number is read from.
    let shown = rounded.map { next.display == .remaining ? 100 - $0 : $0 }
    let innerRounded = next.inner.map { jsRound($0) }
    let innerShown = innerRounded.map { next.display == .remaining ? 100 - $0 : $0 }
    let figures = [shown] + (next.inner == nil ? [] : [innerShown])
    let label = figures.map { $0.map { "\(jsString(.number($0)))\(Copy.percentSuffix)" } ?? Copy.noReading }
      .joined(separator: Copy.paceSeparator)
    caption.stringValue = label
    caption.isHidden = next.compact
    setAccessibilityLabel(
      ["\(next.label) \(label)", next.incident.map(Copy.label)].compactMap { $0 }.joined(separator: Copy.paceSeparator))
    incident.isHidden = next.incident == nil || next.incident == StatusLevel.none
    if let level = next.incident {
      incident.fillColor = SeverityColors.color(level.isOutage ? .critical : .mid).cgColor
    }

    // The reading sweeps to its value rather than snapping.
    let end = (shown ?? 0) / 100
    let color = rounded.map { SeverityColors.forPercent($0) } ?? theme.ringTrack
    value.isHidden = (shown ?? 0) <= 0
    if Double(value.strokeEnd) != end {
      let from = value.presentation()?.strokeEnd ?? value.strokeEnd
      value.strokeEnd = end
      value.add(springAnimation("strokeEnd", Springs.reading, from: from, to: end), forKey: "reading")
    }
    value.strokeColor = color.cgColor

    // The week, inside, sweeping the same way.
    innerTrack.isHidden = next.inner == nil
    innerValue.isHidden = (innerShown ?? 0) <= 0
    let innerEnd = (innerShown ?? 0) / 100
    if Double(innerValue.strokeEnd) != innerEnd {
      let from = innerValue.presentation()?.strokeEnd ?? innerValue.strokeEnd
      innerValue.strokeEnd = innerEnd
      innerValue.add(springAnimation("strokeEnd", Springs.reading, from: from, to: innerEnd), forKey: "reading")
    }
    innerValue.strokeColor = (innerRounded.map { SeverityColors.forPercent($0).with(alpha: DualRing.alpha) }
      ?? theme.ringTrack).cgColor

    // Pressed in while it works, released when the answer lands.
    if previous?.refreshing != next.refreshing {
      let scale = next.refreshing ? Motion.refreshPressScale : 1
      let from = ring.presentation()?.value(forKeyPath: "transform.scale") ?? 1
      ring.setValue(scale, forKeyPath: "transform.scale")
      ring.add(springAnimation("transform.scale", Springs.press, from: from, to: scale), forKey: "press")
      sweep.isHidden = !next.refreshing
      if next.refreshing, !reduceMotion {
        sweep.add(spin(Motion.sweepMs), forKey: "spin")
      } else {
        sweep.removeAnimation(forKey: "spin")
      }
    }

    // What its agents are doing: spinning while one works, breathing while
    // one waits.
    let activity = next.activity?.state
    if previous?.activity?.state != activity {
      agent.removeAllAnimations()
      agent.isHidden = activity == nil || activity == .idle
      if let activity, activity != .idle {
        agent.strokeColor = activityColor(activity, theme: theme).cgColor
        agent.strokeEnd = activity == .working ? Motion.activityArc : 1
        if !reduceMotion {
          agent.add(activity == .working ? spin(Motion.activitySpinMs) : pulse(), forKey: "activity")
        }
      }
    }

    if previous?.unreadCount != next.unreadCount {
      icon.removeAnimation(forKey: "unread")
      if next.unreadCount > 0, !reduceMotion { icon.add(pulse(), forKey: "unread") }
    }

    badge.isHidden = !next.hasNotices
    let needsInput = max(
      next.waitingCount,
      next.activity?.sessions.filter { $0.state == .waiting && $0.confirmed != false }.count ?? 0
    )
    badge.show(count: next.unreadCount, needsInput: needsInput)

    // Stowed with a retracted dock, each meter slides toward the edge and
    // fades, trailing the one before it.
    let opacity: Float = next.stowed ? 0 : next.active ? 1 : Float(Motion.meterIdleOpacity)
    let shift = next.stowed ? next.stowShift : .zero
    if previous?.stowed != next.stowed || previous?.active != next.active || previous == nil {
      guard let host = layer else { return }
      let fromOpacity = host.presentation()?.opacity ?? host.opacity
      let fromShift = host.presentation()?.value(forKeyPath: "sublayerTransform.translation") ?? NSValue(size: .zero)
      host.opacity = opacity
      host.sublayerTransform = CATransform3DMakeTranslation(shift.x, shift.y, 0)
      if previous != nil {
        let delay = next.stowed ? 0 : next.revealDelayMs / 1000
        let fade = springAnimation("opacity", Springs.contents, from: fromOpacity, to: opacity)
        let slide = springAnimation(
          "sublayerTransform.translation", Springs.contents, from: fromShift,
          to: NSValue(size: CGSize(width: shift.x, height: shift.y))
        )
        for animation in [fade, slide] {
          animation.beginTime = CACurrentMediaTime() + delay
          animation.fillMode = .backwards
        }
        host.add(fade, forKey: "fade")
        host.add(slide, forKey: "slide")
      }
    }
  }
}

/// The dot on a meter that says a provider has notices: the unread count, or
/// a quiet mark once they have all been read.
@MainActor
public final class BadgeView: FlippedView {
  private let theme: HudTheme
  private let label: NSTextField

  init(metrics: HudMetrics, theme: HudTheme) {
    self.theme = theme
    label = dockLabel(size: metrics.percentFontSize, weight: .semibold, color: theme.surface)
    super.init(frame: .zero)
    addSubview(label)
    setAccessibilityElement(true)
    setAccessibilityRole(.button)
  }

  public override func layout() {
    super.layout()
    layer?.cornerRadius = bounds.width / 2
    let height = label.intrinsicContentSize.height
    label.frame = CGRect(x: 0, y: (bounds.height - height) / 2, width: bounds.width, height: height)
  }

  func show(count: Int, needsInput: Int) {
    label.stringValue = count > 0 ? "\(count)" : Copy.noticeReadMark
    let fill: ThemeColor =
      needsInput > 0
      ? NoticeColors.waiting(theme.appearance)
      : count > 0 ? NoticeColors.completed(theme.appearance) : theme.text
    layer?.backgroundColor = fill.cgColor
    setAccessibilityLabel(count > 0 ? "\(count) \(Copy.noticeTitle)" : Copy.noticeHistory)
  }
}
