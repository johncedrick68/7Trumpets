import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("post-login authentication is role and MFA aware", async () => {
  const actions = await read("src/lib/auth/actions.ts");
  const confirm = await read("src/app/auth/confirm/route.ts");
  const routing = await read("src/lib/auth/mfa-routing.ts");

  assert.match(actions, /resolvePostLoginDestination\(supabase, next\)/);
  assert.match(confirm, /resolvePostLoginDestination\(supabase, next\)/);
  assert.match(routing, /!hasVerifiedTotp.*\/mfa\/enroll/s);
  assert.match(routing, /aal !== "aal2".*\/mfa\/verify/s);
  assert.match(routing, /safeAdminRedirectPath\(next, "\/admin"\)/);
});

test("MFA enrollment and verification are separate guarded routes", async () => {
  const enroll = await read("src/app/mfa/enroll/page.tsx");
  const verify = await read("src/app/mfa/verify/page.tsx");
  const form = await read("src/components/admin-mfa-form.tsx");

  assert.match(enroll, /getAdminAuthContext\(\)/);
  assert.match(enroll, /mode="enroll"/);
  assert.match(verify, /getAdminAuthContext\(\)/);
  assert.match(verify, /factor\.status === "verified"/);
  assert.match(verify, /mode="verify"/);
  assert.match(form, /factorType: "totp"/);
  assert.match(form, /challengeAndVerify/);
  assert.match(form, /currentLevel !== "aal2"/);
  assert.doesNotMatch(form, /generateDevTotp|getAdminTotpCode|console\./);
});

test("Admin authorization remains AAL2 and routes AAL1 only to MFA", async () => {
  const auth = await read("src/lib/admin/auth.ts");
  assert.match(auth, /context\.aal !== "aal2"/);
  assert.match(auth, /hasVerifiedTotp \? "\/mfa\/verify" : "\/mfa\/enroll"/);
  assert.doesNotMatch(auth, /return context;\s*\/\/.*aal1/i);
});
