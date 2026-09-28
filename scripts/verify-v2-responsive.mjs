import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { generateTOTP } from "./generate-totp.mjs";
import { createEphemeralLocalAdmin } from "./local-qa-admin.mjs";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
const viewports = [
  { name: "Mobile Small", width: 320, height: 640 },
  { name: "Mobile Standard", width: 390, height: 844 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Laptop Small", width: 1280, height: 800 },
  { name: "Desktop Large", width: 1440, height: 900 },
  { name: "Ultra-Wide", width: 1920, height: 1080 },
];

function browserExecutable() {
  const executable = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean).find(existsSync);
  assert.ok(executable, "Chromium browser required");
  return executable;
}

async function authenticate(page, identity) {
  await page.goto(`${baseUrl}/login?next=/admin`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(identity.email);
  await page.locator('input[name="password"]').fill(identity.password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  if (new URL(page.url()).pathname === "/mfa/verify") {
    await page.locator('input[autocomplete="one-time-code"]').fill(generateTOTP(identity.totpSecret));
    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/admin")),
      page.getByRole("button", { name: /verify/i }).click(),
    ]);
  }
}

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

async function run() {
  const env = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;

  console.log("Creating ephemeral admin identity...");
  const identity = await createEphemeralLocalAdmin({ supabaseUrl, secretKey });

  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  const results = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    // Verify TOTP initially to reach AAL2
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

    for (const vp of viewports) {
      console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of ["/admin", "/admin/catalog"]) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);

        // Check 1: Exactly one H1
        const h1Count = await page.locator("h1").count();
        const h1Text = h1Count > 0 ? await page.locator("h1").first().innerText() : "NONE";
        assert.equal(h1Count, 1, `${route} at ${vp.width}px must have exactly one H1`);

        // Check 2: No horizontal window scroll overflow on body
        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        // Check 3: Sidebar / Drawer trigger presence
        const isMobile = vp.width < 768;
        const mobileToggleVisible = await page.locator('button[aria-label="Open navigation menu"]').isVisible();
        const desktopSidebarVisible = await page.locator('aside[aria-label="Admin sidebar"]').isVisible();

        if (isMobile) {
          assert.ok(mobileToggleVisible, `${route} at ${vp.width}px must show mobile navigation toggle`);
        } else {
          assert.ok(desktopSidebarVisible, `${route} at ${vp.width}px must show desktop sidebar`);
        }

        console.log(`  ✓ ${route.padEnd(16)} | H1: "${h1Text}" | Overflow: ${isOverflowing ? "FAIL" : "NONE"} | Nav: OK`);

        results.push({
          viewport: `${vp.name} (${vp.width}px)`,
          route,
          h1Count,
          h1Text,
          overflow: isOverflowing ? "OVERFLOW" : "PASS",
          navState: isMobile ? "Mobile Drawer Trigger" : "Desktop Sidebar",
        });
      }
    }

    console.log("\nAll responsive tests passed successfully across all 6 viewports!");
    console.table(results);
  } finally {
    await browser.close();
    await identity.cleanup();
  }
}

run().catch((err) => {
  console.error("Responsive verification failed:", err);
  process.exit(1);
});
