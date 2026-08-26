import { NextResponse } from "next/server";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { logServerError } from "@/lib/server-log";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  await requireAdminAal2("/admin/payments");
  const { submissionId } = await params;
  const supabase = await createClient();
  const { data: storagePath, error: authorizationError } = await supabase.rpc(
    "authorize_payment_receipt_preview",
    { p_submission_id: submissionId },
  );
  if (authorizationError || !storagePath) {
    if (authorizationError) logServerError("receipt.preview_authorize", "database_rejection");
    return new NextResponse("Not found", { status: 404 });
  }

  const { data, error } = await createServiceClient().storage
    .from("payment-receipts")
    .createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    logServerError("receipt.preview_sign", "storage_failure");
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(new URL(data.signedUrl, request.url), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
