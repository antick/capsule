import CapsuleCore
import Foundation

private func expandHome(_ path: String, _ home: String) -> String {
  path.hasPrefix("~/") ? joinPath(home, [String(path.dropFirst(2))]) : path
}

private func lastComponent(_ path: String) -> String {
  path.components(separatedBy: "/").last ?? path
}

/// Rollouts the thread index knows about, one per thread, newest file kept.
private func indexedRollouts(_ host: ActivityHost) async -> [CodexCandidate] {
  let home = host.homeDir
  let rows = await host.query(
    joinPath(home, ActivityTuning.codexStateDatabase), ActivityTuning.codexRolloutsSQL
  )
  var candidates = OrderedMap<String, CodexCandidate>()
  for row in rows.prefix(ActivityTuning.maxSessions) {
    let threadId = row.count > 0 ? row[0] : ""
    let title = row.count > 1 ? row[1] : ""
    guard row.count > 2, !row[2].isEmpty else { continue }
    let path = row[2]
    guard let at = await host.modifiedAt(expandHome(path, home)) else { continue }
    let id = "codex.\(threadId.isEmpty ? (lastComponent(path).isEmpty ? path : lastComponent(path)) : threadId)"
    if let previous = candidates[id], previous.at.map({ at <= $0 }) ?? false { continue }
    candidates[id] = CodexCandidate(
      id: id, name: jsTrim(title).isEmpty ? ProviderLabels.label(.codex) : title, at: at, path: path
    )
  }
  return candidates.values
}

/// The newest names in a directory, hidden ones left out.
private func newestOf(_ host: ActivityHost, _ dir: String, _ take: Int) async -> [String] {
  Array(jsSorted(await host.listDir(dir).filter { !$0.hasPrefix(".") }).reversed().prefix(take))
}

/// The newest rollout on disk, from a bounded scan of the most recent days.
private func newestRolloutOnDisk(_ host: ActivityHost) async -> (path: String, at: Date)? {
  let root = joinPath(host.homeDir, ActivityTuning.codexSessionsDir)
  var best: (path: String, at: Date)?
  var daysSeen = 0
  for year in await newestOf(host, root, 1) {
    for month in await newestOf(host, joinPath(root, [year]), 2) {
      for day in await newestOf(host, joinPath(root, [year, month]), ActivityTuning.codexRecentDays) {
        if daysSeen >= ActivityTuning.codexRecentDays { return best }
        daysSeen += 1
        let folder = joinPath(root, [year, month, day])
        for name in await host.listDir(folder) where name.hasSuffix(".jsonl") {
          let path = joinPath(folder, [name])
          if let at = await host.modifiedAt(path), best.map({ at > $0.at }) ?? true {
            best = (path, at)
          }
        }
      }
    }
  }
  return best
}

/// Codex sessions: one per indexed rollout, then the newest rollout on disk,
/// then the desktop app's catalogue. A desktop catalogue update cannot
/// identify which rollout is busy, so rollouts keep their own identities.
public func readCodexSessions(_ host: ActivityHost) async -> [AgentSession] {
  var candidates = await indexedRollouts(host)
  if candidates.isEmpty, let rollout = await newestRolloutOnDisk(host) {
    candidates.append(
      CodexCandidate(
        // `??` in the original, not `||`: the last component always exists.
        id: "codex.\(lastComponent(rollout.path))",
        name: ProviderLabels.label(.codex), at: rollout.at, path: rollout.path
      )
    )
  }

  let now = host.now()
  if !candidates.isEmpty {
    var sessions: [AgentSession] = []
    for candidate in candidates {
      let fresh = codexSessionFrom([candidate], now: now)
      if fresh == nil && !host.canReadTail { continue }
      guard let at = candidate.at, let fallback = codexSessionFrom([candidate], now: at) else { continue }
      let tail = await candidate.path.asyncMap { await host.tail(expandHome($0, host.homeDir)) } ?? nil
      var parsed = applyLocalEvents(fresh ?? fallback, tail)
      if fresh != nil
        || (parsed.confirmed == true && now.timeIntervalSince(at) * 1000 <= ActivityTuning.activeEvidenceMs)
      {
        sessions.append(parsed)
      } else if parsed.state == .waiting {
        parsed.confirmed = false
        parsed.detail = Copy.statusUnknown
        sessions.append(parsed)
      }
    }
    return sessions
  }

  let rows = await host.query(
    joinPath(host.homeDir, ActivityTuning.codexDesktopDatabase), ActivityTuning.codexDesktopSQL
  )
  // The catalogue counts seconds since the epoch, with a fraction — not the
  // milliseconds the thread index next door uses.
  if let row = rows.first, let first = row.first {
    let seconds = jsNumber(first)
    if seconds.isFinite {
      let title = row.count > 1 ? row[1] : ""
      candidates.append(
        CodexCandidate(
          id: "codex.desktop", name: title.isEmpty ? ProviderLabels.label(.codex) : title,
          at: jsDate(milliseconds: seconds * 1000)
        )
      )
    }
  }
  return codexSessionFrom(candidates, now: now).map { [$0] } ?? []
}

extension Optional {
  fileprivate func asyncMap<T>(_ transform: (Wrapped) async -> T) async -> T? {
    guard let self else { return nil }
    return await transform(self)
  }
}
