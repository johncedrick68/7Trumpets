import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CheckoutConfigurationError, resolveCheckoutSettings } from "./settings-contract";

export async function loadCheckoutSettings() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    throw new CheckoutConfigurationError("query");
  }
  return resolveCheckoutSettings(() => supabase.from("store_settings").select("key, value").in("key", ["fulfillment", "payment"]));
}
