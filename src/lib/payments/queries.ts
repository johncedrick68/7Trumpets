import "server-only";

import {
  evaluateReservationDeadline,
  fetchOrderReservationDeadline,
  type ReservationDeadlineResult,
  type ReservationQueryDeps,
  type ReservationRow,
} from "./deadline";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type { ReservationDeadlineResult, ReservationQueryDeps, ReservationRow };
export { evaluateReservationDeadline, fetchOrderReservationDeadline };

/**
 * Server-only helper to read the authoritative order reservation deadline.
 * - Accepts ONLY orderId; derives authenticated caller identity internally.
 * - Confirms order ownership through the authenticated client under RLS FIRST.
 * - Only after verified ownership, queries inventory_reservations via service client.
 * - Selects only expires_at and status for that specific order.
 * - Fails closed on abnormal, mixed, or missing reservation sets.
 * - Never accepts userId or actor identity from callers/browser input.
 */
export async function getOrderReservationDeadline(
  orderId: string
): Promise<ReservationDeadlineResult> {
  const supabase = await createClient();

  return fetchOrderReservationDeadline(orderId, {
    getUserId: async () => {
      const { data } = await supabase.auth.getClaims();
      return data?.claims?.sub;
    },
    verifyOrderOwnership: async (id, userId) => {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        logServerError("reservation.order_verify", "database_failure");
        return null;
      }
      return data;
    },
    fetchReservations: async (orderId) => {
      const serviceClient = createServiceClient();
      const { data, error } = await serviceClient
        .from("inventory_reservations")
        .select("expires_at, status")
        .eq("order_id", orderId);

      if (error) {
        logServerError("reservation.query", "database_failure");
        return null;
      }
      return data as ReservationRow[];
    },
  });
}
