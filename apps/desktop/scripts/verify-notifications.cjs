// Run after pnpm build. Supply CAPSULE_PLAYWRIGHT_PATH if Playwright is outside this workspace.
// All provider inputs are temporary local files. Demo mode and a fetch guard prevent account requests.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { _electron } = require(
  process.env.CAPSULE_PLAYWRIGHT_PATH || "playwright",
);

(async () => {
  const desktop = path.resolve(__dirname, "..");
  const home = await fs.mkdtemp(
    path.join("/private/tmp", "capsule-notifications-"),
  );
  const write = async (file, value) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  await write(path.join(home, "capsule-settings.json"), {
    settings: {
      schemaVersion: 6,
      placementPreset: "right-edge",
      enabledProviderIds: ["claude", "codex", "grok"],
      demoMode: true,
      pollIntervalMs: 60000,
      launchAtLogin: false,
      autoHide: false,
      notificationPopups: true,
    },
  });
  const entry = path.join(home, "launch.cjs");
  await write(
    entry,
    `const {app,screen}=require('electron');
    app.setPath('userData',${JSON.stringify(home)});app.setPath('home',${JSON.stringify(home)});
    app.getLoginItemSettings=()=>({openAtLogin:false});app.setLoginItemSettings=()=>{};
    globalThis.fetch=()=>{throw new Error('Account requests forbidden in UI verification')};
    app.whenReady().then(()=>{screen.getCursorScreenPoint=()=>({x:-10000,y:-10000})});
    import(${JSON.stringify(path.join(desktop, "out/main/index.js"))});`,
  );
  const env = { ...process.env, HOME: home };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({
    executablePath: require("electron"),
    args: [entry],
    env,
    timeout: 15000,
  });
  const watchdog = setTimeout(() => {
    console.error("Verification exceeded 90 seconds");
    app.process().kill("SIGKILL");
  }, 90000);
  try {
    const page = await app.firstWindow({ timeout: 15000 });
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => console.error(error));

    await page.waitForSelector('[data-provider="claude"]');
    await page.evaluate(async () => {
      const settings = await window.capsule.getSettings();
      await window.capsule.setSettings({ ...settings, autoHide: false });
    });
    console.log("Overlay ready");
    const append = async (file, event) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(
        file,
        `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`,
      );
    };
    const claude = path.join(
      home,
      ".claude/projects",
      home.replace(/[^a-zA-Z0-9_-]/g, "-"),
      "task.jsonl",
    );
    await append(claude, {
      type: "assistant",
      uuid: "tool",
      message: {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", name: "Read" }],
      },
    });
    await write(
      path.join(home, ".claude/sessions", `${app.process().pid}.json`),
      {
        pid: app.process().pid,
        sessionId: "task",
        cwd: home,
        startedAt: Date.now(),
        entrypoint: "claude-desktop",
      },
    );
    await page.waitForSelector(
      '[data-provider="claude"] [data-hud-activity="working"]',
    );
    console.log("Claude active");
    await append(claude, {
      type: "assistant",
      uuid: "done",
      message: {
        id: "reply",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Fixed the upload error." }],
      },
    });
    await page.waitForSelector('[data-activity-notices="claude"]');
    console.log("Claude notice visible");
    assert.equal(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isFocused(),
      ),
      false,
    );
    await page
      .getByRole("button", { name: "claude 1 Activity", exact: true })
      .evaluate((b) => b.click());
    await page
      .getByRole("button", { name: "claude Activity history", exact: true })
      .waitFor();
    assert.ok(
      await page.getByText("Fixed the upload error.", { exact: true }).count(),
    );
    await page.waitForTimeout(7300);
    await page
      .getByRole("button", { name: "claude Activity history", exact: true })
      .evaluate((b) => b.click());
    await page.waitForSelector('[data-activity-notices="claude"]');
    console.log("Claude notice visible");
    await page
      .getByRole("button", { name: /^Dismiss notification:/ })
      .evaluate((b) => b.click());
    assert.equal(
      await page
        .getByRole("button", { name: "claude Activity history", exact: true })
        .count(),
      0,
    );

    await page.evaluate(async () => {
      const s = await window.capsule.getSettings();
      await window.capsule.setSettings({ ...s, notificationPopups: false });
    });
    const grok = path.join(home, ".grok/sessions/project/current/events.jsonl");
    await append(grok, {
      type: "phase_changed",
      ts: new Date().toISOString(),
      phase: "streaming_text",
    });
    await page.waitForSelector(
      '[data-provider="grok"] [data-hud-activity="working"]',
    );
    await append(grok, {
      type: "turn_ended",
      ts: new Date().toISOString(),
      outcome: "completed",
    });
    await page
      .getByRole("button", { name: "grok 1 Activity", exact: true })
      .waitFor();
    assert.equal(
      await page.locator('[data-activity-notices="grok"]').count(),
      0,
    );
    assert.ok(
      await page
        .locator('[data-provider="grok"] [data-unread-notification]')
        .count(),
    );
    await page
      .getByRole("button", { name: "grok 1 Activity", exact: true })
      .evaluate((b) => b.click());
    await page.waitForSelector('[data-activity-notices="grok"]');
    await page
      .getByRole("button", { name: "grok Activity history", exact: true })
      .waitFor();

    const now = new Date();
    const codex = path.join(
      home,
      ".codex/sessions",
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
      "task.jsonl",
    );
    await append(codex, {
      type: "event_msg",
      payload: { type: "task_started", turn_id: "current" },
    });
    await page.waitForSelector(
      '[data-provider="codex"] [data-hud-activity="working"]',
    );
    await append(codex, {
      type: "event_msg",
      payload: {
        type: "task_complete",
        turn_id: "current",
        last_agent_message: "Verified all notification fixes.",
      },
    });
    await page
      .getByRole("button", { name: "codex 1 Activity", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "codex 1 Activity", exact: true })
      .evaluate((b) => b.click());
    await page
      .getByRole("button", { name: "codex Activity history", exact: true })
      .waitFor();
    assert.ok(
      await page
        .getByText("Verified all notification fixes.", { exact: true })
        .count(),
    );
    await page.locator('[data-provider="codex"]').evaluate((b) => b.click());
    await page.getByText("Codex Usage", { exact: true }).waitFor();

    assert.equal(
      await page.evaluate(
        async () => (await window.capsule.getSettings()).notificationPopups,
      ),
      false,
    );
    console.log(
      "PASS: real local-file readers → notification tracker → IPC → HUD; Claude/Grok/Codex activity, read/clear/history, popup preference, previews, usage navigation; no provider calls",
    );
  } finally {
    clearTimeout(watchdog);
    app.process().kill("SIGKILL");
    await app.close().catch(() => {});
    await fs.rm(home, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
