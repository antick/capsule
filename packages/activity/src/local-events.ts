import { ACTIVITY_NOTICES, type AgentSession } from "@capsule/config";

type Event = Record<string, unknown>;
export function records(raw: string | null): Event[] {
  if (!raw) return [];
  return raw.split("\n").flatMap((line) => {
    try {
      const value: unknown = JSON.parse(line);
      return value && typeof value === "object" && !Array.isArray(value)
        ? [value as Event]
        : [];
    } catch {
      return [];
    }
  });
}
function object(value: unknown): Event {
  return value && typeof value === "object" ? (value as Event) : {};
}
function time(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}

/** Read only event metadata. Never copy conversation or tool content to a popup. */
export function applyLocalEvents(
  session: AgentSession,
  raw: string | null,
): AgentSession {
  const next = { ...session };
  let pendingInput: string | null = null;
  for (const row of records(raw)) {
    const payload = object(row.payload);
    const at = time(row.timestamp ?? row.ts);
    if (!at) continue;
    if (session.providerId === "claude") {
      if (
        row.type === "assistant" &&
        object(row.message).stop_reason === "end_turn" &&
        typeof row.uuid === "string"
      ) {
        next.completion = { id: row.uuid, at };
      }
      continue;
    }
    const event = session.providerId === "codex" ? payload : row;
    const kind =
      session.providerId === "codex" && row.type !== "event_msg"
        ? null
        : event.type;
    if (kind === "task_started" || kind === "turn_started") {
      next.state = "busy";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = null;
    } else if (
      kind === "task_complete" ||
      (kind === "turn_ended" && event.outcome === "completed")
    ) {
      next.state = "idle";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = null;
      next.completion = { id: String(event.turn_id ?? at), at };
    } else if (
      kind === "turn_aborted" ||
      kind === "task_interrupted" ||
      kind === "turn_ended"
    ) {
      next.state = "idle";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = null;
    } else if (kind === "permission_requested") {
      next.state = "waiting";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = ACTIVITY_NOTICES.localWaiting;
    } else if (kind === "permission_resolved") {
      next.state = "busy";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = null;
    }
    // A pending synchronous user-input tool is a concrete input request. Async tools are not blocking.
    if (session.providerId === "codex" && row.type === "response_item") {
      if (
        ["function_call", "custom_tool_call"].includes(String(payload.type)) &&
        /^(?:functions\.)?request_user_input$/.test(String(payload.name)) &&
        typeof payload.call_id === "string"
      ) {
        pendingInput = payload.call_id;
        next.state = "waiting";
        next.confirmed = true;
        next.since = at;
        next.waitingFor = ACTIVITY_NOTICES.localWaiting;
      } else if (
        ["function_call_output", "custom_tool_call_output"].includes(
          String(payload.type),
        ) &&
        payload.call_id === pendingInput
      ) {
        pendingInput = null;
        next.state = "busy";
        next.confirmed = true;
        next.since = at;
        next.waitingFor = null;
      }
    }
  }
  return next;
}
