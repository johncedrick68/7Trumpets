import "server-only";

import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type ReservationDeadlineResult =
  | { state: "ACTIVE"; expiresAt: string }
  | { state: "EXPIRED"; expiresAt: string }
  | { state: "INVALID_SET" }
  | { state: "NO_RESERVATIONS" }
  | { state: "ERROR" };

/**
 * Server-only helper to read the authoritative order reservation deadline.
 * - Accepts ONLY orderId; derives authenticated caller identity internally.
 * - Confirms order ownership through the authenticated client under RLS.
 * - Only after verified ownership, queries inventory_reservations via service client.
 * - Selects only expires_at and status for that specific order.
 * - Fails closed on abnormal, mixed, or missing reservation sets.
 */
export async function getOrderReservationDeadline(
  orderId: string
): Promise<ReservationDeadlineResult> {
  if (!orderId || typeof orderId !== "string") {
    return { state: "ERROR" };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return { state: "ERROR" };
  }

  // 1. Verify caller owns this order under standard RLS
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError || !order) {
    if (orderError) logServerError("reservation.order_verify", "database_failure");
    return { state: "ERROR" };
  }

  // 2. Query reservations for this verified order using the server client
  const serviceClient = createServiceClient();
  const { data: reservations, error: resError } = await serviceClient
    .from("inventory_reservations")
    .select("expires_at, status")
    .eq("order_id", order.id);

  if (resError) {
    logServerError("reservation.query", "database_failure");
    return { state: "ERROR" };
  }

  // 3. Evaluate canonical reservation state
  if (!reservations || reservations.length === 0) {
    return { state: "NO_RESERVATIONS" };
  }

  const allActive = reservations.every((r) => r.status === "active");
  if (!allActive) {
    // Mixed active/terminal or all terminal without complete active set
    return { state: "INVALID_SET" };
  }

  // Canonical deadline is MIN(expires_at): proof submission fails once any reservation expires
  const timestamps = reservations.map((r) => new Date(r.expires_at).getTime());
  const minTimestamp = Math.min(...timestamps);
  const minExpiresAt = new Date(minTimestamp).toISOString();

  if (minTimestamp <= Date.now()) {
    return { state: "EXPIRED", expiresAt: minExpiresAt };
  }

  return { state: "ACTIVE", expiresAt: minExpiresAt };
}
