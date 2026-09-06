import {
  ACTIVITY_NOTICES,
  type ActivityNotice,
  type AgentSession,
  COPY,
  cardReserveHeight,
  DEMO_NOW_ISO,
  DEMO_SNAPSHOTS,
  hudMetrics,
} from "@capsule/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dockCardHeight } from "./DockCard.tsx";
import { UsageDock } from "./UsageDock.tsx";

const snapshot = DEMO_SNAPSHOTS.find((item) => item.providerId === "codex");
if (!snapshot) throw new Error("Missing Codex demo snapshot");
const disabled = {
  ...snapshot,
  status: "disabled" as const,
  primaryPercent: null,
  buckets: [],
};
const notice: ActivityNotice = {
  id: "turn-1",
  sessionId: "session-1",
  providerId: "codex",
  kind: "completed",
  title: "Fix the booking screen",
  at: DEMO_NOW_ISO,
};
const session: AgentSession = {
  id: "session-1",
  providerId: "codex",
  name: "Booking screen",
  detail: "Recent local activity",
  state: "busy",
  confirmed: false,
  waitingFor: null,
  since: DEMO_NOW_ISO,
};

function render(notices: ActivityNotice[], corner?: "bottom-left") {
  return renderToStaticMarkup(
    createElement(UsageDock, {
      snapshots: [disabled],
      notices,
      orientation: "vertical",
      cardGrowth: "right",
      autoHide: true,
      now: new Date(DEMO_NOW_ISO),
      corner,
    }),
  );
}

describe("activity notices", () => {
  it("keeps a folded corner reachable and unfolds it for notifications", () => {
    const folded = render([], "bottom-left");
    expect(folded).toContain('data-corner-stowed="true"');
    expect(folded).toContain('data-hud-latch="true" data-hud-hit="true"');
    expect(folded).toContain("visibility:hidden");
    const notified = render([notice], "bottom-left");
    expect(notified).toContain('data-corner-stowed="false"');
    expect(notified).toContain('data-activity-notices="codex"');
    expect(notified).not.toContain("visibility:hidden");
    const arc = (html: string) =>
      html.match(/data-hud-rail-shape="true"[^>]*>.*?<path d="([^"]+)"/s)?.[1];
    expect(arc(folded)).toBeDefined();
    expect(arc(folded)).not.toBe(arc(notified));
  });
  it("links from usage to unread notifications without replacing usage", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: [disabled],
        notices: [notice],
        notificationPopups: false,
        forceOpenProviderId: "codex",
        orientation: "vertical",
        cardGrowth: "left",
      }),
    );
    expect(html).toContain("Codex Usage");
    expect(html).toContain('aria-label="View notifications (1)"');
    expect(html).not.toContain('data-activity-notices="codex"');
  });

  it("temporarily unfolds a notification card for a completed turn", () => {
    const html = render([notice]);
    expect(html).toContain('data-card-open="true"');
    expect(html).toContain('data-activity-notices="codex"');
    expect(html).toContain("Fix the booking screen");
    expect(html).toContain(COPY.noticeCompleted);
    expect(html).not.toContain("Codex Usage");
    expect(html).not.toContain('data-hud-latch="true" data-hud-hit="true"');
  });

  it("keeps every notification in a scrollable list with dismiss controls", () => {
    const notices = Array.from(
      { length: ACTIVITY_NOTICES.maxVisible + 2 },
      (_, index) => ({
        ...notice,
        id: `turn-${index}`,
        kind: "waiting" as const,
      }),
    );
    const html = render(notices);
    expect(html.match(/data-notice="waiting"/g)).toHaveLength(notices.length);
    expect(html).toContain(`data-waiting-count="${notices.length}"`);
    expect(html).toContain("overflow-y:auto");
    expect(html).toContain(COPY.noticeDismiss);
    expect(html).toContain(">—</span>");
    expect(html).toContain(
      `aria-label="codex ${notices.length} ${COPY.noticeTitle}"`,
    );
    expect(html).toContain('aria-label="codex —"');
    expect(
      dockCardHeight(hudMetrics(), disabled, 0, notices.length),
    ).toBeLessThanOrEqual(cardReserveHeight(hudMetrics()));
  });

  it("keeps earlier providers discoverable when a newer provider opens", () => {
    const claude = DEMO_SNAPSHOTS.find((item) => item.providerId === "claude");
    if (!claude) throw new Error("Missing Claude demo snapshot");
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: [disabled, claude],
        notices: [notice, { ...notice, id: "turn-2", providerId: "claude" }],
        orientation: "horizontal",
        cardGrowth: "up",
      }),
    );
    expect(html).toContain('data-activity-notices="claude"');
    expect(html.match(/data-notice-count="1"/g)).toHaveLength(2);
  });

  it("keeps usage percentages and a separate notification button while an alert is open", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: DEMO_SNAPSHOTS,
        notices: [notice],
        orientation: "vertical",
        cardGrowth: "left",
      }),
    );
    expect(html).toContain(">73%<");
    expect(html).toContain(">21%<");
    expect(html).toContain(">52%<");
    expect(html).toContain('aria-label="codex 21%"');
    expect(html).toMatch(
      /<button[^>]*data-notice-count="1"[^>]*aria-label="codex 1/,
    );
    expect(html).toContain('data-activity-notices="codex"');
  });

  it("uses the same notification content in a corner frame", () => {
    expect(render([notice], "bottom-left")).toContain(
      'data-activity-notices="codex"',
    );
  });

  it("does not describe a recent log hint as a confirmed working session", () => {
    const html = renderToStaticMarkup(
      createElement(UsageDock, {
        snapshots: [disabled],
        activity: { codex: [session] },
        orientation: "vertical",
        cardGrowth: "right",
        forceOpenProviderId: "codex",
      }),
    );
    expect(html).toContain(COPY.sessionUnknown);
    expect(html).toContain(COPY.usageDisabled);
    expect(html).toContain("Codex Usage");
    expect(html).not.toContain('data-hud-status="busy"');
  });
});

it("keeps popup-off alerts as unread badges and animations without opening a card", () => {
  const html = renderToStaticMarkup(
    createElement(UsageDock, {
      snapshots: DEMO_SNAPSHOTS,
      notices: [notice],
      notificationPopups: false,
      orientation: "vertical",
      cardGrowth: "left",
      autoHide: true,
    }),
  );
  expect(html).toContain('data-notice-count="1"');
  expect(html).toContain('data-unread-notification="true"');
  expect(html).not.toContain('data-card-open="true"');
});

it("read history has no numeric unread badge and working sessions cannot impersonate notifications", () => {
  const html = renderToStaticMarkup(
    createElement(UsageDock, {
      snapshots: [disabled],
      notices: [{ ...notice, read: true }],
      activity: { codex: [{ ...session, confirmed: true }] },
      orientation: "vertical",
      cardGrowth: "left",
    }),
  );
  expect(html).toContain('data-notice-count="0"');
  expect(html).toContain(COPY.noticeHistory);
  expect(html).not.toContain('data-unread-notification="true"');
  expect(html).toContain('data-hud-activity="working"');
});
