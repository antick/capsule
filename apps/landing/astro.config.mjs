import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

export default defineConfig({
  // No public address is assumed. Set this only when hosting the page again.
  site: process.env.SITE_URL || undefined,
  output: "static",
  trailingSlash: "never",
  // The Content-Security-Policy in vercel.json allows no inline code, so
  // every stylesheet ships as a file and nothing runs in the browser.
  build: { inlineStylesheets: "never", format: "file" },
  devToolbar: { enabled: false },
  vite: {
    // Screenshots and the app's version live outside this folder.
    server: { fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] } },
    build: { assetsInlineLimit: 0 },
  },
});
