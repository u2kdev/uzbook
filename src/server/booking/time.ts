import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function zonedToUtc(date: string, minutesFromMidnight: number, timezone: string): Date {
  const extraDays = Math.floor(minutesFromMidnight / (24 * 60));
  const remainingMinutes = ((minutesFromMidnight % (24 * 60)) + (24 * 60)) % (24 * 60);
  const targetDate = extraDays !== 0 ? addDays(date, extraDays) : date;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return fromZonedTime(`${targetDate}T${hh}:${mm}:00`, timezone);
}

/** yyyy-MM-dd of an instant in the business timezone. */
export function dateInZone(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

export function timeInZone(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "HH:mm");
}

export function weekdayOf(date: string): number {
  // Date string is timezone-free, so read the weekday in UTC to avoid shifting.
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function humanDate(date: string, timezone: string, locale = "ru-RU"): string {
  // Noon avoids day shifts around DST when formatting.
  const instant = fromZonedTime(`${date}T12:00:00`, timezone);
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instant);
}

export function todayInZone(timezone: string): string {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
}
