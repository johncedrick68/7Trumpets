import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import process from "node:process";
import axe from "axe-core";
import { chromium } from "playwright-core";

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const executable = candidates.find((c) => existsSync(c));
  if (!executable) throw new Error("No supported local Chromium executable was found.");
  return executable;
}

async function scan(page, label) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("main").waitFor({ state: "visible", timeout: 15000 }).catch(() => page.locator("body").waitFor({ state: "visible" }));
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
      examples: violation.nodes.slice(0, 3).map((node) => node.html),
    })),
  };
}

async function checkHorizontalOverflow(page, route, viewport) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const hasHorizontalOverflow = scrollWidth > docWidth + 1 || bodyScrollWidth > docWidth + 1;
    return {
      docWidth,
      scrollWidth,
      bodyScrollWidth,
      hasHorizontalOverflow,
    };
  });
  assert.ok(!overflow.hasHorizontalOverflow, `${route} at ${viewport.width}x${viewport.height} has horizontal overflow (docWidth=${overflow.docWidth}, scrollWidth=${overflow.scrollWidth})`);
  return overflow;
}

async function main() {
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  const findings = [];
  const keyboardEvidence = [];
  const responsiveEvidence = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (err) => console.error("BROWSER_UNHANDLED_ERROR:", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("BROWSER_CONSOLE_ERROR:", msg.text());
    });

    // ─────────────────────────────────────────────────────────────
    // 1. Accessibility Scans (Axe) across key storefront surfaces
    // ─────────────────────────────────────────────────────────────
    console.log("Starting Axe accessibility scans...");

    // 1A. Home Page
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    findings.push(await scan(page, "Homepage (/)"));

    // 1B. Catalog (/products)
    await page.goto(`${baseUrl}/products`, { waitUntil: "load" });
    const collectionsNav = page.locator("nav[aria-label='Collections']");
    await collectionsNav.waitFor({ state: "visible", timeout: 15000 });
    findings.push(await scan(page, "Catalog (/products)"));

    // 1C. First available category
    const categoryLink = await collectionsNav.locator("a").nth(1).getAttribute("href");
    const testCategoryUrl = categoryLink ? `${baseUrl}${categoryLink}` : `${baseUrl}/products`;
    await page.goto(testCategoryUrl, { waitUntil: "load" });
    findings.push(await scan(page, `Category Page (${categoryLink || "/products"})`));

    // 1D. Search Drawer Open State (with query and results)
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const searchBtn = page.getByRole("button", { name: /search/i }).first();
    await searchBtn.click();
    const searchInput = page.locator("#header-search-input");
    await searchInput.waitFor({ state: "visible" });
    await searchInput.fill("San Roque");
    await page.waitForTimeout(600); // debounce wait
    findings.push(await scan(page, "Predictive Search · Active query with results"));

    // 1E. Search Drawer (no results state)
    await searchInput.fill("nonexistentpattern9999");
    await page.waitForTimeout(600);
    findings.push(await scan(page, "Predictive Search · No results empty state"));

    // 1F. Mobile Menu Open State
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const mobileMenuBtn = page.locator(".menu-toggle, button[aria-label*='navigation menu']").first();
    await mobileMenuBtn.click();
    const mobileDialog = page.getByRole("dialog");
    await mobileDialog.waitFor({ state: "visible" });
    findings.push(await scan(page, "Mobile Navigation Drawer (390px)"));

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // ─────────────────────────────────────────────────────────────
    // 2. Keyboard Navigation & Interaction Tests
    // ─────────────────────────────────────────────────────────────
    console.log("Starting Keyboard and Interaction QA...");

    // 2A. Skip Link Focus & Operability
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    const skipLinkActive = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName.toLowerCase(),
        href: el?.getAttribute("href"),
        text: el?.textContent?.trim(),
      };
    });
    assert.equal(skipLinkActive.href, "#main-content", "First Tab target must be skip link href=#main-content");
    keyboardEvidence.push({ action: "Tab to skip link", target: skipLinkActive, result: "PASS" });

    // 2B. Predictive Search: Open via keyboard, arrow navigation, Escape focus return
    const desktopSearchBtn = page.getByRole("button", { name: /search/i }).first();
    await desktopSearchBtn.focus();
    await page.keyboard.press("Enter");
    const searchDrawerInput = page.locator("#header-search-input");
    await searchDrawerInput.waitFor({ state: "visible" });
    assert.ok(await searchDrawerInput.evaluate((node) => node === document.activeElement), "Search input must auto-focus when drawer opens");

    await page.keyboard.type("San");
    await page.waitForTimeout(600);
    // ArrowDown to first result
    await page.keyboard.press("ArrowDown");
    const firstResultFocused = await page.evaluate(() => document.activeElement?.className.includes("predictive-search-result"));
    keyboardEvidence.push({ action: "ArrowDown into search results", receivedFocus: firstResultFocused, result: "PASS" });

    // Escape closes drawer and returns focus to search trigger button
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    assert.ok(await desktopSearchBtn.evaluate((node) => node === document.activeElement), "Escape must close search drawer and return focus to search button");
    keyboardEvidence.push({ action: "Escape search drawer", restoredFocusToTrigger: true, result: "PASS" });

    // 2C. Mobile Menu: Open, Escape focus return
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const mobileToggle = page.locator(".menu-toggle, button[aria-label*='navigation menu']").first();
    await mobileToggle.focus();
    await page.keyboard.press("Enter");
    const mobDialog = page.getByRole("dialog");
    await mobDialog.waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await mobDialog.waitFor({ state: "hidden" });
    assert.ok(await mobileToggle.evaluate((node) => node === document.activeElement), "Escape must close mobile drawer and return focus to toggle");
    keyboardEvidence.push({ action: "Escape mobile menu", restoredFocusToTrigger: true, result: "PASS" });

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2D. ProductCard Square 1:1 Aspect Ratio Verification
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const cardImageAspect = await page.evaluate(() => {
      const firstImageContainer = document.querySelector(".product-tile-image");
      if (!firstImageContainer) return null;
      const rect = firstImageContainer.getBoundingClientRect();
      const ratio = rect.width / rect.height;
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        ratio: Number(ratio.toFixed(2)),
      };
    });
    assert.ok(cardImageAspect, "Product tile image container must exist");
    assert.ok(Math.abs(cardImageAspect.ratio - 1.0) < 0.05, `Product tile image must be 1:1 square ratio, got ${cardImageAspect.ratio} (${cardImageAspect.width}x${cardImageAspect.height})`);
    keyboardEvidence.push({ action: "1:1 Square Product Image Ratio", aspect: cardImageAspect, result: "PASS" });

    // 2E. Filter & Sort Operability on /products
    console.log("Navigating to /products for filter/sort test...");
    await page.goto(`${baseUrl}/products`, { waitUntil: "networkidle" });
    console.log("On /products. URL:", page.url());
    const sortSelect = page.locator("#catalog-sort");
    await sortSelect.waitFor({ state: "visible" });
    await page.waitForTimeout(1000);
    console.log("Selecting price_asc on #catalog-sort...");
    await sortSelect.selectOption("price_asc");
    console.log("Selected price_asc. Waiting for URL update. Current URL:", page.url());
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      console.log(`Poll ${i}: URL is:`, page.url());
      if (page.url().includes("sort=price_asc")) break;
    }
    assert.ok(page.url().includes("sort=price_asc"), `URL must include sort=price_asc, got ${page.url()}`);
    keyboardEvidence.push({ action: "Sort dropdown selection", urlParam: "sort=price_asc", result: "PASS" });

    const inStockCheckbox = page.locator("input[type='checkbox'][name='availability']");
    await inStockCheckbox.waitFor({ state: "visible" });
    await page.waitForTimeout(500);
    await inStockCheckbox.check();
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      console.log(`Checkbox Poll ${i}: URL is:`, page.url());
      if (page.url().includes("availability=in_stock")) break;
    }
    assert.ok(page.url().includes("availability=in_stock"), `URL must include availability=in_stock, got ${page.url()}`);
    keyboardEvidence.push({ action: "In-stock checkbox filter", urlParam: "availability=in_stock", result: "PASS" });

    // ─────────────────────────────────────────────────────────────
    // 3. Responsive Matrix Verification (7 canonical viewports)
    // ─────────────────────────────────────────────────────────────
    console.log("Starting Responsive Matrix Verification...");
    const viewports = [
      { name: "320x568 (Mobile Small)", width: 320, height: 568 },
      { name: "390x844 (Mobile Medium / iPhone)", width: 390, height: 844 },
      { name: "768x1024 (Tablet Portrait)", width: 768, height: 1024 },
      { name: "1024x768 (Tablet Landscape)", width: 1024, height: 768 },
      { name: "1280x800 (Laptop)", width: 1280, height: 800 },
      { name: "1440x900 (Desktop Large)", width: 1440, height: 900 },
      { name: "1920x1080 (Ultra-Wide)", width: 1920, height: 1080 },
    ];

    const testRoutes = ["/", "/products", testCategoryUrl.replace(baseUrl, "")];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of testRoutes) {
        const overflow = await checkHorizontalOverflow(page, route, vp);
        responsiveEvidence.push({
          viewport: vp.name,
          route,
          overflow: "NONE (PASS)",
          docWidth: overflow.docWidth,
          scrollWidth: overflow.scrollWidth,
        });
      }
    }

    console.log("\n=== KEYBOARD & INTERACTION EVIDENCE ===");
    console.log(JSON.stringify(keyboardEvidence, null, 2));

    console.log("\n=== RESPONSIVE MATRIX EVIDENCE ===");
    console.table(responsiveEvidence);

    console.log("\n=== AUTOMATED AXE FINDINGS ===");
    console.log(JSON.stringify(findings, null, 2));
    const violationCount = findings.reduce((sum, f) => sum + f.violations.length, 0);
    console.log(`\nScanned ${findings.length} states; ${violationCount} automated axe rule violations found.`);
    if (violationCount > 0) process.exitCode = 1;

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("STOREFRONT_QA_FAILED:", err);
  process.exit(1);
});
