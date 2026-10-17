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
    found.append(applyLocalEvents(record.session, transcript))
  }
  return newestFirst(found)
}
