import CapsuleCore
import Foundation

@testable import CapsuleDock

/// A clock the test moves by hand. Timers fire in deadline order.
@MainActor
final class ManualClock: DockClock {
  private(set) var nowMs = 0.0
  private var pending: [(at: Double, order: Int, timer: DockTimer)] = []
  private var order = 0

  func after(_ ms: Double, _ action: @escaping @MainActor () -> Void) -> DockTimer {
    let timer = DockTimer(action)
    order += 1
    pending.append((nowMs + max(0, ms), order, timer))
    return timer
  }

  func advance(_ ms: Double) {
    let end = nowMs + ms
    while let next = pending.filter({ $0.at <= end && $0.timer.isPending })
      .min(by: { ($0.at, $0.order) < ($1.at, $1.order) })
    {
      nowMs = next.at
      next.timer.fire()
    }
    pending.removeAll { !$0.timer.isPending }
    nowMs = end
  }
}

func reading(_ id: ProviderId, _ percent: Double?) -> UsageSnapshot {
  UsageSnapshot(
    providerId: id, displayName: ProviderLabels.label(id), iconId: id, primaryPercent: percent,
    buckets: [], status: percent == nil ? .unauthenticated : .ok, fetchedAt: "2026-01-01T00:00:00.000Z"
  )
}

func notice(_ id: String, _ provider: ProviderId, _ kind: ActivityNotice.Kind = .completed, read: Bool? = nil)
  -> ActivityNotice
{
  ActivityNotice(
    id: id, sessionId: "s-\(id)", providerId: provider, title: "Task \(id)", kind: kind,
    at: "2026-01-01T00:00:00.000Z", read: read
  )
}
