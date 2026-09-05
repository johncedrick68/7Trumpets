export type ReservationDeadlineResult =
  | { state: "ACTIVE"; expiresAt: string }
  | { state: "EXPIRED"; expiresAt: string }
  | { state: "INVALID_SET" }
  | { state: "NO_RESERVATIONS" }
  | { state: "ERROR" };

export interface ReservationRow {
  expires_at: string;
  status: string;
}

export interface ReservationQueryDeps {
  getUserId: () => Promise<string | null | undefined>;
  verifyOrderOwnership: (
    orderId: string,
    userId: string
  ) => Promise<{ id: string } | null>;
  fetchReservations: (
    orderId: string
  ) => Promise<ReservationRow[] | null>;
}

/**
 * Strict parser for ISO-8601 and PostgreSQL timestamptz strings.
 * Verifies that the parsed instant corresponds to real calendar components:
 * - Rejects impossible calendar dates (e.g. Feb 30, April 31, Feb 29 on non-leap years)
 * - Rejects invalid months (> 12), days (> 31), hours (> 23), minutes (> 59), seconds (> 59)
 * - Supports valid leap years (e.g. 2028-02-29)
 * - Supports valid timezone offsets (+HH:mm, -HH:mm, Z)
 * - Rejects non-finite/Infinity/malformed inputs
 * - Never throws RangeError
 */
export function parseStrictIsoTimestamp(
  isoString: string | null | undefined
): number | null {
  if (!isoString || typeof isoString !== "string") {
    return null;
  }

  const trimmed = isoString.trim();
  if (!trimmed) {
    return null;
  }

  // Matches: YYYY-MM-DD[T ]HH:mm:ss(.sss)?(Z|[+-]HH(:?mm)?)?
  const regex = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:(Z)|([+-])(\d{2})(?::?(\d{2}))?)?$/;
  const match = trimmed.match(regex);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);
  const millisRaw = match[7];
  const isZ = Boolean(match[8]);
  const offsetSign = match[9];
  const offsetHours = match[10] ? parseInt(match[10], 10) : 0;
  const offsetMinutes = match[11] ? parseInt(match[11], 10) : 0;

  // Strict calendar range checks
  if (month < 1 || month > 12) {
    return null;
  }

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDays = daysInMonths[month - 1];
  if (day < 1 || day > maxDays) {
    return null;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }
  if (minute < 0 || minute > 59) {
    return null;
  }
  if (second < 0 || second > 59) {
    return null;
  }

  if (!isZ && !offsetSign) {
    // Missing timezone designator for timestamptz
    return null;
  }

  if (offsetSign) {
    if (offsetHours < 0 || offsetHours > 23 || offsetMinutes < 0 || offsetMinutes > 59) {
      return null;
    }
  }

  const millis = millisRaw
    ? parseInt(millisRaw.slice(0, 3).padEnd(3, "0"), 10)
    : 0;

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  if (offsetSign) {
    const totalOffsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;
    if (offsetSign === "+") {
      utcMs -= totalOffsetMs;
    } else if (offsetSign === "-") {
      utcMs += totalOffsetMs;
    }
  }

  if (!Number.isFinite(utcMs) || isNaN(utcMs)) {
    return null;
  }

  return utcMs;
}

/**
 * Pure behavioral pipeline for fetching and evaluating reservation deadlines.
 * Enforces ownership verification under authenticated RLS before service-role access.
 */
export async function fetchOrderReservationDeadline(
  orderId: string,
  deps: ReservationQueryDeps
): Promise<ReservationDeadlineResult> {
  if (!orderId || typeof orderId !== "string") {
    return { state: "ERROR" };
  }

  // 1. Authenticated caller derivation
  const userId = await deps.getUserId();
  if (!userId) {
    return { state: "ERROR" };
  }

  // 2. Authoritative ownership verification under RLS before service-role access
  const order = await deps.verifyOrderOwnership(orderId, userId);
  if (!order) {
    return { state: "ERROR" };
  }

  // 3. Targeted service-client read for verified order only
  const reservations = await deps.fetchReservations(order.id);
  if (!reservations) {
    return { state: "ERROR" };
  }

  // 4. Safe evaluation using canonical deadline logic
  return evaluateReservationDeadline(reservations);
}

/**
 * Evaluates the authoritative reservation deadline from inventory_reservations rows.
 * Fails closed on abnormal sets, malformed timestamps, or impossible calendar dates.
 * Never throws RangeError or uncaught exceptions on malformed dates.
 */
export function evaluateReservationDeadline(
  reservations: ReservationRow[] | null | undefined,
  now: number = Date.now()
): ReservationDeadlineResult {
  if (!reservations || reservations.length === 0) {
    return { state: "NO_RESERVATIONS" };
  }

  const allActive = reservations.every((r) => r && r.status === "active");
  if (!allActive) {
    return { state: "INVALID_SET" };
  }

  const validTimestamps: number[] = [];

  for (const r of reservations) {
    if (!r || typeof r.expires_at !== "string") {
      return { state: "INVALID_SET" };
    }

    const timestamp = parseStrictIsoTimestamp(r.expires_at);
    if (timestamp === null || !Number.isFinite(timestamp)) {
      return { state: "INVALID_SET" };
    }

    validTimestamps.push(timestamp);
  }

  if (validTimestamps.length === 0) {
    return { state: "NO_RESERVATIONS" };
  }

  const minTimestamp = Math.min(...validTimestamps);
  if (!Number.isFinite(minTimestamp) || isNaN(minTimestamp)) {
    return { state: "INVALID_SET" };
  }

  let minExpiresAt: string;
  try {
    minExpiresAt = new Date(minTimestamp).toISOString();
  } catch {
    return { state: "INVALID_SET" };
  }

  if (minTimestamp <= now) {
    return { state: "EXPIRED", expiresAt: minExpiresAt };
  }

  return { state: "ACTIVE", expiresAt: minExpiresAt };
}

/**
 * Explicitly formats an ISO reservation timestamp in Philippine Time (Asia/Manila).
 * Appends a visible timezone indicator ('PHT').
 * Never relies on the machine/server local timezone.
 * Returns null safely on invalid, impossible, or non-finite timestamps without throwing.
 */
export function formatPhDeadline(
  isoTimestamp: string | null | undefined
): string | null {
  if (!isoTimestamp || typeof isoTimestamp !== "string") {
    return null;
  }

  const timestamp = parseStrictIsoTimestamp(isoTimestamp);
  if (timestamp === null || !Number.isFinite(timestamp)) {
    return null;
  }

  try {
    const date = new Date(timestamp);
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${dateFormatter.format(date)}, ${timeFormatter.format(date)} PHT`;
  } catch {
    return null;
  }
}
