import CapsuleCore
import Foundation

/// Is the process behind a record still running, and still the same process?
/// A crashed session leaves its file saying busy forever, and on a long-running
/// machine pids get reused, so the start times are compared too.
public func isRecordAlive(_ host: ActivityHost, _ record: ClaudeSessionRecord) async -> Bool {
  guard await host.isProcessAlive(record.pid) else { return false }
  guard let started = record.startedAt else { return true }
  // Cannot prove it either way: trust the pid rather than hide a session that
  // is probably real.
  guard let actual = await host.processStartedAt(record.pid) else { return true }
  return abs(actual.timeIntervalSince(started)) * 1000 < ActivityTuning.pidReuseToleranceMs
}

/// The Claude Code sessions actually running right now, newest first, each
/// with its own transcript's local events applied.
public func readClaudeSessions(_ host: ActivityHost) async -> [AgentSession] {
  let dir = joinPath(host.homeDir, ActivityTuning.claudeSessionsDir)
  let now = host.now()
  var found: [AgentSession] = []
  for name in await host.listDir(dir) where name.hasSuffix(".json") {
    guard let raw = await host.readFile(joinPath(dir, [name])), let json = JSONValue.parse(raw),
      let record = parseClaudeSession(json, now: now), await isRecordAlive(host, record)
    else { continue }
    var transcript: String?
    // Only an id that is safe to put in a path is used to find the transcript.
    if let id = json["sessionId"]?.asString, jsIsSafeId(id), let cwd = json["cwd"]?.asString {
      transcript = await host.tail(
        joinPath(host.homeDir, ActivityTuning.claudeProjectsDir + [jsSafeIdDashed(cwd), "\(id).jsonl"])
      )
    }
    found.append(reconcile(record.session, applyLocalEvents(record.session, transcript)))
  }
  return newestFirst(found)
}

/// Whichever said it last wins: Claude Code's own status in its record, or
/// the transcript. The record can lag a moment behind a reply that just
/// finished, so a newer transcript event stands. But a transcript cannot tell
/// "still working" from "interrupted and left" — its last message is a
/// request or a tool call either way — so when the record's status is the
/// newer word, it stands. Trusting the transcript regardless showed sessions
/// idle for weeks as working all along.
func reconcile(_ record: AgentSession, _ local: AgentSession) -> AgentSession {
  guard record.confirmed == true else { return local }
  if let heard = looseDate(local.since), let stated = looseDate(record.since), heard > stated {
    return local
  }
  var session = local
  switch record.state {
  case .idle:
    session.state = .idle
    session.since = record.since
    session.detail = record.detail
    session.waitingFor = nil
  case .busy:
    // A question asked in the transcript is the one thing more precise than
    // "busy"; anything else keeps the record's word.
    if local.state != .waiting {
      session.state = .busy
      if local.state != .busy {
        session.since = record.since
        session.detail = record.detail
      }
    }
  case .waiting:
    session.state = .waiting
    session.waitingFor = record.waitingFor ?? local.waitingFor ?? Copy.localWaiting
    if local.state != .waiting { session.since = record.since }
  }
  session.confirmed = true
  return session
}
