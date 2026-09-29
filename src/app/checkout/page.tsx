import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCustomerAddresses } from "@/lib/addresses/actions";
import { getOrCreateCart } from "@/lib/cart/actions";
import { processCheckout } from "@/lib/checkout/actions";
import { loadCheckoutSettings } from "@/lib/checkout/settings";
import { calculateShippingMinor } from "@/lib/checkout/shipping";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { CheckoutFormClient, type CheckoutQuote } from "./checkout-form-client";
import { CheckoutUnavailable } from "./checkout-unavailable";
import "./checkout.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

const errorMessages: Record<string, string> = {
  configuration_unavailable: "We couldn't load the current delivery and payment options. Please try again.",
  cod_limit_exceeded: "Cash on Delivery is unavailable for this order total. Select another available payment method.",
  missing_fields: "Select a saved address and payment method.",
  invalid_address: "This address could not be verified. Select a saved address or manage your addresses.",
  invalid_payment_method: "This payment method is unavailable. Select another available option.",
  invalid_fulfillment_method: "Select an available fulfillment option.",
  invalid_idempotency_key: "Your checkout session expired. Reload checkout and try again.",
  checkout_throttled: "Too many checkout attempts. Please wait a moment before retrying.",
  checkout_failed: "Your order could not be placed. An item's price or availability may have changed. Review your cart and try again.",
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    redirect("/login?next=/checkout");
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || userData.user.id !== userId) redirect("/login?next=/checkout");
  const settings = await loadCheckoutSettings().catch(() => null);
  if (!settings) return <CheckoutUnavailable />;
  // Query failures must never become empty carts or empty address books.
  const data = await Promise.all([getOrCreateCart(), getCustomerAddresses(), searchParams]).catch(() => null);
  if (!data) return <CheckoutUnavailable message="We couldn't load your cart or saved addresses. Please try again." />;
  const [cart, addresses, params] = data;
  if (!cart) return <CheckoutUnavailable message="We couldn't load your cart. Please try again." />;
  if (cart.items.length === 0) redirect("/cart");

  // Display quotes are server-resolved. Submission independently rereads settings
  // and locks canonical prices/inventory through the existing checkout RPC.
  const methods: CheckoutQuote["method"][] = settings.fulfillment.allow_store_pickup ? ["SHIPMENT", "STORE_PICKUP"] : ["SHIPMENT"];
  const quotes: CheckoutQuote[] = methods.map(method => {
    const shippingMinor = calculateShippingMinor(cart.subtotal_minor, method, settings.fulfillment);
    const totalMinor = cart.subtotal_minor + shippingMinor;
    const overLimit = totalMinor > settings.payment.cod_max_minor;
    const payments: CheckoutQuote["payments"] = [];
    if (method === "STORE_PICKUP") payments.push({ value: "CASH", label: "Cash on pickup", description: "Pay when collecting your order.", disabled: false });
    else if (settings.payment.cod_enabled) payments.push({ value: "COD", label: "Cash on Delivery", description: overLimit ? `Unavailable for orders above ${formatMinorUnitsToPHP(settings.payment.cod_max_minor)}.` : "Pay when your order is delivered.", disabled: overLimit });
    if (settings.payment.gcash_enabled) payments.push({ value: "MANUAL_GCASH", label: "GCash", description: "Manual verification after order placement.", disabled: false });
    return { method, shippingMinor, totalMinor, payments };
  });
  const checkoutIdempotencyKey = `checkout_${cart.id}_${randomUUID().replace(/-/g, "")}`;
  const fullName = userData.user.user_metadata?.full_name;
  const errorTarget = params.error === "invalid_address" || params.error === "missing_fields" ? "#checkout-address"
    : params.error === "invalid_payment_method" || params.error === "cod_limit_exceeded" ? "#checkout-payment"
    : params.error === "invalid_fulfillment_method" ? "#checkout-fulfillment" : "/cart";
  return <main id="main-content" tabIndex={-1} className="checkout-page">
    <h1>Checkout</h1>
    <CheckoutFormClient cart={cart} addresses={addresses} quotes={quotes} email={userData.user.email ?? ""} name={typeof fullName === "string" ? fullName : undefined}
      pickupAddress={settings.fulfillment.pickup_address} error={params.error ? errorMessages[params.error] ?? "Checkout could not be completed. Review your selections and try again." : undefined} errorTarget={errorTarget} action={processCheckout}>
      <input type="hidden" name="idempotency_key" value={checkoutIdempotencyKey} />
    </CheckoutFormClient>
    <Link href="/cart" className="checkout-link checkout-return">Back to Cart</Link>
  </main>;
}
