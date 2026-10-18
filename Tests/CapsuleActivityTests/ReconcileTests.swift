import CapsuleCore
import Testing

@testable import CapsuleActivity

/// Claude Code's record against the transcript: whichever spoke last wins.
@Suite("Record and transcript")
struct ReconcileTests {
  func record(_ state: AgentSessionState, since: String) -> AgentSession {
    AgentSession(
      id: "claude.s", providerId: .claude, name: "feather-a0", detail: "Terminal · feather", state: state,
      waitingFor: nil, since: since, confirmed: true)
  }

  /// The transcript of a turn interrupted weeks ago: its last line is a request.
  let interrupted = #"{"timestamp":"2026-09-01T10:00:00.000Z","type":"user","message":{"content":[{"type":"text","text":"go"}]}}"#

  @Test func anIdleRecordBeatsAnOldUnfinishedTranscript() {
    let idle = record(.idle, since: "2026-10-18T09:00:00.000Z")
    let session = reconcile(idle, applyLocalEvents(idle, interrupted))
    #expect(session.state == .idle)
    #expect(session.since == "2026-10-18T09:00:00.000Z")
    #expect(session.detail == "Terminal · feather")
  }

  @Test func aReplyFinishedAfterTheRecordStands() {
    let busy = record(.busy, since: "2026-09-06T12:59:00.000Z")
    let done = #"{"timestamp":"2026-09-06T12:59:55.000Z","type":"assistant","uuid":"u1","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Done."}]}}"#
    let session = reconcile(busy, applyLocalEvents(busy, done))
    #expect(session.state == .idle)
    #expect(session.completion?.summary == "Done.")
  }

  @Test func aBusyRecordIsNotUndoneByAnOldFinishedReply() {
    let busy = record(.busy, since: "2026-10-18T09:00:00.000Z")
    let old = #"{"timestamp":"2026-09-01T10:00:00.000Z","type":"assistant","message":{"stop_reason":"end_turn","content":[{"type":"text","text":"Old."}]}}"#
    #expect(reconcile(busy, applyLocalEvents(busy, old)).state == .busy)
  }

  @Test func withoutAStatedStatusTheTranscriptDecides() {
    var unknown = record(.idle, since: "2026-10-18T09:00:00.000Z")
    unknown.confirmed = false
    #expect(reconcile(unknown, applyLocalEvents(unknown, interrupted)).state == .busy)
  }
}
