import Foundation

public enum AgentSessionState: String, Sendable, Codable {
  case busy, waiting, idle
}

/// Explicit evidence that a turn finished — never inferred from silence.
public struct AgentCompletion: Sendable, Codable, Equatable {
  public var id: String
  public var at: String
  public var summary: String?

  public init(id: String, at: String, summary: String? = nil) {
    self.id = id
    self.at = at
    self.summary = summary
  }
}

/// One live agent session, as a provider's reader reports it.
public struct AgentSession: Sendable, Codable, Equatable {
  public var id: String
  public var providerId: ProviderId
  /// What to call it in the card.
  public var name: String
  /// The quieter second line: where it is running, or what it is doing.
  public var detail: String
  public var state: AgentSessionState
  /// Set while waiting: what it wants from you.
  public var waitingFor: String?
  /// When it entered its current state, as an ISO timestamp.
  public var since: String
  public var completion: AgentCompletion?
  /// False when a local record cannot prove the current status.
  public var confirmed: Bool?

  public init(
    id: String, providerId: ProviderId, name: String, detail: String,
    state: AgentSessionState, waitingFor: String?, since: String,
    completion: AgentCompletion? = nil, confirmed: Bool? = nil
  ) {
    self.id = id
    self.providerId = providerId
    self.name = name
    self.detail = detail
    self.state = state
    self.waitingFor = waitingFor
    self.since = since
    self.completion = completion
    self.confirmed = confirmed
  }
}

/// Lets `[ProviderId: …]` decode from a JSON object keyed by provider. Without
/// it, Swift decodes an enum-keyed dictionary from an alternating key/value
/// array and a provider map silently fails to read.
extension ProviderId: CodingKeyRepresentable {}

/// What a ring shows: every live session reduced to the one state worth
/// knowing at a glance.
public enum ActivityState: String, Sendable, Codable {
  case working, waiting, idle
}

public struct ActivitySummary: Sendable, Codable, Equatable {
  public var state: ActivityState
  public var sessions: [AgentSession]
}

/// Nil when nothing is running, so the indicator disappears instead of saying
/// nothing. Anything blocked on you outranks anything merely busy, and an
/// unconfirmed hint counts as neither: it is not proof of either state.
public func summarizeActivity(_ sessions: [AgentSession]?) -> ActivitySummary? {
  guard let sessions, !sessions.isEmpty else { return nil }
  func any(_ state: AgentSessionState) -> Bool {
    sessions.contains { $0.confirmed != false && $0.state == state }
  }
  let state: ActivityState =
    any(.waiting) ? .waiting : any(.busy) ? .working : .idle
  return ActivitySummary(state: state, sessions: sessions)
}

/// Whether any agent, for any provider, is doing something. Unlike
/// ``summarizeActivity(_:)`` this counts an unconfirmed hint: it sets how
/// often the monitor looks again, not what a ring shows.
public func anyAgentActive(_ activity: [ProviderId: [AgentSession]]) -> Bool {
  activity.values.contains { $0.contains { $0.state != .idle } }
}

/// Waiting first, then busy, newest first within a rank, so whatever a long
/// list has to hide is what matters least.
///
/// The sort is stable, as the original's is: sessions that tie on rank and
/// time keep their order, or they would swap places between refreshes.
/// `since` is compared as a string, not a date, exactly as the original does
/// — see the note on `activity/order-sessions` in the fixture corpus.
public func orderSessions(_ sessions: [AgentSession]) -> [AgentSession] {
  func rank(_ session: AgentSession) -> Int {
    switch session.state {
    case .waiting: return 0
    case .busy: return 1
    case .idle: return 2
    }
  }
  return sessions.enumerated()
    .sorted { left, right in
      let byRank = rank(left.element) - rank(right.element)
      if byRank != 0 { return byRank < 0 }
      if left.element.since != right.element.since {
        return left.element.since > right.element.since
      }
      return left.offset < right.offset
    }
    .map(\.element)
}
