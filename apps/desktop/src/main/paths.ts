import { existsSync } from "node:fs";
import { join } from "node:path";

export function preloadScript(): string {
  const asMjs = join(__dirname, "../preload/index.mjs");
  if (existsSync(asMjs)) {
    return asMjs;
  }
  return join(__dirname, "../preload/index.js");
}

export function rendererHtml(name: "overlay" | "settings"): string {
  return join(__dirname, `../renderer/${name}/index.html`);
}

export function rendererDevUrl(name: "overlay" | "settings"): string | null {
  const base = process.env.ELECTRON_RENDERER_URL;
  if (!base) {
    return null;
  }
  return `${base}/${name}/index.html`;
}
