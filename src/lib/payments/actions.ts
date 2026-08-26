"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { inspectReceiptImage } from "@/lib/payments/image";
import { logServerError } from "@/lib/server-log";

export interface SubmitProofResult {
  error?: string;
  success?: boolean;
}

/**
 * Validates magic byte signatures for uploaded images:
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
 */
export async function submitGcashProof(formData: FormData) {
  const orderId = formData.get("order_id") as string;
  const referenceNumberRaw = (formData.get("reference_number") as string)?.trim();
  const file = formData.get("receipt_file") as File | null;

  if (!orderId || !file || !(file instanceof File)) {
    redirect(`/orders/${orderId || ""}?error=missing_file`);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/orders/" + orderId);
  }

  // 1. Validate order ownership and status
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, status, total_minor")
    .eq("id", orderId)
    .eq("user_id", userId)
    .single();

  if (orderError || !order || order.status !== "CONFIRMED") {
    redirect(`/orders/${orderId}?error=order_not_eligible`);
  }

  // 2. Validate payment method and status
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, method, status, amount_minor")
    .eq("order_id", order.id)
    .single();

  if (paymentError || !payment || payment.method !== "MANUAL_GCASH") {
    redirect(`/orders/${orderId}?error=invalid_payment_method`);
  }

  if (payment.status !== "UNPAID" && payment.status !== "REJECTED") {
    redirect(`/orders/${orderId}?error=payment_status_ineligible`);
  }

  const { data: uploadAllowed, error: throttleError } = await supabase.rpc(
    "allow_receipt_upload_attempt",
    { p_payment_id: payment.id },
  );
  if (throttleError || !uploadAllowed) {
    if (throttleError) logServerError("receipt.throttle", "database_failure");
    redirect(`/orders/${orderId}?error=upload_throttled`);
  }

  // 3. Validate file size (max 2 MiB = 2,097,152 bytes)
  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size <= 0 || file.size > MAX_SIZE) {
    redirect(`/orders/${orderId}?error=file_size_exceeded`);
  }

  // 4. Validate file type and magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const image = inspectReceiptImage(buffer);

  if (!image || file.type !== image.mime) {
    redirect(`/orders/${orderId}?error=invalid_file_signature`);
  }

  // 5. Build strict canonical storage path: <user_id>/<order_id>/<uuid>.<ext>
  const fileUuid = randomUUID();
  const storagePath = `${userId}/${order.id}/${fileUuid}.${image.extension}`;

  // Authenticated upload lets Storage bind owner_id to the verified JWT.
  const { error: uploadError } = await supabase.storage
    .from("payment-receipts")
    .upload(storagePath, buffer, {
      contentType: image.mime,
      upsert: false,
    });

  if (uploadError) {
    redirect(`/orders/${orderId}?error=upload_failed`);
  }

  // 7. Calculate RPC parameters
  // Active reservations extend for 24 hours while payment is under review
  const reservationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const submissionIdempotencyKey = `sub_${order.id}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const eventIdempotencyKey = `evt_${order.id}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;

  // 8. The public boundary derives the submitter from the authenticated JWT.
  const { error: rpcError } = await supabase.rpc("submit_gcash_proof", {
    p_payment_id: payment.id,
    p_claimed_amount_minor: payment.amount_minor,
    p_reference_number: referenceNumberRaw && referenceNumberRaw.length > 0 ? referenceNumberRaw : undefined,
    p_receipt_storage_path: storagePath,
    p_reservation_expires_at: reservationExpiresAt,
    p_submission_idempotency_key: submissionIdempotencyKey,
    p_event_idempotency_key: eventIdempotencyKey,
  });

  if (rpcError) {
    // Compensation: Remove newly uploaded storage object to prevent orphan receipts
    try {
      const serviceClient = createServiceClient();
      const { error: cleanupError } = await serviceClient.storage
        .from("payment-receipts")
        .remove([storagePath]);

      if (cleanupError) {
        logServerError("receipt.cleanup", "storage_failure");
      }
    } catch {
      // Safe diagnostic logging for thrown exceptions during storage cleanup
      logServerError("receipt.cleanup", "unexpected_failure");
    }

    redirect(`/orders/${orderId}?error=submission_failed`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?notice=proof_submitted`);
}

/**
 * Creates a short-lived (5 minutes) signed URL for the authenticated owner to view their receipt.
 * Strictly verifies that the receipt path belongs to an authenticated owner-scoped payment submission.
 */
export async function getReceiptSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  // Path must start with authenticated user ID
  if (!storagePath.startsWith(`${userId}/`)) {
    return null;
  }

  // Database verification: Path must correspond to a verified submission owned by this user
  const { data: submission, error: subError } = await supabase
    .from("payment_submissions")
    .select("id, submitted_by, receipt_storage_path")
    .eq("receipt_storage_path", storagePath)
    .eq("submitted_by", userId)
    .single();

  if (subError || !submission) {
    if (subError) logServerError("receipt.owner_lookup", "database_failure");
    return null;
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.storage
    .from("payment-receipts")
    .createSignedUrl(storagePath, 300); // 5 minutes valid

  if (error || !data?.signedUrl) {
    if (error) logServerError("receipt.owner_sign", "storage_failure");
    return null;
  }

  return data.signedUrl;
}
