"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";

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
function validateImageMagicBytes(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length < 12) return null;

  // JPEG check: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP check: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

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

  // 3. Validate file size (max 2 MiB = 2,097,152 bytes)
  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size <= 0 || file.size > MAX_SIZE) {
    redirect(`/orders/${orderId}?error=file_size_exceeded`);
  }

  // 4. Validate file type and magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const detectedMime = validateImageMagicBytes(buffer);

  if (!detectedMime) {
    redirect(`/orders/${orderId}?error=invalid_file_signature`);
  }

  // Determine file extension from detected MIME
  const ext = detectedMime === "image/jpeg" ? "jpg" : detectedMime === "image/png" ? "png" : "webp";

  // 5. Build strict canonical storage path: <user_id>/<order_id>/<uuid>.<ext>
  const fileUuid = randomUUID();
  const storagePath = `${userId}/${order.id}/${fileUuid}.${ext}`;

  // 6. Upload file to private 'payment-receipts' bucket via service client
  const serviceClient = createServiceClient();
  const { error: uploadError } = await serviceClient.storage
    .from("payment-receipts")
    .upload(storagePath, buffer, {
      contentType: detectedMime,
      upsert: false,
    });

  if (uploadError) {
    redirect(`/orders/${orderId}?error=upload_failed`);
  }

  // Ensure storage.objects has owner_id set to userId as required by submit_gcash_proof RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient as any)
    .schema("storage")
    .from("objects")
    .update({ owner_id: userId })
    .eq("bucket_id", "payment-receipts")
    .eq("name", storagePath);

  // 7. Calculate RPC parameters
  // Active reservations extend for 24 hours while payment is under review
  const reservationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const submissionIdempotencyKey = `sub_${order.id}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;
  const eventIdempotencyKey = `evt_${order.id}_${Date.now()}_${randomUUID().replace(/-/g, "")}`;

  // 8. Call canonical private.submit_gcash_proof RPC via service role client
  const { error: rpcError } = await serviceClient.rpc("submit_gcash_proof" as unknown as "manage_user_role", {
    p_payment_id: payment.id,
    p_submitted_by: userId,
    p_claimed_amount_minor: payment.amount_minor,
    p_reference_number: referenceNumberRaw && referenceNumberRaw.length > 0 ? referenceNumberRaw : undefined,
    p_receipt_storage_path: storagePath,
    p_reservation_expires_at: reservationExpiresAt,
    p_submission_idempotency_key: submissionIdempotencyKey,
    p_event_idempotency_key: eventIdempotencyKey,
  } as unknown as { p_assign: boolean; p_role: string; p_user_id: string });

  if (rpcError) {
    // Compensation: Remove newly uploaded storage object to prevent orphan receipts
    try {
      const { error: cleanupError } = await serviceClient.storage
        .from("payment-receipts")
        .remove([storagePath]);

      if (cleanupError) {
        // Safe diagnostic logging of cleanup failure without leaking secrets or PII
        console.error("Diagnostic: Storage cleanup returned error during RPC failure rollback");
      }
    } catch {
      // Safe diagnostic logging for thrown exceptions during storage cleanup
      console.error("Diagnostic: Exception caught during storage cleanup rollback");
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
    return null;
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.storage
    .from("payment-receipts")
    .createSignedUrl(storagePath, 300); // 5 minutes valid

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
