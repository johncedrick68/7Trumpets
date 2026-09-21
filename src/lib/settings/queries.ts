import { createClient } from "@/lib/supabase/server";

export async function getStoreSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error || !data || !data.value) {
      return fallback;
    }

    return data.value as unknown as T;
  } catch {
    return fallback;
  }
}

export interface StoreSettingEntry {
  value: unknown;
  description: string | null;
  updated_at: string;
}

export async function getAllStoreSettings(): Promise<Record<string, StoreSettingEntry>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("key, value, description, updated_at");

    if (error || !data) {
      return {};
    }

    const settingsMap: Record<string, StoreSettingEntry> = {};
    for (const item of data) {
      settingsMap[item.key] = {
        value: item.value,
        description: item.description,
        updated_at: item.updated_at,
      };
    }
    return settingsMap;
  } catch {
    return {};
  }
}
