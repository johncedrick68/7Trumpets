"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";

export interface Address {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  barangay: string | null;
  city_municipality: string;
  province: string;
  postal_code: string;
  country_code: string;
  is_default: boolean;
  label: string | null;
}

export async function getCustomerAddresses(): Promise<Address[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logServerError("address.list", "database_failure");
    throw new Error("ADDRESSES_UNAVAILABLE");
  }
  return data ?? [];
}

export async function saveAddress(formData: FormData) {
  const addressId = (formData.get("address_id") as string)?.trim() || null;
  const recipientName = (formData.get("recipient_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const addressLine1 = (formData.get("address_line1") as string)?.trim();
  const addressLine2 = (formData.get("address_line2") as string)?.trim() || null;
  const barangay = (formData.get("barangay") as string)?.trim() || null;
  const cityMunicipality = (formData.get("city_municipality") as string)?.trim();
  const province = (formData.get("province") as string)?.trim();
  const postalCode = (formData.get("postal_code") as string)?.trim();
  const label = (formData.get("label") as string)?.trim() || null;
  const isDefault = formData.get("is_default") === "on" || formData.get("is_default") === "true";

  if (!recipientName || !phone || !addressLine1 || !cityMunicipality || !province || !postalCode) {
    redirect("/account/addresses?error=missing_fields");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login?next=/account/addresses");

  // If address is set as default, clear existing default first
  if (isDefault) {
    const { error: clearError } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
    if (clearError) {
      logServerError("address.default.clear", "database_failure");
      redirect("/account/addresses?error=save_failed");
    }
  }

  if (addressId) {
    // Update existing address owned by user
    const { error } = await supabase
      .from("addresses")
      .update({
        recipient_name: recipientName,
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        barangay,
        city_municipality: cityMunicipality,
        province,
        postal_code: postalCode,
        country_code: "PH",
        is_default: isDefault,
        label,
      })
      .eq("id", addressId)
      .eq("user_id", userId);

    if (error) {
      logServerError("address.update", "database_failure");
      redirect("/account/addresses?error=save_failed");
    }
  } else {
    // Insert new address
    const { error } = await supabase.from("addresses").insert({
      user_id: userId,
      recipient_name: recipientName,
      phone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      barangay,
      city_municipality: cityMunicipality,
      province,
      postal_code: postalCode,
      country_code: "PH",
      is_default: isDefault,
      label,
    });

    if (error) {
      logServerError("address.save", "database_failure");
      redirect("/account/addresses?error=save_failed");
    }
  }

  revalidatePath("/account/addresses");
  redirect("/account/addresses?saved=1");
}


export async function setDefaultAddress(formData: FormData) {
  const addressId = formData.get("address_id") as string;
  if (!addressId) redirect("/account/addresses");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login?next=/account/addresses");

  // 1. Clear current default
  const { error: clearError } = await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (clearError) {
    logServerError("address.default.clear", "database_failure");
    redirect("/account/addresses?error=update_failed");
  }

  // 2. Set new default for target address owned by user
  const { data: updated, error: updateError } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    if (updateError) logServerError("address.default.set", "database_failure");
    redirect("/account/addresses?error=update_failed");
  }

  revalidatePath("/account/addresses");
  redirect("/account/addresses?updated=1");
}

export async function deleteAddress(formData: FormData) {
  const addressId = formData.get("address_id") as string;
  if (!addressId) redirect("/account/addresses");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login?next=/account/addresses");

  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("user_id", userId);
  if (error) {
    logServerError("address.delete", "database_failure");
    redirect("/account/addresses?error=delete_failed");
  }

  revalidatePath("/account/addresses");
  redirect("/account/addresses?deleted=1");
}
