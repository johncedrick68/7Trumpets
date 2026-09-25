import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const LOCAL_API_PORT = "54321";
const LOCAL_DB_CONTAINER = "supabase_db_7trumpets";

export function assertLocalSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LOCAL_QA_REJECTED: Supabase URL is invalid.");
  }

  const localHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!localHost || url.protocol !== "http:" || url.port !== LOCAL_API_PORT) {
    throw new Error("LOCAL_QA_REJECTED: target must be the local Supabase API on port 54321.");
  }
  return url.toString().replace(/\/$/, "");
}

function runLocalSql(sql, failureCode) {
  const result = spawnSync(
    "docker",
    ["exec", LOCAL_DB_CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`${failureCode}: ${result.stderr?.trim() || "local database command failed"}`);
  }
}

function assignOrdinaryAdminRole(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("LOCAL_QA_REJECTED: invalid Auth user id.");
  runLocalSql(
    `insert into private.user_roles (user_id, role) values ('${userId}', 'admin') on conflict do nothing;`,
    "LOCAL_QA_ROLE_SETUP_FAILED",
  );
}

export async function createEphemeralLocalAdmin({ supabaseUrl, secretKey }) {
  const localUrl = assertLocalSupabaseUrl(supabaseUrl);
  if (!secretKey) throw new Error("LOCAL_QA_REJECTED: local Supabase secret key is unavailable.");

  const adminClient = createClient(localUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `axe-${randomUUID()}@qa.1968.local`;
  const password = `${randomBytes(30).toString("base64url")}Aa1!`;
  let userId;

  try {
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) throw createError || new Error("Auth user creation returned no user.");
    userId = created.user.id;
    assignOrdinaryAdminRole(userId);

    const sessionClient = createClient(localUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await sessionClient.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const { data: enrollment, error: enrollError } = await sessionClient.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Ephemeral Admin Axe",
    });
    if (enrollError || !enrollment?.totp?.secret) {
      throw enrollError || new Error("TOTP enrollment returned no secret.");
    }

    return {
      email,
      password,
      factorId: enrollment.id,
      totpSecret: enrollment.totp.secret,
      sessionClient,
      async cleanup() {
        if (userId) {
          await adminClient.auth.admin.deleteUser(userId);
        }
      },
    };
  } catch (error) {
    if (userId) {
      await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    throw error;
  }
}
