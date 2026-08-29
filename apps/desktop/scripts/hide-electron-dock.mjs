import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

/**
 * `electron-vite dev` launches Electron.app from node_modules. That bundle has
 * no LSUIElement, so macOS draws the Electron tile before any JS can hide it.
 * Packaged builds set the same key via electron-builder extendInfo.
 */
if (process.platform !== "darwin") {
  process.exit(0);
}

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const plist = resolve(dirname(electronBinary), "..", "Info.plist");

if (!existsSync(plist)) {
  console.warn(`hide-electron-dock: missing ${plist}`);
  process.exit(0);
}

function lsuiElement() {
  try {
    return execFileSync(
      "plutil",
      ["-extract", "LSUIElement", "raw", "-expect", "bool", plist],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "";
  }
}

if (lsuiElement() === "true") {
  process.exit(0);
}

execFileSync("plutil", ["-replace", "LSUIElement", "-bool", "true", plist]);
