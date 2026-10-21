import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import { site } from "./src/lib/site";

export default defineConfig({
  site: site.url,
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
