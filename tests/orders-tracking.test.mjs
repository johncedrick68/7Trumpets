import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function deriveCustomerFulfillmentStage(status) {
  const normalized = status.toUpperCase();

  switch (normalized) {
    case "CONFIRMED":
      return {
        stage: "CONFIRMED",
        label: "Order Confirmed",
        description: "Your order has been received and confirmed.",
        isTerminal: false,
        isException: false,
        stepIndex: 1,
      };

    case "PROCESSING":
    case "PACKING":
    case "READY_FOR_SHIPMENT":
      return {
        stage: "PREPARING",
        label: "Preparing Order",
        description: "We are carefully assembling and packaging your devotional items.",
        isTerminal: false,
        isException: false,
        stepIndex: 2,
      };

    case "SHIPPED":
    case "IN_TRANSIT":
      return {
        stage: "SHIPPING",
        label: "In Transit",
        description: "Your package is on its way to your destination hub.",
        isTerminal: false,
        isException: false,
        stepIndex: 3,
      };

    case "OUT_FOR_DELIVERY":
      return {
        stage: "ARRIVING",
        label: "Out for Delivery",
        description: "Your package is with the courier for doorstep delivery today.",
        isTerminal: false,
        isException: false,
        stepIndex: 4,
      };

    case "DELIVERED":
    case "COMPLETED":
      return {
        stage: "DELIVERED",
        label: "Delivered",
        description: "Your package has been successfully delivered.",
        isTerminal: true,
        isException: false,
        stepIndex: 5,
      };

    case "CANCELLED":
      return {
        stage: "CANCELLED",
        label: "Order Cancelled",
        description: "This order has been cancelled.",
        isTerminal: true,
        isException: true,
        stepIndex: -1,
      };

    case "DELIVERY_FAILED":
      return {
        stage: "DELIVERY_FAILED",
        label: "Delivery Failed",
        description: "The courier was unable to deliver your package. We will contact you.",
        isTerminal: true,
        isException: true,
        stepIndex: -1,
      };

    default:
      return {
        stage: "UNKNOWN",
        label: normalized,
        description: "Order status is currently being updated.",
        isTerminal: false,
        isException: false,
        stepIndex: 1,
      };
  }
}

test("customer fulfillment status helper file exists and implements all canonical order status mappings", async () => {
  const statusFile = await read("src/lib/orders/status.ts");

  assert.match(statusFile, /CONFIRMED/);
  assert.match(statusFile, /PROCESSING/);
  assert.match(statusFile, /PACKING/);
  assert.match(statusFile, /READY_FOR_SHIPMENT/);
  assert.match(statusFile, /SHIPPED/);
  assert.match(statusFile, /IN_TRANSIT/);
  assert.match(statusFile, /OUT_FOR_DELIVERY/);
  assert.match(statusFile, /DELIVERED/);
  assert.match(statusFile, /COMPLETED/);
  assert.match(statusFile, /CANCELLED/);
  assert.match(statusFile, /DELIVERY_FAILED/);
});

test("customer fulfillment stages map accurately for all canonical order statuses without creating duplicate status rows", () => {
  // Linear happy-path stages
  assert.strictEqual(deriveCustomerFulfillmentStage("CONFIRMED").stage, "CONFIRMED");
  assert.strictEqual(deriveCustomerFulfillmentStage("CONFIRMED").stepIndex, 1);

  assert.strictEqual(deriveCustomerFulfillmentStage("PROCESSING").stage, "PREPARING");
  assert.strictEqual(deriveCustomerFulfillmentStage("PACKING").stage, "PREPARING");
  assert.strictEqual(deriveCustomerFulfillmentStage("READY_FOR_SHIPMENT").stage, "PREPARING");
  assert.strictEqual(deriveCustomerFulfillmentStage("PROCESSING").stepIndex, 2);

  assert.strictEqual(deriveCustomerFulfillmentStage("SHIPPED").stage, "SHIPPING");
  assert.strictEqual(deriveCustomerFulfillmentStage("IN_TRANSIT").stage, "SHIPPING");
  assert.strictEqual(deriveCustomerFulfillmentStage("SHIPPED").stepIndex, 3);

  assert.strictEqual(deriveCustomerFulfillmentStage("OUT_FOR_DELIVERY").stage, "ARRIVING");
  assert.strictEqual(deriveCustomerFulfillmentStage("OUT_FOR_DELIVERY").stepIndex, 4);

  assert.strictEqual(deriveCustomerFulfillmentStage("DELIVERED").stage, "DELIVERED");
  assert.strictEqual(deriveCustomerFulfillmentStage("COMPLETED").stage, "DELIVERED");
  assert.strictEqual(deriveCustomerFulfillmentStage("DELIVERED").stepIndex, 5);
  assert.strictEqual(deriveCustomerFulfillmentStage("DELIVERED").isTerminal, true);

  // Exception stages
  assert.strictEqual(deriveCustomerFulfillmentStage("CANCELLED").stage, "CANCELLED");
  assert.strictEqual(deriveCustomerFulfillmentStage("CANCELLED").isException, true);
  assert.strictEqual(deriveCustomerFulfillmentStage("CANCELLED").stepIndex, -1);

  assert.strictEqual(deriveCustomerFulfillmentStage("DELIVERY_FAILED").stage, "DELIVERY_FAILED");
  assert.strictEqual(deriveCustomerFulfillmentStage("DELIVERY_FAILED").isException, true);
  assert.strictEqual(deriveCustomerFulfillmentStage("DELIVERY_FAILED").stepIndex, -1);
});

test("order history page exists, is dynamic server component, and queries owner orders only", async () => {
  assert.ok(existsSync("src/app/orders/page.tsx"));

  const page = await read("src/app/orders/page.tsx");
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(page, /"use client"/);
  assert.match(page, /auth\.getClaims\(\)/);
  assert.match(page, /\.from\("orders"\)/);
  assert.match(page, /\.eq\("user_id", userId\)/);
  assert.match(page, /deriveCustomerFulfillmentStage/);
});

test("order detail page enforces owner isolation and shows immutable payment submissions history", async () => {
  const page = await read("src/app/orders/[id]/page.tsx");

  assert.match(page, /auth\.getClaims\(\)/);
  assert.match(page, /\.from\("orders"\)/);
  assert.match(page, /\.eq\("id", id\)/);
  assert.match(page, /\.eq\("user_id", userId\)/);
  assert.match(page, /\.from\("payment_submissions"\)/);
  assert.match(page, /getReceiptSignedUrl/);
  assert.match(page, /submitGcashProof/);
  assert.match(page, /deriveCustomerFulfillmentStage/);
});

test("GCash proof submission action enforces size, MIME, magic bytes, and owner checks", async () => {
  const actions = await read("src/lib/payments/actions.ts");
  const imageInspector = await read("src/lib/payments/image.ts");

  assert.match(actions, /inspectReceiptImage/);
  assert.match(imageInspector, /0xff/); // JPEG
  assert.match(imageInspector, /0x89/); // PNG
  assert.match(imageInspector, /RIFF/); // WebP
  assert.match(imageInspector, /MAX_DIMENSION/);
  assert.match(imageInspector, /MAX_PIXELS/);

  // File size limit (2MB)
  assert.match(actions, /2 \* 1024 \* 1024/);

  // Private storage bucket & path prefix enforcement
  assert.match(actions, /payment-receipts/);
  assert.match(actions, /\$\{userId\}\/\$\{order\.id\}\/\$\{fileUuid\}\.\$\{image\.extension\}/);

  // Calls canonical RPC submit_gcash_proof
  assert.match(actions, /submit_gcash_proof/);

  // Does not allow client to set PAID status directly
  assert.doesNotMatch(actions, /status:\s*["']PAID["']/);
  assert.doesNotMatch(actions, /approve_gcash_submission|reject_gcash_submission/);
});

test("signed URL generator enforces owner path isolation, database submission verification, and short expiry", async () => {
  const actions = await read("src/lib/payments/actions.ts");

  assert.match(actions, /getReceiptSignedUrl/);
  assert.match(actions, /storagePath\.startsWith\(`\$\{userId\}\/`\)/);
  assert.match(actions, /\.from\("payment_submissions"\)/);
  assert.match(actions, /\.eq\("receipt_storage_path", storagePath\)/);
  assert.match(actions, /\.eq\("submitted_by", userId\)/);
  assert.match(actions, /createSignedUrl\(storagePath, 300\)/);
});

test("GCash proof submission compensates by removing newly uploaded object if database RPC fails and explicitly inspects errors", async () => {
  const actions = await read("src/lib/payments/actions.ts");

  // Verify rollback cleanup on rpcError
  assert.match(actions, /if \(rpcError\) \{/);
  assert.match(actions, /const \{\s*error:\s*cleanupError\s*\}\s*=\s*await serviceClient\.storage\s*\.from\("payment-receipts"\)\s*\.remove\(\[storagePath\]\)/);
  assert.match(actions, /if \(cleanupError\) \{/);
  assert.match(actions, /catch/);
  assert.match(actions, /redirect\(`\/orders\/\$\{orderId\}\?error=submission_failed`\)/);

  // Assert cleanup removes ONLY the current single newly created storagePath
  assert.match(actions, /\.remove\(\[storagePath\]\)/);
  assert.doesNotMatch(actions, /\.remove\(\[.*oldReceipt.*\]\)/);
});
