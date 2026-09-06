// CAPSULE_VERIFY_CORNERS=1 node scripts/verify-notifications.cjs
// Reuses the isolated Electron launcher; provider requests remain blocked.
const assert = require("node:assert/strict");

module.exports = async (app, page, screenshot) => {
  assert.equal(
    (await page.evaluate(() => window.capsule.getSettings())).customCorner,
    "top-right",
  );
  await page.waitForSelector('[data-hud-corner="top-right"]');
  console.log(
    "PASS: startup recovers a previously enabled corner with auto-hide",
  );
  const cursorAt = async (point) =>
    app.evaluate(({ screen }, next) => {
      screen.getCursorScreenPoint = () => next;
    }, point);
  const outside = { x: -10000, y: -10000 };
  const display = await app.evaluate(
    ({ screen }) => screen.getPrimaryDisplay().bounds,
  );
  const set = async (patch) =>
    page.evaluate(async (next) => {
      return window.capsule.setSettings({
        ...(await window.capsule.getSettings()),
        ...next,
      });
    }, patch);
  for (const [preset, along, corner] of [
    ["right-edge", display.y, "top-right"],
    ["right-edge", display.y + display.height, "bottom-right"],
    ["left-edge", display.y, "top-left"],
    ["left-edge", display.y + display.height, "bottom-left"],
  ]) {
    await cursorAt(outside);
    await set({
      cornerArc: false,
      autoHide: true,
      placementPreset: preset,
      customPosition: { x: display.x, y: along },
      customCorner: null,
      hideDelay: "short",
      hudTheme: "graphite",
    });
    const settings = await set({ cornerArc: true });
    assert.equal(settings.customCorner, corner);
    assert.equal(settings.autoHide, true);
    await page.waitForSelector(
      `[data-hud-corner="${corner}"][data-corner-stowed="true"]`,
    );
    await screenshot(`${corner}-folded`);

    const latch = await page
      .locator('[data-hud-latch="true"]')
      .first()
      .boundingBox();
    assert.ok(latch);
    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBounds(),
    );
    await cursorAt({
      x: bounds.x + latch.x + latch.width / 2,
      y: bounds.y + latch.y + latch.height / 2,
    });
    await page.mouse.move(
      latch.x + latch.width / 2,
      latch.y + latch.height / 2,
    );
    await page.waitForSelector('[data-corner-stowed="false"]');
    await page.locator('[data-provider="claude"]').click();
    await page.getByText("Claude Usage", { exact: true }).waitFor();
    await screenshot(`${corner}-open`);
    const card = await page.locator('[data-card-wrap="true"]').boundingBox();
    const viewport = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
    assert.ok(
      card &&
        card.x >= -1 &&
        card.y >= -1 &&
        card.x + card.width <= viewport.width + 1 &&
        card.y + card.height <= viewport.height + 1,
    );

    await cursorAt(outside);
    await page.mouse.move(0, 0);
    await page.waitForSelector('[data-corner-stowed="true"]');
    await set({ autoHide: false });
    await page.waitForSelector('[data-corner-stowed="false"]');
    assert.equal(
      (await page.evaluate(() => window.capsule.getSettings())).customCorner,
      corner,
    );
    console.log(
      `PASS: ${corner} toggles, wakes, opens usage, hides, and stays visible with auto-hide off`,
    );
  }

  // Exercise the actual host drag path, then re-layout its persisted corner.
  await set({
    cornerArc: true,
    autoHide: true,
    customPosition: null,
    customCorner: null,
    placementPreset: "right-edge",
  });
  const start = {
    x: display.x + display.width - 1,
    y: display.y + display.height / 2,
  };
  await cursorAt(start);
  await page.evaluate(
    (point) => window.capsule.startMove(point.x, point.y),
    start,
  );
  await cursorAt({ x: display.x + display.width - 1, y: display.y + 20 });
  await page.waitForSelector('[data-hud-corner="top-right"]');
  await page.evaluate(() => window.capsule.endMove());
  assert.equal(
    (await page.evaluate(() => window.capsule.getSettings())).customCorner,
    "top-right",
  );
  console.log(
    "PASS: dragging into a corner persists its curve with auto-hide enabled",
  );
};
