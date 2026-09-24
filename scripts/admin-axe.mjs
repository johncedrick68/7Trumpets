import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import process from "node:process";

import axe from "axe-core";
import { chromium } from "playwright-core";

import { generateTOTP } from "./generate-totp.mjs";

const baseUrl = process.env.AXE_BASE_URL || "http://localhost:3000";
const navigationTimeout = Number(process.env.AXE_NAVIGATION_TIMEOUT_MS || 20_000);
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const routes = [
  "/admin",
  "/admin/catalog",
  "/admin/orders",
  "/admin/payments",
  "/admin/pos",
  "/admin/returns",
  "/admin/support",
  "/admin/users",
  "/admin/audit",
  "/admin/settings",
];

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const split = line.indexOf("=");
    return [line.slice(0, split), line.slice(split + 1).trim()];
  }));
}

async function loadLocalEnv() {
  try {
    return parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
  } catch {
    return {};
  }
}

async function isReachable(url) {
  const target = new URL(url);
  return new Promise((resolve) => {
    const socket = createConnection({ host: target.hostname, port: Number(target.port || 80) });
    const finish = (reachable) => { socket.destroy(); resolve(reachable); };
    socket.setTimeout(2_000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function startAppIfNeeded() {
  if (await isReachable(baseUrl)) return null;
  const url = new URL(baseUrl);
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", url.port || "3000"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let diagnostic = "";
  child.stdout.on("data", (chunk) => { diagnostic += chunk.toString(); });
  child.stderr.on("data", (chunk) => { diagnostic += chunk.toString(); });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local app exited before becoming ready.\n${diagnostic}`);
    if (await isReachable(baseUrl)) return child;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`Local app did not become ready within 20 seconds.\n${diagnostic}`);
}

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error("No supported local Chromium executable was found.");
  return executable;
}

async function authenticate(page, env) {
  const email = process.env.DEMO_ADMIN_EMAIL || env.DEMO_ADMIN_EMAIL || "admin.demo@1968.local";
  const password = process.env.DEMO_ADMIN_PASSWORD || env.DEMO_ADMIN_PASSWORD || "Demo1968Admin!";
  const totpSecret = process.env.DEMO_ADMIN_TOTP_SECRET || env.DEMO_ADMIN_TOTP_SECRET;
  await page.goto(`${baseUrl}/login?next=/admin`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: navigationTimeout }),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  if (new URL(page.url()).pathname === "/mfa/verify") {
    if (!totpSecret) throw new Error("A verified admin requires DEMO_ADMIN_TOTP_SECRET for the accessibility session.");
    await page.locator('input[autocomplete="one-time-code"]').fill(generateTOTP(totpSecret));
    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: navigationTimeout }),
      page.getByRole("button", { name: /verify/i }).click(),
    ]);
  }
  if (!new URL(page.url()).pathname.startsWith("/admin")) throw new Error(`Admin authentication ended at ${page.url()}`);
}

async function scan(page, label) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("main").waitFor({ state: "visible", timeout: navigationTimeout }).catch(() => page.locator("body").waitFor({ state: "visible", timeout: navigationTimeout }));
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async (runOnly) => globalThis.axe.run(document, { runOnly: { type: "tag", values: runOnly } }), tags);
  return {
    label,
    url: page.url(),
    violations: result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    })),
  };
}

async function gotoAdminRoute(page, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
  if (!response) throw new Error(`${route}: navigation returned no HTTP response.`);
  if (!response.ok()) throw new Error(`${route}: HTTP ${response.status()}.`);
  if (!new URL(page.url()).pathname.startsWith("/admin")) throw new Error(`${route}: authentication redirected to ${page.url()}.`);
}

async function main() {
  const env = await loadLocalEnv();
  const app = await startAppIfNeeded();
  let browser;
  let context;
  const findings = [];
  try {
    browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.setDefaultTimeout(navigationTimeout);
    await authenticate(page, env);
    for (const route of routes) {
      await gotoAdminRoute(page, route);
      findings.push(await scan(page, route));
    }
    await gotoAdminRoute(page, "/admin/orders");
    await page.getByRole("button", { name: /quick view|inspect/i }).first().click();
    const orderHref = await page.locator('a[href^="/admin/orders/"]').first().getAttribute("href");
    if (!orderHref) throw new Error("No valid local order detail link was found.");
    await gotoAdminRoute(page, orderHref);
    findings.push(await scan(page, "/admin/orders/[id]"));

    await gotoAdminRoute(page, "/admin/catalog");
    await page.getByRole("button", { name: "Add Variant" }).first().click();
    findings.push(await scan(page, "/admin/catalog · Add Variant dialog"));
    const productSelect = page.getByRole("combobox").first();
    if (await productSelect.isVisible()) {
      await productSelect.click();
      findings.push(await scan(page, "/admin/catalog · Add Variant select open"));
    }
  } finally {
    await context?.close();
    await browser?.close();
    if (app && app.exitCode === null) app.kill();
  }
  console.log("AUTOMATED AXE FINDINGS");
  console.log(JSON.stringify(findings, null, 2));
  const violationCount = findings.reduce((sum, finding) => sum + finding.violations.length, 0);
  console.log(`Scanned ${findings.length} states; ${violationCount} rule violations found.`);
  if (violationCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("ADMIN_AXE_RUNNER_FAILED");
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 2;
});
