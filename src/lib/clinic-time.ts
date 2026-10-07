/**
 * Clinic time helpers. Everything here uses Intl only, so no date library is needed.
 *
 * Instants are ISO 8601 strings (UTC). Calendar dates are `YYYY-MM-DD` keys in the
 * clinic's IANA time zone. Never derive a clinic-local date by slicing a UTC string.
 */

export const DEFAULT_CLINIC_TIME_ZONE = "Asia/Baghdad";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Cached formatter. The zone is resolved here, so an unknown zone can never throw. */
function cachedFormatter(
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const zone = resolveClinicTimeZone(timeZone);
  const key = `${locale}|${zone}|${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
  } catch {
    // Unknown locale tag. Fall back to English with the same zone.
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone: zone });
  }
  formatterCache.set(key, formatter);
  return formatter;
}

const validZoneCache = new Map<string, boolean>();

/** Returns true when the runtime knows the IANA time zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  const cached = validZoneCache.get(timeZone);
  if (cached !== undefined) return cached;
  let valid = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    valid = false;
  }
  validZoneCache.set(timeZone, valid);
  return valid;
}

/** Returns the time zone when valid, otherwise the clinic default. Never throws. */
export function resolveClinicTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_CLINIC_TIME_ZONE;
}

function parseInstant(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Returns the clinic-local calendar date of an instant as `YYYY-MM-DD`, or "" for an invalid instant. */
export function clinicDateKey(iso: string, timeZone: string): string {
  const date = parseInstant(iso);
  if (!date) return "";
  const parts = cachedFormatter("en-US", timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year").padStart(4, "0")}-${read("month").padStart(2, "0")}-${read("day").padStart(2, "0")}`;
}

/** Clinic-local time label such as "8:30 AM". Returns "" for an invalid instant. */
export function clinicTimeLabel(iso: string, timeZone: string, locale: string): string {
  const date = parseInstant(iso);
  if (!date) return "";
  return cachedFormatter(locale, timeZone, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Clinic-local date label. The default options give "Aug 27, 2026".
 * Returns "" for an invalid instant.
 */
export function clinicDateLabel(
  iso: string,
  timeZone: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseInstant(iso);
  if (!date) return "";
  return cachedFormatter(locale, timeZone, options ?? DEFAULT_DATE_OPTIONS).format(date);
}

/** The clinic's current calendar date as `YYYY-MM-DD`. */
export function clinicTodayKey(timeZone: string, now: Date = new Date()): string {
  return clinicDateKey(now.toISOString(), timeZone);
}

/**
 * Whole years between a `YYYY-MM-DD` date of birth and the clinic's today.
 * Returns 0 for a missing or malformed date of birth.
 */
export function ageFromDateOfBirth(
  dateOfBirth: string | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): number {
  const birth = DATE_KEY_PATTERN.exec(dateOfBirth ?? "");
  if (!birth) return 0;
  const today = DATE_KEY_PATTERN.exec(clinicTodayKey(timeZone, now));
  if (!today) return 0;
  const [birthYear, birthMonth, birthDay] = birth.slice(1).map(Number);
  const [todayYear, todayMonth, todayDay] = today.slice(1).map(Number);
  let age = todayYear - birthYear;
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) age -= 1;
  return Math.max(0, age);
}

/** Offset in milliseconds between the clinic wall clock and UTC at the given instant. */
function zoneOffsetMs(timeZone: string, instantMs: number): number {
  const parts = cachedFormatter("en-US", timeZone, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wallClockAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return wallClockAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Converts a clinic wall-clock date and time (`YYYY-MM-DD` and `HH:mm`) into a UTC ISO instant.
 *
 * The offset is resolved with Intl for the zone at the candidate instant. Two passes
 * correct the result across DST transitions. An unknown zone falls back to the default.
 * Throws a RangeError only for a malformed date or time, which is a caller bug.
 */
export function localDateTimeToIso(dateKey: string, time: string, timeZone: string): string {
  const dateMatch = DATE_KEY_PATTERN.exec(dateKey);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new RangeError(`Invalid clinic date or time: "${dateKey}" "${time}"`);
  }
  const [year, month, day] = dateMatch.slice(1).map(Number);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (month < 1 || month > 12 || hours > 23 || minutes > 59) {
    throw new RangeError(`Invalid clinic date or time: "${dateKey}" "${time}"`);
  }
  const wallClockMs = Date.UTC(year, month - 1, day, hours, minutes);
  if (new Date(wallClockMs).getUTCDate() !== day) {
    throw new RangeError(`Invalid clinic date: "${dateKey}"`);
  }

  const zone = resolveClinicTimeZone(timeZone);
  let instantMs = wallClockMs - zoneOffsetMs(zone, wallClockMs);
  // Second pass: the offset at the first guess can differ from the offset at the real instant.
  const secondOffset = zoneOffsetMs(zone, instantMs);
  instantMs = wallClockMs - secondOffset;
  if (zoneOffsetMs(zone, instantMs) !== secondOffset) {
    instantMs = wallClockMs - zoneOffsetMs(zone, instantMs);
  }
  return new Date(instantMs).toISOString();
}
