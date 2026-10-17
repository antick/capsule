import CapsuleCore
import Foundation

/// One entry in `~/.claude/sessions/<pid>.json`, as Claude Code writes it,
/// with the two things only the monitor needs: the pid, and the process start
/// time that tells a live session from a file a crashed one left behind.
public struct ClaudeSessionRecord: Sendable, Equatable {
  public var pid: Int
  public var startedAt: Date?
  public var session: AgentSession
}

/// Which surface a session is running in, for the card's second line.
public func surfaceLabel(_ entrypoint: String?) -> String {
  switch entrypoint {
  case "claude-desktop", "claude-desktop-3p": return Copy.surfaceDesktop
  case "claude-vscode": return Copy.surfaceVsCode
  case "local-agent": return Copy.surfaceAgent
  default: return Copy.surfaceTerminal
  }
}

/// `procStart` looks like "Fri Aug 28 05:15:20 2026": a ctime string, in UTC,
/// with the day of month space-padded on single-digit days.
///
/// Narrower than the original's `new Date(...)`, which also accepts odd
/// forms — a spelled-out month, an out-of-range day that rolls over. Claude
/// Code writes neither, so the strict reading is the safer one.
public func parseProcStart(_ text: String) -> Date? {
  let fields = jsTrim(text).unicodeScalars
    .split(whereSeparator: jsIsSpace)
    .map { String($0) }
  guard fields.count == 5 else { return nil }
  let formatter = DateFormatter()
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = TimeZone(identifier: "UTC")
  formatter.dateFormat = "d MMM yyyy HH:mm:ss"
  return formatter.date(from: "\(fields[2]) \(fields[1]) \(fields[4]) \(fields[3])")
}

/// One registry entry, decoded leniently on purpose: the file is written by
/// another program on its own release schedule, and an unknown field must
/// never cost a session that could have been shown.
public func parseClaudeSession(_ raw: JSONValue, now _: Date) -> ClaudeSessionRecord? {
  guard let json = raw.asObject else { return nil }
  func number(_ key: String) -> Double? {
    guard let value = json[key]?.asDouble, value.isFinite else { return nil }
    return value
  }
  func text(_ key: String) -> String? { json[key]?.asString }

  guard let pidValue = number("pid"), jsIsSafeInteger(pidValue), pidValue > 0,
    let cwd = text("cwd")
  else { return nil }

  let tempo = text("tempo")
  let status = text("status")
  let state: AgentSessionState =
    tempo == "blocked" || status == "waiting"
    ? .waiting
    : tempo == "active" || status == "busy" ? .busy : .idle

  let startedMs = number("startedAt")
  // No timestamp at all falls back to the epoch, not to now, so a record's
  // `since` stays put between reads.
  guard
    let since = jsDate(
      milliseconds: number("statusUpdatedAt") ?? number("updatedAt") ?? startedMs ?? 0
    )
  else { return nil }

  let folder = cwd.components(separatedBy: "/").filter { !$0.isEmpty }.last ?? cwd
  let procStart = text("procStart")
  let startedAt: Date? =
    if let startedMs { jsDate(milliseconds: startedMs) }
    else if let procStart, !procStart.isEmpty { parseProcStart(procStart) }
    else { nil }

  let pid = Int(pidValue)
  return ClaudeSessionRecord(
    pid: pid,
    startedAt: startedAt,
    session: AgentSession(
      id: "claude.\(text("sessionId") ?? String(pid))",
      providerId: .claude,
      name: text("name") ?? folder,
      detail: "\(surfaceLabel(text("entrypoint"))) · \(folder)",
      state: state,
      waitingFor: text("waitingFor") ?? text("needs"),
      since: isoString(since),
      confirmed: ["blocked", "active"].contains(tempo ?? "")
        || ["waiting", "busy", "idle"].contains(status ?? "")
    )
  )
}
