import Foundation

/// A spring described the way SwiftUI describes one: `response` is the period
/// of the undamped oscillation in seconds, `damping` the damping fraction.
public struct Spring: Sendable, Equatable {
  public let response: Double
  public let damping: Double

  public init(response: Double, damping: Double) {
    self.response = response
    self.damping = damping
  }

  var omega: Double { 2 * Double.pi / max(1e-6, response) }
  /// Core Animation's terms for the same spring, at unit mass.
  public var stiffness: Double { omega * omega }
  public var friction: Double { 2 * max(0, damping) * omega }
}

/// The dock's motion vocabulary. Mirrors `SPRINGS` in `@capsule/config`.
public enum Springs {
  /// Folding open and shut.
  public static let unfold = Spring(response: 0.42, damping: 0.78)
  /// Contents arriving after the shape has started opening.
  public static let contents = Spring(response: 0.36, damping: 0.82)
  /// The card travelling between meters, and its height following a swap.
  public static let glide = Spring(response: 0.5, damping: 0.86)
  /// A percentage changing under you.
  public static let reading = Spring(response: 0.9, damping: 0.9)
  /// A ring pressed in while it works.
  public static let press = Spring(response: 0.3, damping: 0.62)
}

public enum SpringTuning {
  /// How close to its target a spring has to be before it counts as arrived.
  public static let settleEpsilon = 0.001
  /// Substep used when a spring is stepped frame by frame, in seconds.
  public static let stepSeconds = 1.0 / 240
  /// The longest frame gap a stepped spring will simulate.
  public static let maxFrameSeconds = 1.0 / 15
}

/// A spring in flight: where it is and how fast it is moving.
public struct SpringState: Sendable, Equatable {
  public var value: Double
  public var velocity: Double

  public init(value: Double, velocity: Double = 0) {
    self.value = value
    self.velocity = velocity
  }

  /// Advances toward `target` by `seconds`. Stepped rather than solved, so a
  /// target that moves mid-flight keeps the momentum the spring already has.
  public mutating func step(_ spring: Spring, toward target: Double, seconds: Double) {
    var remaining = min(max(0, seconds), SpringTuning.maxFrameSeconds)
    while remaining > 0 {
      let h = min(SpringTuning.stepSeconds, remaining)
      let acceleration = -spring.stiffness * (value - target) - spring.friction * velocity
      velocity += acceleration * h
      value += velocity * h
      remaining -= h
    }
  }

  /// Whether it is close enough to `target` to be snapped onto it.
  public func settled(at target: Double, scale: Double) -> Bool {
    let tolerance = SpringTuning.settleEpsilon * max(1, abs(scale))
    return abs(value - target) < tolerance && abs(velocity) < tolerance * 10
  }
}

/// Timings and proportions. Mirrors `MOTION` and `HUD`'s delays.
public enum Motion {
  /// The card popping out of the rail, and being drawn back in.
  public static let openMs = 260.0
  public static let closeMs = 170.0
  public static let hoverOpenDelayMs = 70.0
  public static let hoverCloseDelayMs = 220.0
  /// Grace after the pointer leaves before the dock retracts.
  public static let peekHoldMs = 460.0
  /// How long "Show Dock" keeps the dock out before it may retract again.
  public static let revealHoldMs = 3200.0
  public static let meterStaggerMs = 45.0
  public static let meterStaggerCapMs = 180.0
  public static let crossfadeMs = 160.0
  public static let refreshPressScale = 0.93
  public static let activitySpinMs = 1100.0
  public static let activityArc = 0.25
  public static let activityPulseMs = 900.0
  public static let activityPulseFloor = 0.3
  public static let statusSpinMs = 1400.0
  public static let sweepMs = 1100.0
  public static let sweepArc = 0.18
  public static let zoomMs = 280.0
  public static let barMs = 420.0
  public static let meterMs = 180.0
  public static let dragThreshold = 5.0
  /// Slack around the dock so the hover region is forgiving at small sizes.
  public static let hoverSlop = 2.0
  public static let meterIdleOpacity = 0.92
  public static let closedBubbleScale = 0.62
  public static let liftScale = 1.04
  public static let shadowContactDy = 1.0
  public static let shadowContactBlur = 3.0
  public static let shadowDy = 6.0
  public static let shadowBlur = 14.0
}

extension HideDelay {
  /// Grace after the pointer leaves before an auto-hiding dock folds away.
  public var milliseconds: Double {
    switch self {
    case .instant: return 0
    case .quick: return 150
    case .normal: return 460
    case .relaxed: return 1100
    }
  }

  public var label: String {
    switch self {
    case .instant: return "Instant"
    case .quick: return "Quick"
    case .normal: return "Normal"
    case .relaxed: return "Relaxed"
    }
  }
}

/// How often usage may be re-read, as the settings offer it.
public enum PollIntervals {
  public static let options: [(ms: Int, label: String)] = [
    (30_000, "30 seconds"), (60_000, "1 minute"), (300_000, "5 minutes"), (900_000, "15 minutes"),
  ]
}

/// Presentation of activity notices. Mirrors the presentational half of
/// `ACTIVITY_NOTICES`.
public enum NoticePresentation {
  public static let visibleMs = 6500.0
  public static let readDelayMs = 1000.0
  public static let maxVisible = 3
}
