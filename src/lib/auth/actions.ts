"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { logServerError } from "@/lib/server-log";
import { createClient } from "@/lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function password(formData: FormData) {
  const value = formData.get("password");
  return typeof value === "string" ? value : "";
}

function validEmail(email: string) {
  return email.length > 0 && email.length <= 254 && emailPattern.test(email);
}

export async function signUp(formData: FormData) {
  const email = text(formData, "email");
  const userPassword = password(formData);
  const displayName = text(formData, "display_name");
  const phone = text(formData, "phone");

  if (!validEmail(email)) redirect("/signup?error=email");
  if (userPassword.length < 8) redirect("/signup?error=password");
  if (displayName.length > 100 || phone.length > 32) redirect("/signup?error=profile");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: userPassword,
    options: {
      data: {
        display_name: displayName || null,
        phone: phone || null,
      },
    },
  });

  if (error) redirect("/signup?error=signup");
  redirect("/signup?sent=1");
}

export async function signIn(formData: FormData) {
  const email = text(formData, "email");
  const userPassword = password(formData);
  const next = text(formData, "next");

  if (!validEmail(email) || !userPassword) redirect("/login?error=credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: userPassword,
  });
  if (error) redirect("/login?error=credentials");

  const { data, error: identityError } = await supabase.auth.getUser();
  if (identityError || !data.user) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) logServerError("auth.failed_login_cleanup", "auth_provider_failure");
    redirect("/login?error=credentials");
  }

  redirect(safeRedirectPath(next, "/account"));
}

export async function requestPasswordReset(formData: FormData) {
  const email = text(formData, "email");
  if (!validEmail(email)) redirect("/forgot-password?error=email");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) logServerError("auth.password_reset", "email_delivery_failure");
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const userPassword = password(formData);
  if (userPassword.length < 8) redirect("/update-password?error=password");

  const supabase = await createClient();
  const { data, error: identityError } = await supabase.auth.getUser();
  if (identityError || !data.user) redirect("/login?next=/update-password");

  const { error } = await supabase.auth.updateUser({ password: userPassword });
  if (error) redirect("/update-password?error=update");

  revalidatePath("/account");
  redirect("/account?password=updated");
}

export async function updateProfile(formData: FormData) {
  const displayName = text(formData, "display_name");
  const phone = text(formData, "phone");
  if (displayName.length > 100 || phone.length > 32) redirect("/account?error=profile");

  const supabase = await createClient();
  const { data, error: identityError } = await supabase.auth.getUser();
  if (identityError || !data.user) redirect("/login?next=/account");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      phone: phone || null,
    })
    .eq("id", data.user.id)
    .select("id")
    .single();

  if (error) redirect("/account?error=profile");
  revalidatePath("/account");
  redirect("/account?saved=1");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) logServerError("auth.sign_out", "auth_provider_failure");
  redirect("/login?signedOut=1");
}
