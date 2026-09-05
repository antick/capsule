import { BACKOFF, type UsageSnapshot } from "@capsule/config";

/**
 * The endpoint said no, for now. Carries the server's own hint and, where the
 * provider had something remembered to show instead, the snapshot to show
 * while the penalty runs.
 */
export class RateLimitedError extends Error {
  readonly retryAfterMs: number | null;
  /** Something remembered to show while the penalty runs, if there was one. */
  readonly fallback: UsageSnapshot | null;

  constructor(
    retryAfterMs: number | null,
    fallback: UsageSnapshot | null = null,
  ) {
    super("rate limited");
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
    this.fallback = fallback;
  }
}

/**
 * How long to wait after the `attempt`th 429 in a row. The hint is only ever a
 * floor-raiser: the wait starts at a minute, doubles per consecutive refusal,
 * and is capped so it always recovers by itself.
 */
export function backoffMs(
  attempt: number,
  retryAfterMs: number | null,
): number {
  const doublings = Math.min(Math.max(0, attempt - 1), BACKOFF.maxDoublings);
  const doubled = BACKOFF.floorMs * 2 ** doublings;
  return Math.min(BACKOFF.ceilingMs, Math.max(doubled, retryAfterMs ?? 0));
}

/** `Retry-After` is either a number of seconds or an HTTP date. */
export function retryAfterMs(
  header: string | null,
  now: Date = new Date(),
): number | null {
  if (!header) {
    return null;
  }
  const trimmed = header.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = new Date(trimmed).getTime();
  if (!Number.isFinite(date)) {
    return null;
  }
  return Math.max(0, date - now.getTime());
}
