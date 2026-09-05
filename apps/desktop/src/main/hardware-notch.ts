import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { FAKE_NOTCH_ENV, type HardwareNotch } from "@capsule/config";

const execFileAsync = promisify(execFile);

/** One screen as AppKit describes it, in points. */
export interface NotchProbeScreen {
  w: number;
  h: number;
  /** `safeAreaInsets.top`: the notch's height, or zero. */
  top: number;
  /** The two menu-bar strips either side of the notch, or zero. */
  left: number;
  right: number;
}

/**
 * Electron does not know about the camera housing, but AppKit does: the two
 * menu-bar strips either side of it are the only thing it describes directly,
 * and `safeAreaInsets.top` gives the height. Asked through the JavaScript
 * bridge to AppKit rather than a native module.
 */
const PROBE = `ObjC.import("AppKit");
const out = [];
const screens = $.NSScreen.screens;
for (let i = 0; i < screens.count; i++) {
  const s = screens.objectAtIndex(i);
  const f = s.frame;
  const l = s.auxiliaryTopLeftArea;
  const r = s.auxiliaryTopRightArea;
  out.push({
    w: f.size.width, h: f.size.height, top: s.safeAreaInsets.top,
    left: l ? l.size.width : 0, right: r ? r.size.width : 0,
  });
}
JSON.stringify(out);`;

/**
 * The notch on the display of this size, if it has one. Screens are matched
 * by size because AppKit's origin and Electron's disagree; a display without a
 * notch reports no auxiliary areas, so it simply does not qualify.
 */
export function notchFromProbe(
  screens: readonly NotchProbeScreen[],
  display: { bounds: { width: number; height: number } },
): HardwareNotch | null {
  for (const screen of screens) {
    if (
      screen.w !== display.bounds.width ||
      screen.h !== display.bounds.height
    ) {
      continue;
    }
    const width = screen.w - screen.left - screen.right;
    const height = screen.top;
    if (screen.left > 0 && screen.right > 0 && width > 0 && height > 0) {
      return { width: Math.round(width), height: Math.round(height) };
    }
  }
  return null;
}

/** A notch to pretend the display has, from "200x37"; nothing otherwise. */
export function fakeNotchFrom(value: string | undefined): HardwareNotch | null {
  const match = value?.trim().match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export async function probeScreens(): Promise<NotchProbeScreen[]> {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-l",
      "JavaScript",
      "-e",
      PROBE,
    ]);
    const parsed: unknown = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? (parsed as NotchProbeScreen[]) : [];
  } catch {
    return [];
  }
}

/**
 * Remembers the answer per display, because the probe is a process spawn and
 * the overlay re-lays itself out every couple of seconds. Screens do not grow
 * notches, so the cache only ever empties when the display set changes.
 */
export class HardwareNotchReader {
  private cache = new Map<number, HardwareNotch | null>();
  private pending: Promise<NotchProbeScreen[]> | null = null;

  async read(display: {
    id: number;
    bounds: { width: number; height: number };
  }): Promise<HardwareNotch | null> {
    const pretend = fakeNotchFrom(process.env[FAKE_NOTCH_ENV]);
    if (pretend) {
      return pretend;
    }
    const known = this.cache.get(display.id);
    if (known !== undefined) {
      return known;
    }
    this.pending ??= probeScreens().finally(() => {
      this.pending = null;
    });
    const notch = notchFromProbe(await this.pending, display);
    this.cache.set(display.id, notch);
    return notch;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
