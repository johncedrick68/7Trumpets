import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  const supabase = await createClient();

  // 1. Handle OAuth PKCE exchange (e.g. Google OAuth)
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      redirect("/auth/error");
    }
    redirect(safeRedirectPath(next, "/account"));
  }

  // 2. Handle Token Hash verification (Email confirmation / Password reset)
  if (!tokenHash || (type !== "email" && type !== "recovery")) {
    redirect("/auth/error");
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) redirect("/auth/error");

  const fallback = type === "recovery" ? "/update-password" : "/account";
  redirect(safeRedirectPath(next, fallback));
}
