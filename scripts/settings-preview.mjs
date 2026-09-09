/**
 * Writes a stand-alone copy of the built settings page with a stubbed Capsule
 * bridge, so the UI can be opened in a plain browser for visual checks.
 */
import { readFileSync, writeFileSync } from "node:fs";

const dir = "apps/desktop/out/renderer/settings";
const html = readFileSync(`${dir}/index.html`, "utf8");

const settings = {
  placementPreset: "right-edge",
  enabledProviderIds: ["claude", "codex", "grok"],
  demoMode: false,
  pollIntervalMs: 60000,
  launchAtLogin: true,
  hudScale: 1,
  hudTheme: "auto",
  dockStyle: "rail",
  cornerArc: false,
  autoHide: true,
  notificationPopups: true,
  autoUpdateCheck: true,
  autoUpdateDownload: false,
  hideDelay: "normal",
  customCorner: null,
  topEdgeNotch: true,
  usageDisplay: "used",
  customPosition: { x: 100, y: 100 },
  schemaVersion: 7,
};

/**
 * Which update phase the preview shows. Set `CAPSULE_PREVIEW_UPDATE` to any
 * phase name to check that page's other states without a real release.
 */
const updatePhase = process.env.CAPSULE_PREVIEW_UPDATE ?? "available";
const update = {
  phase: updatePhase,
  currentVersion: "0.1.0",
  availableVersion: updatePhase === "current" ? null : "0.2.0",
  releaseNotes:
    updatePhase === "current"
      ? null
      : "• Settings has been rebuilt for light and dark.\n• Capsule can now update itself.",
  checkedAt: new Date().toISOString(),
  progress:
    updatePhase === "downloading"
      ? {
          fraction: 0.42,
          transferredBytes: 41 * 1024 * 1024,
          totalBytes: 98 * 1024 * 1024,
          bytesPerSecond: 3 * 1024 * 1024,
        }
      : null,
  error: updatePhase === "error" ? "net::ERR_INTERNET_DISCONNECTED" : null,
  canInstall: updatePhase !== "unsupported",
};

const bucket = (id, label, percentUsed) => ({
  id,
  label,
  percentUsed,
  resetsAt: "2026-08-29T18:00:00.000Z",
  resetStyle: "relative",
});

const snapshots = [
  {
    providerId: "claude",
    iconId: "claude",
    displayName: "Claude",
    status: "ok",
    primaryPercent: 73,
    buckets: [
      bucket("session", "Current session", 73),
      bucket("weekly", "All models", 7),
    ],
  },
  {
    providerId: "codex",
    iconId: "codex",
    displayName: "Codex",
    status: "stale",
    primaryPercent: 21,
    buckets: [bucket("weekly", "Weekly", 21)],
  },
  {
    providerId: "grok",
    iconId: "grok",
    displayName: "Grok",
    status: "unauthenticated",
    primaryPercent: null,
    buckets: [],
  },
];

const stub = `<script>
const settings = ${JSON.stringify(settings)};
const snapshots = ${JSON.stringify(snapshots)};
const update = ${JSON.stringify(update)};
window.capsule = {
  getSettings: async () => settings,
  setSettings: async (next) => Object.assign(settings, next),
  getSnapshots: async () => ({ snapshots, settings }),
  onSnapshots: (fn) => { fn(snapshots, settings); return () => {}; },
  onNavigate: () => () => {},
  onUpdate: (fn) => { fn(update); return () => {}; },
  getUpdate: async () => update,
  checkForUpdate: async () => {},
  downloadUpdate: async () => {},
  installUpdate: () => {},
  openReleasePage: () => {},
  revealDock: () => {},
  openSettings: async () => {},
  quit: async () => {},
  setPointerCapture: () => {},
  setHitRegions: () => {},
  setExpanded: () => {},
  startMove: () => {},
  endMove: async () => {},
  showContextMenu: () => {},
};
</script>`;

// The stub has to run before the deferred module bundle mounts React, and the
// page's CSP would block an inline script, so both are swapped out here.
const withoutCsp = html.replace(
  /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
  "",
);
if (withoutCsp === html) {
  throw new Error("could not strip the CSP meta tag from the built page");
}
writeFileSync(
  `${dir}/preview.html`,
  withoutCsp.replace("<title>", `${stub}<title>`),
);
console.log(`${dir}/preview.html`);
