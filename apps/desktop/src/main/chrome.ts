import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChromeSnapshot, DockOrientation } from "@capsule/config";

const execFileAsync = promisify(execFile);

async function defaultsRead(
  domain: string,
  key: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("defaults", ["read", domain, key]);
    return stdout.trim();
  } catch {
    return null;
  }
}

function parseDockOrientation(value: string | null): DockOrientation {
  if (value === "left" || value === "right") {
    return value;
  }
  return "bottom";
}

export async function readChromeSnapshot(display: {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
}): Promise<ChromeSnapshot> {
  const [orientation, autohide, tilesize] = await Promise.all([
    defaultsRead("com.apple.dock", "orientation"),
    defaultsRead("com.apple.dock", "autohide"),
    defaultsRead("com.apple.dock", "tilesize"),
  ]);

  return {
    display,
    dock: {
      orientation: parseDockOrientation(orientation),
      autohide: autohide === "1",
      tilesize: Number(tilesize ?? "48") || 48,
    },
  };
}
