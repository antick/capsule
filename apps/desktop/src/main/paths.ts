import { join } from "node:path";

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
