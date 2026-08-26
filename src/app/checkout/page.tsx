import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerAddresses } from "@/lib/addresses/actions";
import { getOrCreateCart } from "@/lib/cart/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { processCheckout } from "@/lib/checkout/actions";
import { ShieldCheckIcon, TruckIcon, CheckIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [cart, addresses, params] = await Promise.all([
    getOrCreateCart(),
    getCustomerAddresses(),
    searchParams,
  ]);

  if (!cart || cart.items.length === 0) {
    redirect("/cart");
  }

  if (addresses.length === 0) {
    redirect("/account/addresses?error=address_required_for_checkout");
  }

  // Stable cryptographically random idempotency key
  const checkoutIdempotencyKey = `checkout_${cart.id}_${randomUUID().replace(/-/g, "")}`;

  // Authoritative shipping fee: ₱150.00
  const shippingMinor = 15000;
  const grandTotalMinor = cart.subtotal_minor + shippingMinor;

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="admin-page-header">
          <p className="eyebrow">Secure Checkout</p>
          <h1>Complete Your Order</h1>
        </header>

        {params.error === "missing_fields" && (
          <p className="error" role="alert">Please select an address and payment method.</p>
        )}
        {params.error === "invalid_payment_method" && (
          <p className="error" role="alert">Selected payment method is invalid.</p>
        )}
        {params.error === "invalid_idempotency_key" && (
          <p className="error" role="alert">Invalid checkout session token. Please reload the page.</p>
        )}
        {params.error === "checkout_failed" && (
          <p className="error" role="alert">
            Checkout could not be completed. Item stock may have changed. Please review your cart.
          </p>
        )}

        <form action={processCheckout} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "start" }}>
          <input type="hidden" name="idempotency_key" value={checkoutIdempotencyKey} />

          {/* Left Column: Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* 1. Shipping Address */}
            <section style={{ width: "100%", maxWidth: "none", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <TruckIcon size={20} style={{ color: "var(--accent-soft)" }} />
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>1. Shipping Address</h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {addresses.map((addr, idx) => (
                  <label key={addr.id} style={{ display: "flex", gap: "0.75rem", padding: "1rem", background: "var(--paper-bright)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="address_id"
                      value={addr.id}
                      defaultChecked={addr.is_default || idx === 0}
                      required
                      style={{ marginTop: "0.25rem", width: "auto" }}
                    />
                    <div>
                      <strong>{addr.recipient_name}</strong> ({addr.phone})
                      <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                        {addr.address_line1}
                        {addr.address_line2 && <>, {addr.address_line2}</>}
                        {addr.barangay && <>, Brgy. {addr.barangay}</>}
                        <br />
                        {addr.city_municipality}, {addr.province} {addr.postal_code}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: "1rem" }}>
                <Link href="/account/addresses" className="btn btn-secondary small-btn">
                  + Manage Addresses
                </Link>
              </div>
            </section>

            {/* 2. Payment Method */}
            <section style={{ width: "100%", maxWidth: "none", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <ShieldCheckIcon size={20} style={{ color: "var(--accent-soft)" }} />
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>2. Payment Method</h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label style={{ display: "flex", gap: "0.75rem", padding: "1rem", background: "var(--paper-bright)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="MANUAL_GCASH"
                    defaultChecked
                    required
                    style={{ marginTop: "0.25rem", width: "auto" }}
                  />
                  <div>
                    <strong style={{ color: "#38bdf8" }}>Manual GCash Transfer</strong>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                      Scan QR or send to GCash number upon checkout. Fast approval within 30 minutes.
                    </p>
                  </div>
                </label>

                <label style={{ display: "flex", gap: "0.75rem", padding: "1rem", background: "var(--paper-bright)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="CASH_ON_DELIVERY"
                    required
                    style={{ marginTop: "0.25rem", width: "auto" }}
                  />
                  <div>
                    <strong>Cash on Delivery (COD)</strong>
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                      Pay cash directly to the courier upon doorstep delivery.
                    </p>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* Right Column: Order Review */}
          <aside style={{ padding: "1.5rem", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem" }}>Order Summary</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", borderBottom: "1px solid var(--line)", paddingBottom: "1rem", marginBottom: "1rem" }}>
              {cart.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span>{item.product_name} &times; {item.quantity}</span>
                  <span style={{ fontWeight: 600 }}>{formatMinorUnitsToPHP(item.line_total_minor)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--muted)" }}>Subtotal</span>
              <strong>{formatMinorUnitsToPHP(cart.subtotal_minor)}</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", marginBottom: "1rem" }}>
              <span style={{ color: "var(--muted)" }}>Standard Shipping</span>
              <span>{formatMinorUnitsToPHP(shippingMinor)}</span>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.25rem" }}>
                <span>Grand Total</span>
                <strong style={{ color: "var(--ink)" }}>{formatMinorUnitsToPHP(grandTotalMinor)}</strong>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", gap: "0.4rem", padding: "0.9rem" }}>
              <span>Place Order Now</span>
              <ArrowRightIcon size={18} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem", color: "var(--muted)", fontSize: "0.8rem", justifyContent: "center" }}>
              <CheckIcon size={16} style={{ color: "#34d399" }} />
              <span>Safe &amp; Encrypted Checkout</span>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
