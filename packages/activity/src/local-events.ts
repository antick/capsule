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

/** Read local state markers and a bounded final-response preview. */
export function applyLocalEvents(
  session: AgentSession,
  raw: string | null,
): AgentSession {
  const next = { ...session };
  let pendingInput: string | null = null;
  for (const row of records(raw)) {
    const payload = object(row.payload);
    const at = time(row.timestamp ?? row.ts);
    if (
      session.providerId === "claude" &&
      row.type === "custom-title" &&
      typeof row.customTitle === "string"
    )
      next.name = row.customTitle.slice(0, ACTIVITY_NOTICES.maxTitleLength);
    if (!at) continue;
    if (session.providerId === "claude") {
      const message = object(row.message);
      const blocks = Array.isArray(message.content)
        ? message.content.map(object)
        : [];
      if (row.type === "user" || row.type === "assistant") {
        next.state = "busy";
        next.confirmed = true;
        next.since = at;
        next.waitingFor = null;
        delete next.completion;
      }
      if (row.type === "assistant") {
        const question = blocks.some(
          (block) =>
            block.type === "tool_use" && block.name === "AskUserQuestion",
        );
        if (question) {
          next.state = "waiting";
          next.waitingFor = ACTIVITY_NOTICES.localWaiting;
        } else if (
          message.stop_reason === "end_turn" &&
          (!blocks.length || blocks.some((block) => block.type === "text"))
        ) {
          next.state = "idle";
          next.completion = {
            id: String(message.id ?? row.uuid ?? at),
            at,
            summary: preview(
              blocks.find((block) => block.type === "text")?.text,
            ),
          };
        }
      }
      continue;
    }
    const event = session.providerId === "codex" ? payload : row;
    const kind =
      session.providerId === "codex" && row.type !== "event_msg"
        ? null
        : event.type;
    if (
      kind === "task_started" ||
      kind === "turn_started" ||
      kind === "tool_started" ||
      kind === "loop_started" ||
      (kind === "phase_changed" &&
        [
          "streaming_text",
          "streaming_reasoning",
          "tool_execution",
          "waiting_for_model",
        ].includes(String(event.phase)))
    ) {
      delete next.completion;
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
      next.completion = {
        id: String(event.turn_id ?? at),
        at,
        summary: preview(event.last_agent_message),
      };
    } else if (
      kind === "turn_aborted" ||
      kind === "task_interrupted" ||
      kind === "turn_ended"
    ) {
      delete next.completion;
      next.state = "idle";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = null;
    } else if (
      kind === "permission_requested" ||
      (kind === "phase_changed" && event.phase === "permission_prompt")
    ) {
      delete next.completion;
      next.state = "waiting";
      next.confirmed = true;
      next.since = at;
      next.waitingFor = ACTIVITY_NOTICES.localWaiting;
    } else if (kind === "permission_resolved") {
      delete next.completion;
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
        delete next.completion;
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
  if (next.confirmed && next.state === "busy")
    next.detail = ACTIVITY_NOTICES.localWorking;
  return next;
}

function preview(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .split("\n")
    .map((line) => line.replace(/^[#*\s>-]+/, "").trim())
    .find(Boolean)
    ?.slice(0, ACTIVITY_NOTICES.maxSummaryLength);
}
