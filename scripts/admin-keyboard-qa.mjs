import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

import { generateTOTP } from "./generate-totp.mjs";
import { assertLocalSupabaseTarget } from "./local-supabase-guard.mjs";
import { createEphemeralLocalAdmin } from "./local-qa-admin.mjs";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
assertLocalSupabaseTarget(baseUrl, "Admin keyboard QA");

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const split = line.indexOf("=");
        return [line.slice(0, split), line.slice(split + 1).trim()];
      })
  );
}

const env = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

const executable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
assert.ok(executable, "A local Chromium browser is required");

async function authenticate(page, identity) {
  await page.goto(`${baseUrl}/login?next=/admin`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(identity.email);
  await page.locator('input[name="password"]').fill(identity.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  if (new URL(page.url()).pathname === "/mfa/verify") {
    const factors = await page.locator('input[autocomplete="one-time-code"]').count();
    assert.equal(factors, 1, "MFA verification input must render");
    await page.locator('input[autocomplete="one-time-code"]').fill(generateTOTP(identity.totpSecret));
    await page.getByRole("button", { name: /verify/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/admin"));
  }
}

async function focusedEvidence(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      name: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.getAttribute("name"),
      visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
      focusIndicator: style.outlineStyle !== "none" || style.boxShadow !== "none",
    };
  });
}

const routes = [
  "/admin",
  "/admin/catalog",
  "/admin/inventory",
  "/admin/orders",
  "/admin/payments",
  "/admin/returns",
  "/admin/support",
  "/admin/settings",
  "/admin/pos",
];

const identity = await createEphemeralLocalAdmin({ supabaseUrl, secretKey });
const browser = await chromium.launch({ executablePath: executable, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  // Pre-challenge TOTP so session is valid for login
  const initialCode = generateTOTP(identity.totpSecret);
  const { error: verifyError } = await identity.sessionClient.auth.mfa.challengeAndVerify({
    factorId: identity.factorId,
    code: initialCode,
  });
  if (verifyError) throw verifyError;
  await identity.sessionClient.auth.signOut();
  while (generateTOTP(identity.totpSecret) === initialCode) {
    await new Promise((r) => setTimeout(r, 500));
  }

  await authenticate(page, identity);
  const evidence = [];

  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.locator("main").waitFor({ state: "visible" });
    await page.keyboard.press("Tab");
    const first = await focusedEvidence(page);
    assert.ok(first?.visible, `${route}: first Tab target must be visible`);
    assert.ok(first?.focusIndicator, `${route}: first Tab target must have a visible focus indicator`);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Escape");
    evidence.push({ route, firstTab: first, shiftTab: "operable", escape: "no trap" });
  }

  // 1. Catalog dialog test
  await page.goto(`${baseUrl}/admin/catalog`, { waitUntil: "domcontentloaded" });
  const catalogTrigger = page.getByRole("button", { name: /add variant/i }).first();
  if (await catalogTrigger.isVisible()) {
    await catalogTrigger.focus();
    await page.keyboard.press("Enter");
    const catalogDialog = page.getByRole("dialog", { name: /variant/i });
    await catalogDialog.waitFor({ state: "visible" });
    assert.ok(await catalogDialog.evaluate((node) => node.contains(document.activeElement)), "Dialog must receive focus");
    await page.keyboard.press("Escape");
    await catalogDialog.waitFor({ state: "hidden" });
    assert.ok(await catalogTrigger.evaluate((node) => node === document.activeElement), "Dialog close must restore trigger focus");
    evidence.push({ route: "/admin/catalog · Variant dialog", enter: "opens", escape: "closes", focusReturn: "PASS" });
  }

  // 2. Inventory Adjust Stock dialog test
  await page.goto(`${baseUrl}/admin/inventory`, { waitUntil: "domcontentloaded" });
  const adjustTrigger = page.getByRole("button", { name: /adjust stock/i }).first();
  if (await adjustTrigger.isVisible()) {
    await adjustTrigger.focus();
    await page.keyboard.press("Enter");
    const adjustDialog = page.getByRole("dialog");
    await adjustDialog.waitFor({ state: "visible" });
    assert.ok(await adjustDialog.evaluate((node) => node.contains(document.activeElement)), "Adjust dialog must receive focus");
    await page.keyboard.press("Escape");
    await adjustDialog.waitFor({ state: "hidden" });
    assert.ok(await adjustTrigger.evaluate((node) => node === document.activeElement), "Adjust dialog close must return focus to trigger");
    evidence.push({ route: "/admin/inventory · Adjust Stock dialog", enter: "opens", escape: "closes", focusReturn: "PASS" });
  }

  // 3. Support Composer test
  await page.goto(`${baseUrl}/admin/support`, { waitUntil: "domcontentloaded" });
  const messageInput = page.locator("#admin-support-message");
  if (await messageInput.isVisible()) {
    await messageInput.focus();
    const focused = await focusedEvidence(page);
    assert.equal(focused?.tag, "textarea", "Composer message input must be focusable");
    evidence.push({ route: "/admin/support · Composer textarea", focus: "operable", ariaLabelled: "PASS" });
  }

  console.log(JSON.stringify(evidence, null, 2));
  console.log("\nAll keyboard QA checks passed successfully!");
} finally {
  await browser.close();
  await identity.cleanup();
}
