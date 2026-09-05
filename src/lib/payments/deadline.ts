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
 * Fails closed on abnormal sets, malformed timestamps, or mixed statuses.
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

    const timestamp = Date.parse(r.expires_at);
    if (!Number.isFinite(timestamp) || isNaN(timestamp)) {
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
 * Returns null safely on invalid or non-finite timestamps without throwing.
 */
export function formatPhDeadline(
  isoTimestamp: string | null | undefined
): string | null {
  if (!isoTimestamp || typeof isoTimestamp !== "string") {
    return null;
  }

  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp) || isNaN(timestamp)) {
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
