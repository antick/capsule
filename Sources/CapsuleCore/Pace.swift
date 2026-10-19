import Foundation

/// How long each kind of window lasts, from what the providers report.
public enum WindowLengths {
  public static let hour = 3_600.0
  public static let fiveHours = 5 * hour
  public static let day = 24 * hour
  public static let week = 7 * day
  /// A billing month, for pace only: close enough to judge a rate by.
  public static let month = 30 * day

  /// The window a reading covers, or nil when the provider gives no way to
  /// tell. Read from the window's id and label, which the mappers set from
  /// the provider's own window lengths.
  public static func seconds(_ provider: ProviderId, _ bucket: UsageBucket) -> Double? {
    if let stated = bucket.windowSeconds, stated > 0 { return stated }
    switch bucket.label {
    case Copy.fiveHourWindow, Copy.currentSession: return fiveHours
    case Copy.weeklyWindow, Copy.allModels, Copy.grokWeekly: return week
    case Copy.dailyWindow: return day
    case Copy.monthlyWindow, Copy.cursorPlan, Copy.cursorTotal, Copy.cursorModels, Copy.cursorOtherModels: return month
    default: break
    }
    if provider == .claude, bucket.id.hasPrefix("weekly-") { return week }
    if provider == .cursor, bucket.id == "grok-bot" { return week }
    if provider == .cursor, bucket.id == "requests" { return month }
    return nil
  }
}

/// Where a window's use stands against an even pace through it.
public struct Pace: Equatable, Sendable {
  public enum Stage: String, Sendable {
    case onTrack, slightlyAhead, ahead, farAhead, slightlyBehind, behind, farBehind
  }

  /// Used share minus the share of the window gone, in points. Positive is
  /// ahead of pace: using faster than would last.
  public var delta: Double
  public var stage: Stage
  /// The share of the window gone, 0…1, for the even-pace mark on the bar.
  public var elapsedFraction: Double
  /// When it runs out at the current rate, if before the reset.
  public var runsOutAt: Date?

  public var isAhead: Bool { delta > PaceTuning.onTrackPoints }
}

public enum PaceTuning {
  /// Within this many points of even is on pace.
  public static let onTrackPoints = 2.0
  public static let slightPoints = 6.0
  public static let clearPoints = 12.0
  /// Too early in a short window to judge.
  public static let minElapsedShort = 0.03
  /// Weeks and months are judged a little sooner.
  public static let minElapsedLong = 0.01
}

/// The pace of one window at `now`, or nil when it cannot be judged: no
/// known length, no reset ahead, or too early in the window.
public func pace(_ provider: ProviderId, _ bucket: UsageBucket, now: Date) -> Pace? {
  guard let duration = WindowLengths.seconds(provider, bucket), duration > 0,
    let resetsAt = looseDate(bucket.resetsAt)
  else { return nil }
  let untilReset = resetsAt.timeIntervalSince(now)
  guard untilReset > 0, untilReset <= duration else { return nil }
  let elapsed = duration - untilReset
  let fraction = elapsed / duration
  let minimum = duration <= WindowLengths.day ? PaceTuning.minElapsedShort : PaceTuning.minElapsedLong
  guard fraction >= minimum else { return nil }
  let actual = max(0, min(100, bucket.percentUsed))
  let delta = actual - fraction * 100
  let size = abs(delta)
  let stage: Pace.Stage
  if size <= PaceTuning.onTrackPoints {
    stage = .onTrack
  } else if size <= PaceTuning.slightPoints {
    stage = delta > 0 ? .slightlyAhead : .slightlyBehind
  } else if size <= PaceTuning.clearPoints {
    stage = delta > 0 ? .ahead : .behind
  } else {
    stage = delta > 0 ? .farAhead : .farBehind
  }
  var runsOut: Date?
  if actual >= 100 {
    runsOut = now
  } else if actual > 0 {
    let rate = actual / elapsed
    let left = (100 - actual) / rate
    if left < untilReset { runsOut = now.addingTimeInterval(left) }
  }
  return Pace(delta: delta, stage: stage, elapsedFraction: fraction, runsOutAt: runsOut)
}

/// What the card says about a window's pace: "On pace", "8% in deficit",
/// "12% in reserve", and when it would run out if that is before the reset.
public func formatPace(_ pace: Pace, now: Date) -> (pace: String, outlook: String?) {
  let points = Int(abs(pace.delta).rounded())
  let label: String
  if pace.stage == .onTrack || points == 0 {
    label = Copy.onPace
  } else {
    label = "\(points)\(Copy.percentSuffix) \(pace.delta > 0 ? Copy.inDeficit : Copy.inReserve)"
  }
  guard let runsOut = pace.runsOutAt else { return (label, nil) }
  let left = runsOut.timeIntervalSince(now)
  return (label, left <= 0 ? Copy.limitReached : "\(Copy.runsOutIn) \(formatSpan(left))")
}

/// The even-pace mark on a bar, in multiples of the bar's height.
public enum PaceMark {
  public static let widthPerBar = 0.34
  public static let heightPerBar = 1.67
}

extension Copy {
  public static let paceSeparator = " · "
  public static let flipResetHint = "Click to switch between a countdown and a date"
  public static let flipDisplayHint = "Click to switch between used and left"
  public static let starMetric = "Star"
  public static let unstarMetric = "Unstar"
  public static let starred = "Starred"
  public static let hideMetric = "Hide"
  public static let onPace = "On pace"
  public static let notStarted = "Not started"
  public static let inDeficit = "in deficit"
  public static let inReserve = "in reserve"
  public static let runsOutIn = "Runs out in"
  public static let limitReached = "Limit reached"
}
