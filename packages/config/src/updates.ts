/**
 * Everything about updating Capsule that is not Electron: the shape of the
 * state the main process publishes, the words for each phase, and the small
 * amount of arithmetic and tidying the renderer would otherwise do inline.
 */

export const APP_REPO = {
  owner: "antick",
  name: "capsule",
} as const;

/**
 * How the app checks on its own: once shortly after launch, so a cold start is
 * not competing with the first usage poll, and once a day after that.
 */
export const UPDATE_TIMING = {
  launchDelayMs: 15_000,
  intervalMs: 24 * 60 * 60 * 1000,
  /** How long a check may run before it is called a failure. */
  timeoutMs: 30_000,
} as const;

export const RELEASES_URL = `https://github.com/${APP_REPO.owner}/${APP_REPO.name}/releases`;

/** The page for one published version, which is where a manual install starts. */
export function releaseUrlFor(version: string | null): string {
  if (!version) {
    return RELEASES_URL;
  }
  const tag = version.startsWith("v") ? version : `v${version}`;
  return `${RELEASES_URL}/tag/${tag}`;
}

/**
 * Where an update stands. One value rather than a handful of booleans, so the
 * panel can never show "downloading" and "up to date" at the same time.
 */
export const UPDATE_PHASES = [
  /** Nothing has been asked for yet this run. */
  "idle",
  "checking",
  /** The feed has a newer version, not yet fetched. */
  "available",
  "downloading",
  /** Fetched and staged; it lands on the next launch, or on request. */
  "ready",
  /** Checked, and this is the newest there is. */
  "current",
  "error",
  /**
   * A build that cannot update itself: a dev run, or an unsigned copy macOS
   * would refuse to swap. The release page is offered instead.
   */
  "unsupported",
] as const;
export type UpdatePhase = (typeof UPDATE_PHASES)[number];

/**
 * Paired with `StatusTone` in `@capsule/ui`, which owns how each one looks.
 */
export type UpdateTone = "good" | "warn" | "bad" | "neutral" | "busy";

export interface UpdateProgress {
  /** 0 to 1. */
  fraction: number;
  transferredBytes: number;
  totalBytes: number;
  bytesPerSecond: number;
}

export interface UpdateState {
  phase: UpdatePhase;
  /** The version running right now. */
  currentVersion: string;
  /** The version the feed is offering, once a check has found one. */
  availableVersion: string | null;
  /** Notes for that version, already reduced to plain text. */
  releaseNotes: string | null;
  /** ISO instant the last check finished, successfully or not. */
  checkedAt: string | null;
  progress: UpdateProgress | null;
  error: string | null;
  /** Whether this build is one macOS will let replace itself in place. */
  canInstall: boolean;
}

export function initialUpdateState(
  currentVersion: string,
  canInstall: boolean,
): UpdateState {
  return {
    phase: canInstall ? "idle" : "unsupported",
    currentVersion,
    availableVersion: null,
    releaseNotes: null,
    checkedAt: null,
    progress: null,
    error: null,
    canInstall,
  };
}

export const UPDATE_TONES: Record<UpdatePhase, UpdateTone> = {
  idle: "neutral",
  checking: "busy",
  available: "warn",
  downloading: "busy",
  ready: "good",
  current: "good",
  error: "bad",
  unsupported: "neutral",
};

export function updateTone(phase: UpdatePhase): UpdateTone {
  return UPDATE_TONES[phase];
}

/** Whether asking for a check right now would do anything. */
export function canCheckForUpdates(state: UpdateState): boolean {
  return state.phase !== "checking" && state.phase !== "downloading";
}

export const UPDATE_IPC = {
  /** Main pushes the whole state whenever any part of it changes. */
  changed: "capsule:update-changed",
  get: "capsule:get-update",
  check: "capsule:check-update",
  download: "capsule:download-update",
  install: "capsule:install-update",
  /** Open this version's release page in the browser. */
  openRelease: "capsule:open-release",
} as const;

export const UPDATE_COPY = {
  updates: "Updates",
  updatesHint:
    "Capsule installs updates from its GitHub releases. Nothing is sent when it checks.",
  currentVersion: "Current version",
  checkNow: "Check now",
  checking: "Checking…",
  upToDate: "Capsule is up to date",
  upToDateDetail: "You are running the newest release.",
  idleTitle: "Not checked yet",
  idleDetail: "Check to see whether a newer release is available.",
  availableTitle: "Update available",
  availableDetail: "A newer release is ready to download.",
  availableDetailPrefix: "Capsule ",
  availableDetailSuffix: " is ready to download.",
  downloadingTitle: "Downloading update",
  readyTitle: "Update ready to install",
  readyDetail: "Capsule will restart to finish installing.",
  errorTitle: "Could not check for updates",
  timedOut: "The update service did not answer in time.",
  unsupportedTitle: "Updates are handled outside this build",
  unsupportedDetail:
    "This copy of Capsule cannot replace itself — a development run, or a build macOS will not swap in place. Download the release and install it by hand.",
  download: "Download",
  restartAndInstall: "Restart and install",
  viewRelease: "View release",
  releaseNotes: "What's new",
  lastChecked: "Last checked",
  never: "Never",
  autoCheck: "Check automatically",
  autoCheckHint: "Look for a new release on launch and once a day after that.",
  autoDownload: "Download in the background",
  autoDownloadHint:
    "Fetch a new release as soon as it is found, so installing is only a restart.",
  menuCheck: "Check for Updates…",
  /** The tray and menu badge when something is waiting. */
  menuReady: "Restart to Update",
  ofSize: " of ",
} as const;

/**
 * The same standing in two or three words, for places with no room for a
 * sentence — the sidebar's status line, a menu item.
 */
export const UPDATE_SHORT_LABELS: Record<UpdatePhase, string> = {
  idle: "Not checked",
  checking: "Checking",
  available: "Available",
  downloading: "Downloading",
  ready: "Ready",
  current: "Up to date",
  error: "Check failed",
  unsupported: "Manual",
};

export function updateShortLabel(phase: UpdatePhase): string {
  return UPDATE_SHORT_LABELS[phase];
}

export function updateTitle(state: UpdateState): string {
  switch (state.phase) {
    case "checking":
      return UPDATE_COPY.checking;
    case "available":
      return UPDATE_COPY.availableTitle;
    case "downloading":
      return UPDATE_COPY.downloadingTitle;
    case "ready":
      return UPDATE_COPY.readyTitle;
    case "current":
      return UPDATE_COPY.upToDate;
    case "error":
      return UPDATE_COPY.errorTitle;
    case "unsupported":
      return UPDATE_COPY.unsupportedTitle;
    default:
      return UPDATE_COPY.idleTitle;
  }
}

export function updateDetail(state: UpdateState): string | null {
  switch (state.phase) {
    case "available":
    case "downloading":
      return state.availableVersion
        ? `${UPDATE_COPY.availableDetailPrefix}${state.availableVersion}${UPDATE_COPY.availableDetailSuffix}`
        : UPDATE_COPY.availableDetail;
    case "ready":
      return UPDATE_COPY.readyDetail;
    case "current":
      return UPDATE_COPY.upToDateDetail;
    case "error":
      return state.error;
    case "unsupported":
      return UPDATE_COPY.unsupportedDetail;
    case "idle":
      return UPDATE_COPY.idleDetail;
    default:
      return null;
  }
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** Download sizes, at the precision a progress line can actually use. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // One decimal, but never a bare ".0": "12.3 MB" and "128 MB", not "128.0 MB".
  const rounded = value >= 100 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${BYTE_UNITS[unit]}`;
}

/** How far a download has got, as one line: "12.4 MB of 98.1 MB". */
export function formatProgress(progress: UpdateProgress): string {
  return `${formatBytes(progress.transferredBytes)}${UPDATE_COPY.ofSize}${formatBytes(progress.totalBytes)}`;
}

const MAX_RELEASE_NOTE_CHARS = 1200;

/**
 * GitHub hands release notes over as HTML. The panel shows them as text, and
 * rendering supplied markup inside the app would be a needless way to let a
 * release body run script, so the tags are dropped rather than parsed.
 */
export function plainReleaseNotes(raw: unknown): string | null {
  const text = releaseNoteText(raw);
  if (!text) {
    return null;
  }
  const stripped = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!stripped) {
    return null;
  }
  return stripped.length > MAX_RELEASE_NOTE_CHARS
    ? `${stripped.slice(0, MAX_RELEASE_NOTE_CHARS).trimEnd()}…`
    : stripped;
}

function releaseNoteText(raw: unknown): string | null {
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    // electron-updater sends one entry per release when several are skipped.
    return raw
      .map((entry) =>
        entry && typeof entry === "object" && "note" in entry
          ? String((entry as { note?: unknown }).note ?? "")
          : "",
      )
      .filter(Boolean)
      .join("\n\n");
  }
  return null;
}
