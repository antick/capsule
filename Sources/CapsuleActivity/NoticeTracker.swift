import CapsuleCore
import Foundation

/// One process lifetime of notices: history before launch is taken in
/// silently, then each explicit transition is shown exactly once.
///
/// The original walks the activity map in the order the monitor built it,
/// which is provider order. A Swift dictionary has no order, so this walks
/// providers in ``ProviderId`` order explicitly — the same sequence, stated
/// rather than inherited.
public final class NoticeTracker {
  public private(set) var notices: [ActivityNotice] = []
  private let startedAt: Date
  /// Remembered ids, oldest first, so the oldest is the one forgotten once
  /// `maxSeen` is reached. A Swift `Set` keeps no order, so the order lives
  /// in the array and the set only answers "seen?".
  private var seenOrder: [String] = []
  private var seen: Set<String> = []

  public init(startedAt: Date = Date()) {
    self.startedAt = startedAt
  }

  private func remember(_ id: String) {
    seen.insert(id)
    seenOrder.append(id)
    while seenOrder.count > NoticeTuning.maxSeen {
      seen.remove(seenOrder.removeFirst())
    }
  }

  @discardableResult
  public func markRead(_ ids: [String]) -> [ActivityNotice] {
    let opened = Set(ids)
    notices = notices.map { notice in
      var notice = notice
      if opened.contains(notice.id) { notice.read = true }
      return notice
    }
    return notices
  }

  @discardableResult
  public func dismiss(_ id: String) -> [ActivityNotice] {
    notices.removeAll { $0.id == id }
    return notices
  }

  @discardableResult
  public func update(_ activity: [ProviderId: [AgentSession]], now: Date? = nil)
    -> [ActivityNotice]
  {
    let sessions = ProviderId.allCases.flatMap { activity[$0] ?? [] }

    // A wait is over once its session is no longer waiting from that moment.
    notices.removeAll { notice in
      notice.kind == .waiting
        && !sessions.contains {
          $0.id == notice.sessionId && $0.state == .waiting && $0.since == notice.at
        }
    }
    // A completion is read once its task has started working again.
    notices = notices.map { notice in
      guard notice.kind == .completed,
        let finished = looseDate(notice.at),
        sessions.contains(where: {
          $0.id == notice.sessionId && $0.state != .idle
            && (looseDate($0.since).map { $0 > finished } ?? false)
        })
      else { return notice }
      var read = notice
      read.read = true
      return read
    }

    for session in sessions {
      let evidence: (kind: ActivityNotice.Kind, id: String, at: String)?
      if session.state == .waiting, session.confirmed != false {
        evidence = (.waiting, "waiting:\(session.since)", session.since)
      } else if let completion = session.completion {
        evidence = (.completed, completion.id, completion.at)
      } else {
        evidence = nil
      }
      guard let evidence, let at = looseDate(evidence.at) else { continue }
      let id = "\(session.id):\(evidence.id)"
      if seen.contains(id) { continue }
      // Remembered even when it is not shown, so history stays history.
      remember(id)
      let ageMs = now.map { $0.timeIntervalSince(at) * 1000 } ?? 0
      if at < startedAt || ageMs < 0 || ageMs > NoticeTuning.maxEventAgeMs {
        continue
      }
      notices.append(
        ActivityNotice(
          id: id,
          sessionId: session.id,
          providerId: session.providerId,
          title: jsSlice(session.name, NoticeTuning.maxTitleLength),
          kind: evidence.kind,
          at: evidence.at,
          summary: evidence.kind == .completed
            ? session.completion?.summary : session.waitingFor
        )
      )
    }
    notices = Array(notices.suffix(NoticeTuning.maxPending))
    return notices
  }
}
