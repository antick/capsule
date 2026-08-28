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

export { DAY_MS, HOUR_MS, MINUTE_MS };
