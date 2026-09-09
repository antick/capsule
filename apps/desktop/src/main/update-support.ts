/**
 * The part of updating that can be reasoned about without Electron running:
 * turning whatever the updater threw into something a panel can show, and
 * deciding whether the failure means "try again later" or "this build will
 * never update itself".
 */

/**
 * Failures that are about the build rather than the network. macOS refuses to
 * swap an app whose signature it cannot read, and a `dev-app-update.yml`-less
 * development run has no feed at all — in both cases retrying is pointless and
 * the honest answer is to send the user to the release page.
 */
const UNSUPPORTED_PATTERNS = [
  /code signature/i,
  /not signed/i,
  /is not packaged/i,
  /dev-app-update\.yml/i,
  /app-update\.yml/i,
  /squirrel/i,
];

export function isUnsupportedUpdateError(message: string): boolean {
  return UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(message));
}

const MAX_ERROR_CHARS = 300;

/**
 * electron-updater throws Errors, strings, and occasionally objects with a
 * `message` buried in them. Whatever arrives, the panel gets one short line.
 */
export function updateErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "";
  const first = raw.split("\n")[0]?.trim() ?? "";
  if (!first) {
    return "Update check failed.";
  }
  return first.length > MAX_ERROR_CHARS
    ? `${first.slice(0, MAX_ERROR_CHARS).trimEnd()}…`
    : first;
}

/** The fraction electron-updater reports, as a number the UI can trust. */
export function downloadFraction(percent: unknown): number {
  const value = typeof percent === "number" ? percent : Number.NaN;
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / 100));
}
