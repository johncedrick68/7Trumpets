"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function createShipment(formData: FormData) {
  await requireAdminAal2("/admin/orders");

  const orderId = formData.get("order_id") as string;
  const provider = (formData.get("provider") as string)?.trim() || "MANUAL";
  const trackingNumber = (formData.get("tracking_number") as string)?.trim() || "";
  const carrierNotes = (formData.get("carrier_notes") as string)?.trim() || "";

  if (!orderId) {
    redirect("/admin/orders?error=missing_order_id");
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("admin_create_shipment", {
    p_order_id: orderId,
    p_provider: provider,
    p_tracking_number: trackingNumber,
    p_carrier_notes: carrierNotes || undefined,
  });

  if (rpcError) {
    redirect(`/admin/orders/${orderId}?error=shipment_creation_failed`);
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");

  redirect(`/admin/orders/${orderId}?notice=shipment_created`);
}
