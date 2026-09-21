/**
 * scripts/create-demo-users.mjs
 *
 * LOCAL DEVELOPMENT ONLY — Creates reproducible demo accounts in the
 * local Supabase instance. DO NOT run against production.
 *
 * Usage:
 *   node scripts/create-demo-users.mjs
 *
 * Prerequisites:
 *   - Local Supabase running (npx supabase start)
 *   - .env.local present with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY
 *   - Migrations applied and catalog seeded
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local (no dotenv dependency) ───────────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(__dirname, "../.env.local");
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // fall through — env vars may already be set
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}

if (!SUPABASE_URL.includes("127.0.0.1") && !SUPABASE_URL.includes("localhost")) {
  console.error("❌  SUPABASE_URL does not look like a local instance. Refusing to run against remote.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Demo credentials ──────────────────────────────────────────────────────────
const CUSTOMER = {
  email:        "customer.demo@1968.local",
  password:     "Demo1968Customer!",
  role:         "customer",
  display_name: "Demo Customer",
  phone:        "0917 000 0001",
};

const ADMIN_USER = {
  email:        "admin.demo@1968.local",
  password:     "Demo1968Admin!",
  role:         "admin",
  display_name: "Demo Admin",
  phone:        "0917 000 0002",
};

// ── Helper: create or update auth user + profile ──────────────────────────────
async function upsertUser({ email, password, role, display_name, phone }) {
  console.log(`\n→  Processing ${role}: ${email}`);

  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const existing = users.find((u) => u.email === email);
  let userId;

  if (existing) {
    console.log(`   User already exists (${existing.id}), updating password…`);
    const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (updateErr) throw updateErr;
    userId = existing.id;
  } else {
    console.log("   Creating auth user…");
    const { data: { user }, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // skip email confirmation for local
      user_metadata: { display_name, phone },
    });
    if (createErr) throw createErr;
    userId = user.id;
    console.log(`   Created auth user: ${userId}`);
  }

  // Update profile display_name and phone (trigger already created the row)
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, display_name, phone }, { onConflict: "id" });

  if (profileErr) {
    console.warn(`   ⚠  Profile upsert warning: ${profileErr.message}`);
  } else {
    console.log("   Profile updated.");
  }

  // Set role via private.user_roles — requires service role key.
  // The trigger already inserts 'customer'. For admin, upsert to 'admin'.
  if (role === "admin") {
    // Use raw SQL via the REST API isn't available without pg connection.
    // Instead, we use the Supabase service-role client to call a workaround:
    // Delete existing customer role row then insert admin.
    // NOTE: private schema tables are accessible with service role key.
    const { error: delErr } = await admin
      .schema("private")
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (delErr) {
      console.warn(`   ⚠  Role delete warning (may not exist yet): ${delErr.message}`);
    }

    const { error: roleErr } = await admin
      .schema("private")
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    if (roleErr) {
      console.warn(`   ⚠  Admin role upsert warning: ${roleErr.message}`);
      console.warn("       You may need to manually run:");
      console.warn(`       INSERT INTO private.user_roles (user_id, role) VALUES ('${userId}', 'admin') ON CONFLICT DO NOTHING;`);
    } else {
      console.log("   Role set to admin.");
    }
  } else {
    console.log("   Role: customer (set by trigger on user creation).");
  }

  return userId;
}

// ── Seed a demo address for the customer ─────────────────────────────────────
async function seedCustomerAddress(userId) {
  // Remove any existing default first (unique constraint on user_id where is_default)
  await admin.from("addresses").update({ is_default: false }).eq("user_id", userId);

  const { error } = await admin.from("addresses").upsert({
    user_id:           userId,
    label:             "Home",
    recipient_name:    "Demo Customer",
    phone:             "09170000001",
    address_line1:     "123 Demo Street, Barangay Sample",
    city_municipality: "Manila",
    province:          "Metro Manila",
    postal_code:       "1000",
    is_default:        true,
  }, { onConflict: "id" });

  if (error) {
    console.warn(`   ⚠  Address seed warning: ${error.message}`);
  } else {
    console.log("   Demo address seeded.");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  1968 Clothing — Local Demo Account Bootstrap");
  console.log("  TARGET:", SUPABASE_URL);
  console.log("  ⚠  LOCAL DEVELOPMENT ONLY — DO NOT RUN ON PRODUCTION");
  console.log("═══════════════════════════════════════════════════════════");

  const customerId = await upsertUser(CUSTOMER);
  await seedCustomerAddress(customerId);

  await upsertUser(ADMIN_USER);

  console.log(`
═══════════════════════════════════════════════════════════
  ✅  Done.

  CUSTOMER
  Email:    ${CUSTOMER.email}
  Password: ${CUSTOMER.password}
  Role:     customer

  ADMIN
  Email:    ${ADMIN_USER.email}
  Password: ${ADMIN_USER.password}
  Role:     admin
  ⚠  MFA NOT ENROLLED — see docs/LOCAL_DEMO_ACCOUNTS.md
     for TOTP enrollment steps required to reach /admin.

  See docs/LOCAL_DEMO_ACCOUNTS.md for full QA instructions.
═══════════════════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("❌  Script failed:", err.message ?? err);
  process.exit(1);
});
