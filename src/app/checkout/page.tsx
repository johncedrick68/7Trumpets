import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getCustomerAddresses } from "@/lib/addresses/actions";
import { getOrCreateCart } from "@/lib/cart/actions";
import { processCheckout } from "@/lib/checkout/actions";
import { getStoreSetting } from "@/lib/settings/queries";
import { CheckoutFormClient } from "./checkout-form-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [cart, addresses, params, fulfillmentSettings, paymentSettings] = await Promise.all([
    getOrCreateCart(),
    getCustomerAddresses(),
    searchParams,
    getStoreSetting<{ shipping_fee_minor: number; free_shipping_threshold_minor?: number; allow_store_pickup: boolean; pickup_address?: string }>(
      "fulfillment",
      { shipping_fee_minor: 15000, free_shipping_threshold_minor: 350000, allow_store_pickup: true }
    ),
    getStoreSetting<{ gcash_number: string; gcash_account_name: string; gcash_qr_path?: string }>(
      "payment",
      { gcash_number: "0917 196 8000", gcash_account_name: "1968 CLOTHING PH", gcash_qr_path: "/images/gcash-merchant-qr.svg" }
    ),
  ]);

  if (!cart || cart.items.length === 0) {
    redirect("/cart");
  }

  if (addresses.length === 0) {
    redirect("/account/addresses?error=address_required_for_checkout");
  }

  // Stable cryptographically random idempotency key
  const checkoutIdempotencyKey = `checkout_${cart.id}_${randomUUID().replace(/-/g, "")}`;

  return (
    <main className="transaction-container page-section min-h-screen">
      <header className="mb-8 md:mb-12">
        <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Secure Checkout
        </p>
        <h1 className="text-h1 text-foreground">
          Complete Your Order
        </h1>
        <p className="text-muted-foreground mt-2">
          Choose delivery or flagship pickup, select your profile, and reserve your streetwear archival items.
        </p>
      </header>

      {/* Error banners */}
      {params.error === "missing_fields" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">
          Please select a delivery address or authorized pickup profile.
        </div>
      )}
      {params.error === "invalid_payment_method" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">
          Payment method is invalid. Please reload the page.
        </div>
      )}
      {params.error === "invalid_fulfillment_method" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">
          Fulfillment method is invalid. Please reload the page.
        </div>
      )}
      {params.error === "invalid_idempotency_key" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">
          Session expired. Please reload the page and try again.
        </div>
      )}
      {params.error === "checkout_throttled" && (
        <div className="mb-6 p-4 text-sm text-amber-800 bg-amber-50 rounded-md border border-amber-200" role="alert">
          Too many checkout attempts. Please pause for a moment before retrying.
        </div>
      )}
      {params.error === "checkout_failed" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">
          Order could not be placed. Item availability may have changed. Please review your bag.
        </div>
      )}

      <form action={processCheckout}>
        {/* Hidden cryptographically random idempotency key */}
        <input type="hidden" name="idempotency_key" value={checkoutIdempotencyKey} />

        <CheckoutFormClient
          cart={cart}
          addresses={addresses}
          fulfillmentSettings={fulfillmentSettings}
          paymentSettings={paymentSettings}
        />
      </form>
    </main>
  );
}
