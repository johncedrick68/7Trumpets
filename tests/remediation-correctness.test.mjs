import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product editing exposes and preserves description", async () => {
  const dialog = await read("src/components/admin/product-dialog.tsx");
  const actions = await read("src/lib/admin/actions.ts");
  assert.match(dialog, /name="description"/);
  assert.match(dialog, /defaultValue=\{product\?\.description \?\? ""\}/);
  assert.match(actions, /formData\.has\("description"\)/);
  assert.match(actions, /existingProduct\?\.description/);
});

test("variant editor uses only canonical database statuses", async () => {
  const dialog = await read("src/components/admin/variant-dialog.tsx");
  const actions = await read("src/lib/admin/actions.ts");
  for (const status of ["active", "inactive", "archived"]) {
    assert.match(dialog, new RegExp(`value="${status}"`));
  }
  assert.doesNotMatch(dialog, /value="draft"/);
  assert.match(actions, /\["active", "inactive", "archived"\]/);
});

test("shipping uses the configured free-delivery threshold at every boundary", async () => {
  const { calculateShippingMinor } = await import(new URL("../src/lib/checkout/shipping.ts", import.meta.url).href);
  const settings = { shipping_fee_minor: 15_000, free_shipping_threshold_minor: 350_000 };
  assert.equal(calculateShippingMinor(349_999, "SHIPMENT", settings), 15_000);
  assert.equal(calculateShippingMinor(350_000, "SHIPMENT", settings), 0);
  assert.equal(calculateShippingMinor(350_001, "SHIPMENT", settings), 0);
  assert.equal(calculateShippingMinor(1, "STORE_PICKUP", settings), 0);
});

test("global storefront chrome does not make auth routes depend on catalog reads", async () => {
  const layout = await read("src/app/layout.tsx");
  const chrome = await read("src/components/storefront-chrome.tsx");

  assert.doesNotMatch(layout, /getCategories/);
  assert.match(chrome, /Current Drops/);
  assert.match(chrome, /San Roque Collection/);
  assert.match(chrome, /1968 Classics/);
});

test("auth visual authority uses local display type and one shared logo", async () => {
  const layout = await read("src/app/layout.tsx");
  const chrome = await read("src/components/storefront-chrome.tsx");
  const frame = await read("src/components/auth-frame.tsx");
  const brandLogo = await read("src/components/brand-logo.tsx");

  assert.match(layout, /next\/font\/local/);
  assert.match(layout, /sfprodisplayregular\.otf/);
  assert.match(chrome, /!isAuthRoute && announcement/);
  assert.match(chrome, /!isAuthRoute && <Link href="\/account"/);
  assert.doesNotMatch(frame, /BrandLogo|next\/image|1968-logo/);
  assert.match(brandLogo, /1968-logo-cropped\.webp/);
});
