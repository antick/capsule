const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatResetRelative(
  resetsAt: Date,
  now: Date = new Date(),
): string {
  const delta = Math.max(0, resetsAt.getTime() - now.getTime());
  const totalMinutes = Math.round(delta / MINUTE_MS);
  if (totalMinutes < 60) {
    return `Resets in ${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `Resets in ${hours}h ${minutes} min`;
}

export function formatResetAbsolute(resetsAt: Date, locale?: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
    resetsAt,
  );
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(resetsAt);
  return `Resets ${weekday} ${time}`;
}

export function formatResetCopy(
  resetsAtIso: string,
  style: "relative" | "absolute",
  now: Date = new Date(),
  locale?: string,
): string {
  const resetsAt = new Date(resetsAtIso);
  if (style === "relative") {
    const delta = Math.max(0, resetsAt.getTime() - now.getTime());
    if (delta >= DAY_MS) {
      return formatResetAbsolute(resetsAt, locale);
    }
    return formatResetRelative(resetsAt, now);
  }
  return formatResetAbsolute(resetsAt, locale);
}

/** Under this many seconds, a span is "just now" rather than a number. */
const JUST_NOW_SECONDS = 45;

/**
 * How long something has been the way it is: "just now", "3 min", "2 hr",
 * "2 hr 5 min". The second half of answering "is Claude still working".
 */
export function formatElapsed(since: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - since.getTime()) / 1000);
  if (seconds < JUST_NOW_SECONDS) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** The same span, phrased as a point in the past. */
export function formatAgo(since: Date, now: Date = new Date()): string {
  const elapsed = formatElapsed(since, now);
  return elapsed === "just now" ? elapsed : `${elapsed} ago`;
}

export { DAY_MS, HOUR_MS, MINUTE_MS };
