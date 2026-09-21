"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAal2 } from "@/lib/admin/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/server-log";

/**
 * Super Admin (AAL2) creates a staff invitation.
 * Records the invitation in public.staff_invitations and registers/invites user in auth.
 */
export async function inviteStaffMember(formData: FormData) {
  const adminCtx = await requireAdminAal2("/admin/users");

  if (adminCtx.role !== "super_admin") {
    redirect("/admin/users?error=super_admin_required");
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const fullName = (formData.get("full_name") as string)?.trim();
  const requestedRole = (formData.get("requested_role") as string)?.trim();

  if (!email || !fullName || !requestedRole || !["cashier", "admin", "super_admin"].includes(requestedRole)) {
    redirect("/admin/users?error=invalid_invitation_fields");
  }

  // Basic email validation
  if (!email.includes("@") || !email.includes(".")) {
    redirect("/admin/users?error=invalid_email");
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // Check if invitation already pending for this email
  const { data: existingInvite } = await supabase
    .from("staff_invitations")
    .select("id")
    .eq("email", email)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existingInvite) {
    redirect("/admin/users?error=invitation_already_pending");
  }

  // Insert invitation record
  const { error: inviteError } = await supabase.from("staff_invitations").insert({
    email,
    full_name: fullName,
    requested_role: requestedRole,
    invited_by: adminCtx.userId,
    status: "PENDING",
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (inviteError) {
    logServerError("staff.invite", inviteError.message);
    redirect("/admin/users?error=failed_to_create_invitation");
  }

  // Attempt to trigger Supabase Auth invite if supported by environment
  try {
    await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: fullName },
    });
  } catch (authErr) {
    // If local SMTP is not configured, invite record still safely exists
    logServerError("staff.auth_invite", authErr instanceof Error ? authErr.message : "auth_invite_skipped");
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_id: adminCtx.userId,
    actor_role: "super_admin",
    action: "staff.invited",
    entity: "staff_invitations",
    entity_id: adminCtx.userId,
    new_values: {
      email,
      full_name: fullName,
      role: requestedRole,
      expires_at: expiresAt,
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?notice=invitation_sent");
}

/**
 * Revoke a pending staff invitation. Requires AAL2 Super Admin.
 */
export async function revokeStaffInvitation(formData: FormData) {
  const adminCtx = await requireAdminAal2("/admin/users");

  if (adminCtx.role !== "super_admin") {
    redirect("/admin/users?error=super_admin_required");
  }

  const invitationId = formData.get("invitation_id") as string;
  if (!invitationId) {
    redirect("/admin/users?error=missing_invitation_id");
  }

  const supabase = await createClient();
  const { data: invite, error: fetchErr } = await supabase
    .from("staff_invitations")
    .select("email, requested_role")
    .eq("id", invitationId)
    .single();

  if (fetchErr || !invite) {
    redirect("/admin/users?error=invitation_not_found");
  }

  const { error: updateErr } = await supabase
    .from("staff_invitations")
    .update({ status: "REVOKED" })
    .eq("id", invitationId);

  if (updateErr) {
    redirect("/admin/users?error=failed_to_revoke");
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_id: adminCtx.userId,
    actor_role: "super_admin",
    action: "staff.invitation_revoked",
    entity: "staff_invitations",
    entity_id: invitationId,
    old_values: { email: invite.email, role: invite.requested_role },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?notice=invitation_revoked");
}

/**
 * Super Admin (AAL2) resets a staff member's enrolled MFA factor.
 * Forces the user to re-enroll MFA on next login to access admin routes.
 */
export async function resetStaffMfa(formData: FormData) {
  const adminCtx = await requireAdminAal2("/admin/users");

  if (adminCtx.role !== "super_admin") {
    redirect("/admin/users?error=super_admin_required");
  }

  const targetUserId = formData.get("target_user_id") as string;
  const confirmed = formData.get("confirmed") === "true";

  if (!targetUserId || !confirmed) {
    redirect("/admin/users?error=mfa_reset_unconfirmed");
  }

  const serviceClient = createServiceClient();
  const supabase = await createClient();

  // List factors for target user
  const { data: factorData, error: listErr } = await serviceClient.auth.admin.mfa.listFactors({
    userId: targetUserId,
  });

  if (listErr) {
    logServerError("staff.mfa_reset", listErr.message);
    redirect("/admin/users?error=failed_to_query_factors");
  }

  const factors = factorData?.factors || [];
  let deletedCount = 0;

  for (const factor of factors) {
    const { error: delErr } = await serviceClient.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: targetUserId,
    });
    if (!delErr) deletedCount++;
  }

  // Record audit log
  await supabase.from("audit_logs").insert({
    actor_id: adminCtx.userId,
    actor_role: "super_admin",
    action: "staff.mfa_reset",
    entity: "auth_mfa_factors",
    entity_id: targetUserId,
    new_values: { factors_removed: deletedCount },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?notice=mfa_reset_success");
}
