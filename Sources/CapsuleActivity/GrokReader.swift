import CapsuleCore
import Foundation

/// `new Date(value)` for a registry's `opened_at`. `null` is the epoch in
/// JavaScript, not an invalid date, and the original inherits that.
private func openedAt(_ value: JSONValue?) -> Date? {
  switch value {
  case .string(let text): return looseDate(text)
  case .number(let ms): return jsDate(milliseconds: ms)
  case .null: return Date(timeIntervalSince1970: 0)
  default: return nil
  }
}

/// Grok sessions from the active-session registry, and from recent event
/// files, which current CLI versions write without updating the registry.
public func readGrokSessions(_ host: ActivityHost) async -> [AgentSession] {
  let home = host.homeDir
  let root = joinPath(home, ActivityTuning.grokSessionsDir)
  var registered = OrderedMap<String, AgentSession>()

  let entries = JSONValue.parse(await host.readFile(joinPath(home, ActivityTuning.grokRegistry)) ?? "null")?
    .asArray ?? []
  for entry in entries.prefix(ActivityTuning.maxSessions) {
    guard let fields = entry.asObject, let id = fields["session_id"]?.asString, jsIsSafeId(id),
      let pidValue = fields["pid"]?.asDouble, jsIsSafeInteger(pidValue), pidValue > 0,
      let cwd = fields["cwd"]?.asString
    else { continue }
    let pid = Int(pidValue)
    guard await host.isProcessAlive(pid), let opened = openedAt(fields["opened_at"]) else { continue }
    // Only a process that started well after the session opened is a reuse.
    if let started = await host.processStartedAt(pid),
      started.timeIntervalSince(opened) * 1000 > ActivityTuning.pidReuseToleranceMs
    {
      continue
    }
    registered[id] = AgentSession(
      id: "grok.\(id)", providerId: .grok, name: (cwd as NSString).lastPathComponent,
      detail: Copy.statusUnknown, state: .idle, waitingFor: nil, since: isoString(opened),
      confirmed: false
    )
  }

  var sessions = OrderedMap<String, AgentSession>()
  for project in (await host.listDir(root)).prefix(ActivityTuning.maxSessions) {
    if project == "." || project == ".." || project.contains("/") { continue }
    let folder = joinPath(root, [project])
    var ids = OrderedMap<String, Bool>()
    for id in registered.keys { ids[id] = true }
    let listed = jsSorted(await host.listDir(folder).filter(jsIsSafeId)).reversed()
    for id in listed.prefix(ActivityTuning.maxSessions) { ids[id] = true }

    for id in ids.keys {
      let path = joinPath(folder, [id, ActivityTuning.grokEventsFile])
      guard let modified = await host.modifiedAt(path) else { continue }
      let known = registered[id]
      if known == nil, host.now().timeIntervalSince(modified) * 1000 > ActivityTuning.activeEvidenceMs {
        continue
      }
      let base =
        known
        ?? AgentSession(
          id: "grok.\(id)", providerId: .grok, name: project, detail: Copy.statusUnknown,
          state: .idle, waitingFor: nil, since: isoString(modified), confirmed: false
        )
      var found = applyLocalEvents(base, await host.tail(path))
      // A partially written title must not hide activity.
      let summary = await host.readFile(joinPath(folder, [id, ActivityTuning.grokSummaryFile]))
      if let title = JSONValue.parse(summary ?? "null")?["generated_title"]?.asString {
        found.name = jsSlice(title, NoticeTuning.maxTitleLength)
      }
      sessions[id] = found
    }
  }
  for id in registered.keys where !sessions.contains(id) {
    sessions[id] = registered[id]
  }
  return Array(newestFirst(sessions.values).prefix(ActivityTuning.maxSessions))
}
