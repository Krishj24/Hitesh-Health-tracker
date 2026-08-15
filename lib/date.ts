/**
 * Dates are stored as local wall-clock strings ('2026-08-15', '2026-08-15 21:30')
 * rather than UTC timestamps. A dose taken at 9pm belongs to that evening's
 * checklist on every device, which UTC storage gets wrong for half the day.
 */

export const TZ = process.env.NEXT_PUBLIC_APP_TZ || "Asia/Kolkata";

export function todayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function nowTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function nowStamp(now: Date = new Date()): string {
  return `${todayStr(now)} ${nowTime(now)}`;
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function isValidDay(day: string | undefined | null): day is string {
  return !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day));
}

export function prettyDay(day: string, today = todayStr()): string {
  const delta = daysBetween(today, day);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  return longDay(day);
}

export function longDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** '2026-08-15 21:30' -> '9:30 pm' */
export function clock(stamp: string): string {
  const time = stamp.slice(11, 16);
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function timeLabel(hhmm: string): string {
  return clock(`0000-00-00 ${hhmm}`);
}

/** Human gap: '10 min ago', '3 hr ago', '2 days ago'. */
export function since(stamp: string, now = nowStamp()): string {
  const mins = Math.round((toMinutes(now) - toMinutes(stamp)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 36 * 60) return `${Math.floor(mins / 60)} hr ago`;
  return `${Math.floor(mins / 1440)} days ago`;
}

function toMinutes(stamp: string): number {
  return Date.parse(stamp.replace(" ", "T") + ":00Z");
}

export function lastNDays(n: number, today = todayStr()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}
