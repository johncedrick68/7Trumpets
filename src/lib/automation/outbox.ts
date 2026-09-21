import { createHmac } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";
import type { Json } from "@/types/database";

export type OutboxEventType =
  | "SUPPORT_MESSAGE_CREATED"
  | "SUPPORT_HUMAN_REQUESTED"
  | "SUPPORT_RESOLVED"
  | "CUSTOMER_CREATED"
  | "ORDER_PLACED"
  | "PAYMENT_APPROVED"
  | "ORDER_SHIPPED"
  | "RETURN_REQUESTED"
  | "LOW_STOCK_DETECTED";

export interface OutboxEventPayload {
  eventType: OutboxEventType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

/**
 * Emit a domain event to the public.automation_outbox table.
 * Fully decoupled from external webhook delivery.
 */
export async function emitOutboxEvent({
  eventType,
  aggregateType,
  aggregateId,
  payload,
}: OutboxEventPayload): Promise<string | null> {
  try {
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("automation_outbox")
      .insert({
        event_type: eventType,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        payload: payload as unknown as Json,
        status: "PENDING",
      })
      .select("id")
      .single();

    if (error) {
      logServerError("outbox.emit", error.message);
      return null;
    }

    return data.id;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown_error";
    logServerError("outbox.emit_exception", message);
    return null;
  }
}

/**
 * Dispatches pending outbox events to the configured n8n webhook endpoint.
 * Signs each payload with HMAC-SHA256 for tamper resistance.
 */
export async function dispatchPendingOutboxEvents(batchSize: number = 10): Promise<{
  dispatched: number;
  failed: number;
  skipped: boolean;
}> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || "1968_n8n_local_secret";

  const serviceClient = createServiceClient();

  // Fetch pending events ready for dispatch
  const { data: events, error } = await serviceClient
    .from("automation_outbox")
    .select("*")
    .in("status", ["PENDING", "FAILED"])
    .lte("available_at", new Date().toISOString())
    .lt("attempt_count", 5)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error || !events || events.length === 0) {
    return { dispatched: 0, failed: 0, skipped: false };
  }

  if (!webhookUrl) {
    // If webhook is not configured, events remain safely queued
    return { dispatched: 0, failed: 0, skipped: true };
  }

  let dispatched = 0;
  let failed = 0;

  for (const ev of events) {
    const timestamp = Date.now().toString();
    const eventBody = JSON.stringify({
      id: ev.id,
      event_type: ev.event_type,
      aggregate_type: ev.aggregate_type,
      aggregate_id: ev.aggregate_id,
      payload: ev.payload,
      created_at: ev.created_at,
    });

    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${eventBody}`)
      .digest("hex");

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-1968-Signature": signature,
          "X-1968-Timestamp": timestamp,
          "X-1968-Event-Id": ev.id,
        },
        body: eventBody,
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (res.ok) {
        await serviceClient
          .from("automation_outbox")
          .update({
            status: "PROCESSED",
            processed_at: new Date().toISOString(),
          })
          .eq("id", ev.id);
        dispatched++;
      } else {
        await serviceClient
          .from("automation_outbox")
          .update({
            status: "FAILED",
            attempt_count: ev.attempt_count + 1,
            error_message: `HTTP ${res.status}: ${await res.text().catch(() => "")}`,
          })
          .eq("id", ev.id);
        failed++;
      }
    } catch (sendErr: unknown) {
      const message = sendErr instanceof Error ? sendErr.message : "Network delivery failed";
      await serviceClient
        .from("automation_outbox")
        .update({
          status: "FAILED",
          attempt_count: ev.attempt_count + 1,
          error_message: message,
        })
        .eq("id", ev.id);
      failed++;
    }
  }

  return { dispatched, failed, skipped: false };
}

/**
 * Verify HMAC signature on incoming webhooks from n8n.
 */
export function verifyN8nWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string = process.env.N8N_WEBHOOK_SECRET || "1968_n8n_local_secret"
): boolean {
  if (!timestamp || !signature) return false;

  // Reject signatures older than 5 minutes to prevent replay attacks
  const age = Math.abs(Date.now() - parseInt(timestamp, 10));
  if (isNaN(age) || age > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return expected === signature;
}
