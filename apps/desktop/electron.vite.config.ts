import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const root = __dirname;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ["electron"],
        input: {
          index: resolve(root, "src/main/index.ts"),
          "channel-entry": resolve(root, "src/main/channel-entry.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ["electron"],
        output: {
          format: "cjs",
          entryFileNames: "index.js",
        },
      },
    },
  },
  renderer: {
    root: resolve(root, "src/renderer"),
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(root, "src/renderer/overlay/index.html"),
          settings: resolve(root, "src/renderer/settings/index.html"),
        },
      },
    },
  },
});
