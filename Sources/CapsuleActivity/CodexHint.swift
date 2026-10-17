import CapsuleCore
import Foundation

/// Somewhere Codex recorded work, and when it last did. `at` is nil when the
/// time could not be read.
public struct CodexCandidate: Sendable, Equatable {
  public var id: String
  public var name: String
  public var at: Date?
  /// The rollout file, when the candidate came from one.
  public var path: String?

  public init(id: String, name: String, at: Date?, path: String? = nil) {
    self.id = id
    self.name = name
    self.at = at
    self.path = path
  }
}

/// A recent rollout write is an activity hint, not proof a turn is running.
/// Keep the ring's signal, and label its uncertainty explicitly.
public func codexSessionFrom(
  _ candidates: [CodexCandidate], now: Date,
  staleAfterMs: Double = ActivityTuning.codexStaleAfterMs
) -> AgentSession? {
  var newest: (candidate: CodexCandidate, at: Date)?
  for candidate in candidates {
    guard let at = candidate.at else { continue }
    // Strictly later, so of two writes at the same instant the first stays.
    if newest == nil || at > newest!.at { newest = (candidate, at) }
  }
  guard let newest,
    now.timeIntervalSince(newest.at) * 1000 <= staleAfterMs
  else { return nil }
  return AgentSession(
    id: newest.candidate.id,
    providerId: .codex,
    name: newest.candidate.name,
    detail: Copy.codexRecent,
    state: .busy,
    waitingFor: nil,
    since: isoString(newest.at),
    confirmed: false
  )
}
