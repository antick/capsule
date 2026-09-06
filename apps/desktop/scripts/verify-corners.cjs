// CAPSULE_VERIFY_CORNERS=1 node scripts/verify-notifications.cjs
// Reuses the isolated Electron launcher; provider requests remain blocked.
const assert = require("node:assert/strict");

module.exports = async (app, page) => {
  const current = await page.evaluate(() => window.capsule.getSettings());
  assert.equal(current.cornerArc, false);
  assert.equal(current.customCorner, null);
  assert.equal(await page.locator("[data-hud-corner]").count(), 0);

  const display = await app.evaluate(
    ({ screen }) => screen.getPrimaryDisplay().bounds,
  );
  for (const [preset, along, corner] of [
    ["right-edge", display.y, "top-right"],
    ["right-edge", display.y + display.height, "bottom-right"],
    ["left-edge", display.y, "top-left"],
    ["left-edge", display.y + display.height, "bottom-left"],
  ]) {
    const settings = await page.evaluate(
      async ({ preset, along, corner }) => {
        return window.capsule.setSettings({
          ...(await window.capsule.getSettings()),
          cornerArc: true,
          customCorner: corner,
          autoHide: true,
          placementPreset: preset,
          customPosition: { x: 0, y: along },
        });
      },
      { preset, along, corner },
    );
    assert.equal(settings.cornerArc, false);
    assert.equal(settings.customCorner, null);
    assert.equal(settings.autoHide, true);
    assert.equal(await page.locator("[data-hud-corner]").count(), 0);
  }

  const start = { x: display.x + 1, y: display.y + display.height / 2 };
  await app.evaluate(({ screen }, point) => {
    screen.getCursorScreenPoint = () => point;
  }, start);
  await page.evaluate(
    (point) => window.capsule.startMove(point.x, point.y),
    start,
  );
  await app.evaluate(({ screen }, bounds) => {
    screen.getCursorScreenPoint = () => ({ x: bounds.x + 1, y: bounds.y + 20 });
  }, display);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.capsule.endMove());
  assert.equal(
    (await page.evaluate(() => window.capsule.getSettings())).customCorner,
    null,
  );
  assert.equal(await page.locator("[data-hud-corner]").count(), 0);

  const settingsWindow = app.waitForEvent("window");
  await page.evaluate(() => window.capsule.openSettings("/"));
  const settingsPage = await settingsWindow;
  await settingsPage.getByText("Dock style", { exact: true }).waitFor();
  assert.equal(
    await settingsPage
      .getByRole("switch", { name: "Curl into corners" })
      .count(),
    0,
  );
  console.log(
    "PASS: saved settings, IPC changes, corner drags, and settings UI cannot enable corner curves; auto-hide is preserved",
  );
};
