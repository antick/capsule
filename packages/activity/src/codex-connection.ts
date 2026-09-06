import { randomUUID } from "node:crypto";
import {
  AGENT_COPY,
  AGENTS,
  type AgentMessage,
  type ConnectedAgent,
  validAgentMessage,
} from "@capsule/config";
import { type JsonRpc, record } from "./json-rpc.ts";

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function codexMessages(turns: unknown): AgentMessage[] {
  if (!Array.isArray(turns)) return [];
  return turns
    .flatMap((turn) => {
      const items = record(turn).items;
      if (!Array.isArray(items)) return [];
      return items.flatMap((value): AgentMessage[] => {
        const item = record(value);
        const role =
          item.type === "userMessage"
            ? "user"
            : item.type === "agentMessage"
              ? "assistant"
              : null;
        if (!role || typeof item.id !== "string") return [];
        const text =
          role === "assistant"
            ? string(item.text)
            : Array.isArray(item.content)
              ? item.content
                  .map((part) =>
                    record(part).type === "text"
                      ? string(record(part).text)
                      : "",
                  )
                  .filter(Boolean)
                  .join("\n")
              : "";
        return text
          ? [
              {
                id: item.id,
                role,
                text: text.slice(0, AGENTS.maxMessageLength),
              },
            ]
          : [];
      });
    })
    .slice(-AGENTS.maxMessages);
}

/** Observes loaded conversations only. It never resumes a second copy of a session. */
export class CodexConnection {
  private epoch = randomUUID();
  private paginatedTurns = true;
  private messages = new Map<string, AgentMessage[]>();
  private requests = new Map<string, Record<string, unknown>>();
  private errors = new Map<string, string>();
  constructor(readonly rpc: JsonRpc) {}

  async initialize(): Promise<void> {
    await this.rpc.request("initialize", {
      clientInfo: { name: "capsule", version: AGENTS.channelVersion },
      capabilities: { experimentalApi: true },
    });
    this.rpc.write({ method: "initialized" });
  }

  async sessions(selected: string | null): Promise<ConnectedAgent[]> {
    const result = record(
      await this.rpc.request("thread/loaded/list", {
        limit: AGENTS.maxSessions,
      }),
    );
    if (!Array.isArray(result.data))
      throw new Error("Invalid Codex session list");
    const ids = result.data
      .filter((id): id is string => typeof id === "string")
      .slice(0, AGENTS.maxSessions);
    const sessions = await Promise.allSettled(
      ids.map(async (id) => {
        const thread = record(
          record(await this.rpc.request("thread/read", { threadId: id }))
            .thread,
        );
        if (thread.id !== id)
          throw new Error("Codex returned a different session");
        const status = record(thread.status);
        let historyError: string | undefined;
        if (selected === `codex.${id}` && thread.ephemeral !== true) {
          try {
            this.messages.set(
              id,
              codexMessages(await this.readTurns(id, true)),
            );
          } catch {
            historyError = AGENT_COPY.historyUnavailable;
          }
        }
        const flags = Array.isArray(status.activeFlags)
          ? status.activeFlags
          : [];
        const waiting =
          Boolean(this.requestFor(id)) ||
          flags.includes("waitingOnApproval") ||
          flags.includes("waitingOnUserInput");
        const state = waiting
          ? "waiting"
          : status.type === "active"
            ? "busy"
            : "idle";
        const updatedAt =
          typeof thread.updatedAt === "number"
            ? new Date(thread.updatedAt * 1000)
            : new Date();
        return {
          id: `codex.${id}`,
          providerId: "codex",
          name:
            string(thread.name) ||
            string(thread.preview).slice(0, 100) ||
            "Codex",
          detail: string(thread.cwd),
          state,
          waitingFor: waiting ? "Respond in Codex" : null,
          since: Number.isFinite(updatedAt.getTime())
            ? updatedAt.toISOString()
            : new Date().toISOString(),
          connection:
            thread.ephemeral !== true &&
            (status.type === "active" || status.type === "idle")
              ? "connected"
              : "view-only",
          messages: this.messages.get(id) ?? [],
          note:
            thread.ephemeral === true
              ? AGENT_COPY.codexEphemeral
              : (historyError ?? this.errors.get(id) ?? AGENT_COPY.codexNote),
          request: this.requestFor(id),
        } satisfies ConnectedAgent;
      }),
    );
    for (const id of this.messages.keys())
      if (!ids.includes(id)) this.messages.delete(id);
    return sessions.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
  }

  async send(id: string, text: string): Promise<void> {
    if (!validAgentMessage(text) || !id.startsWith("codex."))
      throw new Error("Invalid message");
    const threadId = id.slice("codex.".length);
    if (this.requestFor(threadId))
      throw new Error("Answer the pending request first");
    const thread = record(
      record(await this.rpc.request("thread/read", { threadId })).thread,
    );
    const status = record(thread.status);
    if (
      thread.ephemeral === true ||
      thread.id !== threadId ||
      !["active", "idle"].includes(string(status.type))
    )
      throw new Error("Session is no longer connected");
    const input = [{ type: "text", text }];
    if (status.type === "active") {
      const turn = record((await this.readTurns(threadId, false)).at(-1));
      if (turn.status !== "inProgress" || typeof turn.id !== "string")
        throw new Error(
          "This turn just finished. Check the session before sending again.",
        );
      await this.rpc.request("turn/steer", {
        threadId,
        expectedTurnId: turn.id,
        input,
      });
    } else {
      await this.rpc.request("turn/start", { threadId, input });
    }
  }

  event(message: Record<string, unknown>): void {
    const params = record(message.params);
    if (message.method === "serverRequest/resolved") {
      this.requests.delete(this.requestKey(params.requestId));
    } else if (
      message.method === "turn/completed" ||
      message.method === "thread/closed"
    ) {
      for (const [key, pending] of this.requests) {
        if (record(pending.params).threadId === params.threadId)
          this.requests.delete(key);
      }
    } else if (
      message.method === "error" &&
      typeof params.threadId === "string"
    ) {
      this.errors.set(
        params.threadId,
        String(record(params.error).message ?? "Codex reported an error"),
      );
    } else if (
      typeof message.id === "number" ||
      typeof message.id === "string"
    ) {
      const supported = [
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
        "item/permissions/requestApproval",
      ].includes(String(message.method));
      if (supported && typeof params.threadId === "string") {
        this.requests.set(this.requestKey(message.id), message);
      } else {
        this.rpc.write({
          id: message.id,
          error: {
            code: -32601,
            message:
              "This request needs the full Codex client. Capsule cannot answer it.",
          },
        });
        if (typeof params.threadId === "string")
          this.errors.set(params.threadId, AGENT_COPY.codexUnsupported);
      }
    }
  }

  private requestFor(threadId: string): ConnectedAgent["request"] {
    const pending = [...this.requests.values()].find(
      (message) => record(message.params).threadId === threadId,
    );
    if (!pending) return undefined;
    return {
      id: this.requestKey(pending.id),
      title: AGENT_COPY.codexApprovalTitle,
      detail: JSON.stringify(pending.params, null, 2),
      canApprove: this.canApprove(pending),
    };
  }

  respond(id: string, requestId: string, approve: boolean): void {
    const pending = this.requests.get(requestId);
    if (
      !pending ||
      record(pending.params).threadId !== id.slice("codex.".length)
    )
      throw new Error("This request is no longer pending");
    if (approve && !this.canApprove(pending))
      throw new Error("Review this permission in Codex");
    this.rpc.write({
      id: pending.id,
      result:
        pending.method === "item/permissions/requestApproval"
          ? { permissions: {} }
          : { decision: approve ? "accept" : "decline" },
    });
    this.requests.delete(requestId);
  }

  private requestKey(id: unknown): string {
    return `${this.epoch}:${typeof id}:${String(id)}`;
  }

  private async readTurns(
    threadId: string,
    withMessages: boolean,
  ): Promise<unknown[]> {
    if (this.paginatedTurns) {
      try {
        const result = record(
          await this.rpc.request("thread/turns/list", {
            threadId,
            limit: withMessages ? 4 : 1,
            sortDirection: "desc",
            itemsView: withMessages ? "full" : "notLoaded",
          }),
        );
        if (!Array.isArray(result.data)) throw new Error("Invalid Codex turns");
        return [...result.data].reverse();
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !/not supported|unsupported|not found|unknown method/i.test(
            error.message,
          )
        )
          throw error;
        this.paginatedTurns = false;
      }
    }
    // Older stores expose only full-history reads; the transport's byte cap still applies.
    const thread = record(
      record(
        await this.rpc.request("thread/read", { threadId, includeTurns: true }),
      ).thread,
    );
    if (thread.id !== threadId || !Array.isArray(thread.turns))
      throw new Error("Codex conversation is unavailable");
    return thread.turns;
  }

  private canApprove(pending: Record<string, unknown>): boolean {
    const params = record(pending.params);
    return (
      pending.method === "item/commandExecution/requestApproval" &&
      typeof params.command === "string" &&
      params.command.trim().length > 0 &&
      (!Array.isArray(params.availableDecisions) ||
        params.availableDecisions.includes("accept"))
    );
  }
}
