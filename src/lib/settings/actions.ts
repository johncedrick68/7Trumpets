"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateStoreSetting(formData: FormData) {
  await requireAdminAal2("/admin/settings");

  const key = (formData.get("key") as string)?.trim();
  const valueJson = formData.get("value_json") as string;

  if (!key || !valueJson) {
    redirect("/admin/settings?error=missing_parameters");
  }

  let parsedValue;
  try {
    parsedValue = JSON.parse(valueJson);
  } catch {
    redirect("/admin/settings?error=invalid_json");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("store_settings")
    .upsert({
      key,
      value: parsedValue,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    redirect("/admin/settings?error=update_failed");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/checkout");

  redirect("/admin/settings?notice=setting_updated");
}
