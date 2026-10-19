import Foundation

/// How long to wait between reads, from what the Mac and the user are doing.
public enum AdaptiveRefresh {
  public static let minute = 60_000.0
  public static let constrainedMs = 30 * minute
  public static let recentMs = 2 * minute
  public static let warmMs = 5 * minute
  public static let idleMs = 15 * minute
  public static let longIdleMs = 30 * minute
  /// Within this long of looking at Capsule, reads come quickest.
  public static let recentWindowMs = 5 * minute
  public static let warmWindowMs = 60 * minute
  public static let idleWindowMs = 4 * 60 * minute

  /// The wait before the next read. Low Power Mode or a hot Mac wins; an
  /// agent at work polls at the user's own interval; otherwise the longer
  /// since the user last looked, the longer the wait.
  public static func delayMs(sinceInteractionMs: Double?, busy: Bool, constrained: Bool, intervalMs: Double) -> Double {
    if constrained { return constrainedMs }
    if busy { return intervalMs }
    guard let since = sinceInteractionMs else { return longIdleMs }
    if since <= recentWindowMs { return max(intervalMs, recentMs) }
    if since <= warmWindowMs { return warmMs }
    if since <= idleWindowMs { return idleMs }
    return longIdleMs
  }
}

extension Copy {
  public static let adaptiveRefresh = "Adaptive refresh"
  public static let adaptiveRefreshHint =
    "Reads quickly while you look at Capsule or an agent works, slower when you have not looked in a while, and slowest on Low Power Mode."
}
