import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

import { generateTOTP } from "./generate-totp.mjs";
import { assertLocalSupabaseTarget } from "./local-supabase-guard.mjs";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
assertLocalSupabaseTarget(baseUrl, "Admin keyboard QA");

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const split = line.indexOf("=");
    return [line.slice(0, split), line.slice(split + 1).trim()];
  }));
}

const env = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
const executable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean).find(existsSync);
assert.ok(executable, "A local Chromium browser is required");

async function authenticate(page) {
  await page.goto(`${baseUrl}/login?next=/admin`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(env.DEMO_ADMIN_EMAIL || "admin.demo@1968.local");
  await page.locator('input[name="password"]').fill(env.DEMO_ADMIN_PASSWORD || "Demo1968Admin!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  if (new URL(page.url()).pathname === "/mfa/verify") {
    const factors = await page.locator('input[autocomplete="one-time-code"]').count();
    assert.equal(factors, 1, "MFA verification input must render");
    assert.ok(env.DEMO_ADMIN_TOTP_SECRET, "DEMO_ADMIN_TOTP_SECRET is required");
    await page.locator('input[autocomplete="one-time-code"]').fill(generateTOTP(env.DEMO_ADMIN_TOTP_SECRET));
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
  "/admin", "/admin/catalog", "/admin/orders", "/admin/payments", "/admin/returns",
  "/admin/support", "/admin/settings", "/admin/pos",
];
const browser = await chromium.launch({ executablePath: executable, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await authenticate(page);
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

  await page.goto(`${baseUrl}/admin/catalog`, { waitUntil: "domcontentloaded" });
  const trigger = page.getByRole("button", { name: "Add Variant", exact: true }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /variant/i });
  await dialog.waitFor({ state: "visible" });
  assert.ok(await dialog.evaluate((node) => node.contains(document.activeElement)), "Dialog must receive focus");
  const productSelect = dialog.getByRole("combobox", { name: /product/i });
  await productSelect.press("Enter");
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await listbox.waitFor({ state: "hidden" });
  assert.ok(await dialog.isVisible(), "First Escape must close only the nested Select");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await trigger.evaluate((node) => node === document.activeElement), "Dialog close must restore trigger focus");
  evidence.push({ route: "/admin/catalog · nested overlay", enter: "opens", arrows: "operate select", escape1: "select closes", escape2: "dialog closes", focusReturn: "PASS" });

  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
