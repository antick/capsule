import CapsuleCore
import Foundation

/// The JSON objects in a JSONL log. Lines that do not parse, and lines that
/// are not objects, are skipped rather than ending the read.
public func records(_ raw: String?) -> [[String: JSONValue]] {
  guard let raw, !raw.isEmpty else { return [] }
  return jsLines(raw).compactMap { JSONValue.parse($0)?.asObject }
}

/// An instant as the logs write it — an ISO string or epoch milliseconds —
/// normalised to an ISO string, or nil.
private func time(_ value: JSONValue?) -> String? {
  switch value {
  case .string(let text): return looseDate(text).map(isoString)
  case .number(let ms): return jsDate(milliseconds: ms).map(isoString)
  default: return nil
  }
}

/// The first line of a final response worth showing, with markdown markers
/// stripped and cut to the summary length.
private func preview(_ value: JSONValue?) -> String? {
  guard let text = value?.asString else { return nil }
  let markers: Set<Unicode.Scalar> = ["#", "*", ">", "-"]
  for line in jsLines(text) {
    let stripped = String(
      line.unicodeScalars.drop { markers.contains($0) || jsIsSpace($0) }
    )
    let trimmed = jsTrim(stripped)
    if !trimmed.isEmpty { return jsSlice(trimmed, NoticeTuning.maxSummaryLength) }
  }
  return nil
}

private func object(_ value: JSONValue?) -> [String: JSONValue] {
  value?.asObject ?? [:]
}

/// What a session is doing, read from its own local event log: explicit
/// state markers and a bounded preview of the final response. Never inferred
/// from silence, truncation or an abort.
public func applyLocalEvents(_ session: AgentSession, _ raw: String?) -> AgentSession {
  var next = session
  var pendingInput: String?

  func work(_ at: String) {
    next.state = .busy
    next.confirmed = true
    next.since = at
    next.waitingFor = nil
  }
  func wait(_ at: String) {
    next.state = .waiting
    next.confirmed = true
    next.since = at
    next.waitingFor = Copy.localWaiting
  }
  func settle(_ at: String) {
    next.state = .idle
    next.confirmed = true
    next.since = at
    next.waitingFor = nil
  }

  for row in records(raw) {
    let payload = object(row["payload"])
    let at = time(row["timestamp"] ?? row["ts"])

    if session.providerId == .claude, row["type"]?.asString == "custom-title",
      let title = row["customTitle"]?.asString
    {
      // A title is not a state change, so it applies without a timestamp.
      next.name = jsSlice(title, NoticeTuning.maxTitleLength)
    }
    guard let at else { continue }

    if session.providerId == .claude {
      let message = object(row["message"])
      let blocks = (message["content"]?.asArray ?? []).map { object($0) }
      let type = row["type"]?.asString
      if type == "user" || type == "assistant" {
        work(at)
        next.completion = nil
      }
      if type == "assistant" {
        let question = blocks.contains {
          $0["type"]?.asString == "tool_use" && $0["name"]?.asString == "AskUserQuestion"
        }
        if question {
          next.state = .waiting
          next.waitingFor = Copy.localWaiting
        } else if message["stop_reason"]?.asString == "end_turn",
          blocks.isEmpty || blocks.contains(where: { $0["type"]?.asString == "text" })
        {
          next.state = .idle
          let id = message["id"].flatMap { $0 == .null ? nil : $0 }
            ?? row["uuid"].flatMap { $0 == .null ? nil : $0 }
          next.completion = AgentCompletion(
            id: id.map { jsString($0) } ?? at,
            at: at,
            summary: preview(blocks.first { $0["type"]?.asString == "text" }?["text"])
          )
        }
      }
      continue
    }

    let event = session.providerId == .codex ? payload : row
    let kind: String? =
      session.providerId == .codex && row["type"]?.asString != "event_msg"
      ? nil : event["type"]?.asString
    let busyPhases: Set<String> = [
      "streaming_text", "streaming_reasoning", "tool_execution", "waiting_for_model",
    ]

    switch kind {
    case "task_started", "turn_started", "tool_started", "loop_started":
      next.completion = nil
      work(at)
    case "phase_changed" where busyPhases.contains(jsString(event["phase"])):
      next.completion = nil
      work(at)
    case "task_complete":
      settle(at)
      next.completion = completion(event, at)
    case "turn_ended" where event["outcome"]?.asString == "completed":
      settle(at)
      next.completion = completion(event, at)
    case "turn_aborted", "task_interrupted", "turn_ended":
      next.completion = nil
      settle(at)
    case "permission_requested":
      next.completion = nil
      wait(at)
    case "phase_changed" where event["phase"]?.asString == "permission_prompt":
      next.completion = nil
      wait(at)
    case "permission_resolved":
      next.completion = nil
      work(at)
    default:
      break
    }

    // A pending synchronous user-input tool is a concrete request for input.
    // Asynchronous tools do not block, so they are not.
    if session.providerId == .codex, row["type"]?.asString == "response_item" {
      let type = jsString(payload["type"])
      let name = jsString(payload["name"])
      let isInputTool = name == "request_user_input" || name == "functions.request_user_input"
      if ["function_call", "custom_tool_call"].contains(type), isInputTool,
        let call = payload["call_id"]?.asString
      {
        next.completion = nil
        pendingInput = call
        wait(at)
      } else if ["function_call_output", "custom_tool_call_output"].contains(type),
        answers(payload["call_id"], pendingInput)
      {
        pendingInput = nil
        work(at)
      }
    }
  }
  if next.confirmed == true, next.state == .busy {
    next.detail = Copy.localWorking
  }
  return next
}

private func completion(_ event: [String: JSONValue], _ at: String) -> AgentCompletion {
  let turn = event["turn_id"].flatMap { $0 == .null ? nil : $0 }
  return AgentCompletion(
    id: turn.map { jsString($0) } ?? at, at: at,
    summary: preview(event["last_agent_message"])
  )
}

/// `payload.call_id === pendingInput`, strictly: with nothing pending, only an
/// explicit null matches — an absent field is `undefined`, which is not null.
private func answers(_ call: JSONValue?, _ pending: String?) -> Bool {
  guard let pending else { return call == .null }
  return call?.asString == pending
}
