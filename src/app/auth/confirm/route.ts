import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || (type !== "email" && type !== "recovery")) {
    redirect("/auth/error");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) redirect("/auth/error");

  const fallback = type === "recovery" ? "/update-password" : "/account";
  redirect(safeRedirectPath(url.searchParams.get("next"), fallback));
}
