import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { CodexConnection, codexMessages } from "./codex-connection.ts";
import { JsonRpc, record } from "./json-rpc.ts";

function harness(
  handler: (method: string, params: Record<string, unknown>) => unknown,
) {
  const input = new PassThrough();
  const output = new PassThrough();
  const sent: Record<string, unknown>[] = [];
  let connection: CodexConnection;
  const rpc = new JsonRpc(
    input,
    output,
    () => {},
    (message) => connection.event(message),
    100,
  );
  connection = new CodexConnection(rpc);
  output.on("data", (chunk) => {
    const message = record(JSON.parse(String(chunk)));
    sent.push(message);
    if (typeof message.method !== "string" || message.id === undefined) return;
    try {
      const result = handler(message.method, record(message.params));
      input.write(`${JSON.stringify({ id: message.id, result })}\n`);
    } catch (error) {
      input.write(
        `${JSON.stringify({ id: message.id, error: { message: error instanceof Error ? error.message : "Missing thread" } })}\n`,
      );
    }
  });
  return { connection, rpc, input, sent };
}

describe("Codex message routing", () => {
  it("keeps the session when only its transcript is unavailable", async () => {
    const h = harness((method) => {
      if (method === "thread/loaded/list") return { data: ["a"] };
      if (method === "thread/turns/list")
        throw new Error("History unavailable");
      return { thread: { id: "a", status: { type: "idle" } } };
    });
    const sessions = await h.connection.sessions("codex.a");
    expect(sessions.map((s) => s.id)).toEqual(["codex.a"]);
    expect(sessions[0]?.note).toContain("could not be loaded");
    h.rpc.close();
  });
  it("falls back when the installed store cannot page turns", async () => {
    const h = harness((method, params) => {
      if (method === "thread/loaded/list") return { data: ["a"] };
      if (method === "thread/turns/list")
        throw new Error("list_turns is not supported yet");
      if (method === "thread/read")
        return {
          thread: {
            id: "a",
            status: { type: "active" },
            ...(params.includeTurns
              ? {
                  turns: [
                    {
                      id: "turn-live",
                      status: "inProgress",
                      items: [
                        { id: "answer", type: "agentMessage", text: "Working" },
                      ],
                    },
                  ],
                }
              : {}),
          },
        };
      return {};
    });
    expect((await h.connection.sessions("codex.a"))[0]?.messages[0]?.text).toBe(
      "Working",
    );
    await h.connection.send("codex.a", "Continue");
    expect(
      record(h.sent.find((m) => m.method === "turn/steer")?.params)
        .expectedTurnId,
    ).toBe("turn-live");
    expect(h.sent.filter((m) => m.method === "thread/turns/list")).toHaveLength(
      1,
    );
    h.rpc.close();
  });
  it("steers exactly the active turn, starts an idle follow-up, never resumes", async () => {
    const h = harness((method, params) => {
      if (method === "thread/read")
        return {
          thread: {
            id: params.threadId,
            status: { type: params.threadId === "working" ? "active" : "idle" },
          },
        };
      if (method === "thread/turns/list")
        return { data: [{ id: "turn-1", status: "inProgress" }] };
      return {};
    });
    await h.connection.send("codex.working", "Check the notch");
    await h.connection.send("codex.idle", "Continue");
    expect(h.sent.find((m) => m.method === "turn/steer")?.params).toEqual({
      threadId: "working",
      expectedTurnId: "turn-1",
      input: [{ type: "text", text: "Check the notch" }],
    });
    expect(h.sent.find((m) => m.method === "turn/start")?.params).toEqual({
      threadId: "idle",
      input: [{ type: "text", text: "Continue" }],
    });
    expect(h.sent.some((m) => m.method === "thread/resume")).toBe(false);
    h.rpc.close();
  });

  it("rejects a finished-turn race instead of resending into a new turn", async () => {
    const h = harness((method) =>
      method === "thread/read"
        ? { thread: { id: "a", status: { type: "active" } } }
        : { data: [{ id: "old", status: "completed" }] },
    );
    await expect(h.connection.send("codex.a", "Hello")).rejects.toThrow(
      "just finished",
    );
    expect(
      h.sent.some(
        (m) => m.method === "turn/start" || m.method === "turn/steer",
      ),
    ).toBe(false);
    h.rpc.close();
  });

  it("keeps healthy sessions when one disappears and reads only the selected conversation", async () => {
    const h = harness((method, params) => {
      if (method === "thread/loaded/list") return { data: ["a", "gone", "b"] };
      if (method === "thread/read") {
        if (params.threadId === "gone") throw new Error("Gone");
        return {
          thread: {
            id: params.threadId,
            name: params.threadId,
            status: { type: "idle" },
          },
        };
      }
      return { data: [] };
    });
    expect((await h.connection.sessions("codex.a")).map((s) => s.id)).toEqual([
      "codex.a",
      "codex.b",
    ]);
    expect(
      h.sent
        .filter((m) => m.method === "thread/turns/list")
        .map((m) => record(m.params).threadId),
    ).toEqual(["a"]);
    h.rpc.close();
  });

  it("scopes approvals, honors allowed decisions, and removes resolved requests", async () => {
    const h = harness((method) =>
      method === "thread/loaded/list"
        ? { data: ["a"] }
        : { thread: { id: "a", status: { type: "active" } } },
    );
    const request = {
      id: 7,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "a",
        turnId: "t",
        command: "pnpm test",
        availableDecisions: ["accept", "decline"],
      },
    };
    h.connection.event(request);
    const session = (await h.connection.sessions(null))[0];
    expect(session?.request?.canApprove).toBe(true);
    const id = session?.request?.id ?? "";
    expect(() => h.connection.respond("codex.other", id, true)).toThrow();
    h.connection.respond("codex.a", id, true);
    expect(h.sent.at(-1)).toEqual({ id: 7, result: { decision: "accept" } });
    expect(() => h.connection.respond("codex.a", id, true)).toThrow();
    h.connection.event({
      ...request,
      params: { ...request.params, availableDecisions: ["decline"] },
    });
    const restricted = (await h.connection.sessions(null))[0]?.request;
    expect(restricted?.canApprove).toBe(false);
    expect(() =>
      h.connection.respond("codex.a", restricted?.id ?? "", true),
    ).toThrow();
    h.connection.event({
      method: "serverRequest/resolved",
      params: { requestId: 7 },
    });
    expect((await h.connection.sessions(null))[0]?.request).toBeUndefined();
    h.connection.event({
      ...request,
      method: "item/fileChange/requestApproval",
    });
    const file = (await h.connection.sessions(null))[0]?.request;
    expect(file?.canApprove).toBe(false);
    expect(() =>
      h.connection.respond("codex.a", file?.id ?? "", true),
    ).toThrow();
    h.connection.event({ method: "turn/completed", params: { threadId: "a" } });
    expect((await h.connection.sessions(null))[0]?.request).toBeUndefined();
    h.rpc.close();
  });

  it("extracts user-facing text without tool output or reasoning", () => {
    expect(
      codexMessages([
        {
          items: [
            {
              id: "u",
              type: "userMessage",
              content: [{ type: "text", text: "Hello" }],
            },
            { id: "secret", type: "reasoning", text: "hidden" },
            { id: "a", type: "agentMessage", text: "Hi" },
          ],
        },
      ]),
    ).toEqual([
      { id: "u", role: "user", text: "Hello" },
      { id: "a", role: "assistant", text: "Hi" },
    ]);
  });
});

describe("local JSON RPC", () => {
  it("routes out-of-order split frames and rejects a disconnect without retry", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const rpc = new JsonRpc(input, output, () => {});
    const a = rpc.request("a");
    const b = rpc.request("b");
    input.write('{"id":2,"result":"second"}\n{"id":');
    input.write('1,"result":"first"}\n');
    expect(await a).toBe("first");
    expect(await b).toBe("second");
    const pending = rpc.request("send");
    const failure = expect(pending).rejects.toThrow(
      "Delivery could not be confirmed",
    );
    rpc.close();
    await failure;
    expect(rpc.connected).toBe(false);
  });
});
