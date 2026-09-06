import {
  AGENT_COPY,
  AGENTS,
  type ConnectedAgent,
  HUD_THEMES,
  orderSessions,
} from "@capsule/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentConversation, AgentList, AgentSetup } from "./components.tsx";

const session: ConnectedAgent = {
  id: "codex-1",
  providerId: "codex",
  name: "Fix navigation",
  detail: "/project/capsule",
  state: "busy",
  waitingFor: null,
  since: "2026-09-06T12:00:00.000Z",
  connection: "connected",
  note: AGENT_COPY.codexNote,
  messages: [
    {
      id: "m1",
      role: "assistant",
      text: "<script>alert('unsafe')</script>\nA normal reply",
    },
  ],
};

const conversation = (
  overrides: Partial<Parameters<typeof AgentConversation>[0]> = {},
) =>
  renderToStaticMarkup(
    createElement(AgentConversation, {
      session,
      draft: "Keep this draft",
      onDraft: () => {},
      onSend: () => {},
      onRespond: () => {},
      theme: HUD_THEMES.midnight,
      ...overrides,
    }),
  );

describe("agent panel", () => {
  it("puts waiting sessions first and filters by provider", () => {
    const sessions = orderSessions([
      session,
      {
        ...session,
        id: "claude-1",
        providerId: "claude" as const,
        state: "waiting" as const,
        name: "Approve change",
      },
    ]);
    const render = (filter: "all" | "codex") =>
      renderToStaticMarkup(
        createElement(AgentList, {
          sessions,
          filter,
          onFilter: () => {},
          onSelect: () => {},
          theme: HUD_THEMES.midnight,
        }),
      );
    expect(render("all").indexOf("Approve change")).toBeLessThan(
      render("all").indexOf("Fix navigation"),
    );
    expect(render("codex")).not.toContain("Approve change");
    expect(render("codex")).toContain("Fix navigation");
  });

  it("escapes provider messages and limits the composer input", () => {
    const html = conversation();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain(`maxLength="${AGENTS.maxMessageLength}"`);
    expect(html).toContain("Keep this draft");
  });

  it("disables sending for observed sessions and pending sends", () => {
    const viewOnly = conversation({
      session: { ...session, connection: "view-only" },
    });
    expect(viewOnly).toContain(AGENT_COPY.viewOnly);
    expect(viewOnly).toMatch(/<textarea[^>]*disabled=""/);
    expect(viewOnly).toMatch(/<button[^>]*disabled=""/);
    const pending = conversation({ sendState: "sending" });
    expect(pending).toMatch(/<button[^>]*disabled=""/);
    expect(pending).toContain(AGENT_COPY.sending);
    expect(conversation({ draft: "   " })).toMatch(/<button[^>]*disabled=""/);
  });

  it("shows uncertain delivery without discarding the draft", () => {
    const html = conversation({ sendState: "error" });
    expect(html).toContain(AGENT_COPY.uncertain);
    expect(html).toContain("Keep this draft");
  });

  it("shows the complete permission request and blocks ordinary messages", () => {
    const request = {
      id: "approval-1",
      title: "Run this command?",
      detail: "rm example.txt\n/project/capsule",
      canApprove: true,
    };
    const html = conversation({ session: { ...session, request } });
    expect(html).toContain("rm example.txt");
    expect(html).toContain(AGENT_COPY.approveOnce);
    expect(html).toContain(AGENT_COPY.decline);
    expect(html).toMatch(/class="send-button" disabled=""/);
    expect(html).toContain("Keep this draft");
    const unsupported = conversation({
      session: { ...session, request: { ...request, canApprove: false } },
    });
    expect(unsupported).not.toContain(AGENT_COPY.approveOnce);
    expect(unsupported).toContain(AGENT_COPY.decline);
  });

  it("keeps setup commands selectable and explains provider permissions", () => {
    const html = renderToStaticMarkup(
      createElement(AgentSetup, {
        connections: [],
        setup: {
          claude: "claude --channels capsule",
          codex: "Enable control connection",
        },
        failed: false,
      }),
    );
    expect(html).toContain("<details");
    expect(html).toContain("claude --channels capsule");
    expect(html).toContain(AGENT_COPY.setupHint);
  });
});
