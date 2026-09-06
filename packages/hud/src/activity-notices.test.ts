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
  it("unfolds the dock and replaces the usage card with the completed turn", () => {
    const html = render([notice]);
    expect(html).toContain('data-card-open="true"');
    expect(html).toContain('data-activity-notices="codex"');
    expect(html).toContain("Fix the booking screen");
    expect(html).toContain(COPY.noticeCompleted);
    expect(html).not.toContain("Codex Usage");
    expect(html).not.toContain('data-hud-latch="true" data-hud-hit="true"');
  });

  it("groups bursts into bounded rows, with a waiting count and dismiss controls", () => {
    const notices = Array.from(
      { length: ACTIVITY_NOTICES.maxVisible + 2 },
      (_, index) => ({
        ...notice,
        id: `turn-${index}`,
        kind: "waiting" as const,
      }),
    );
    const html = render(notices);
    expect(html.match(/data-notice="waiting"/g)).toHaveLength(
      ACTIVITY_NOTICES.maxVisible,
    );
    expect(html).toContain(`data-waiting-count="${notices.length}"`);
    expect(html).toContain(`+2 ${COPY.noticeMore}`);
    expect(html).toContain(COPY.noticeDismiss);
    expect(html).toContain(`>${COPY.sessionWaiting}</span>`);
    expect(html).not.toContain(
      `>${notices.length} ${COPY.noticeWaitingSuffix}</span>`,
    );
    expect(html).toContain(
      `aria-label="codex ${notices.length} ${COPY.noticeWaitingSuffix}`,
    );
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
    expect(html).toContain(`0${COPY.activityWorkingSuffix}`);
    expect(html).not.toContain('data-hud-status="busy"');
  });
});
