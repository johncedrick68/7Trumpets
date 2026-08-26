import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerAddresses } from "@/lib/addresses/actions";
import { getOrCreateCart } from "@/lib/cart/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { processCheckout } from "@/lib/checkout/actions";

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

  // Generate a stable cryptographically random idempotency key for this rendered checkout instance
  const checkoutIdempotencyKey = `checkout_${cart.id}_${randomUUID().replace(/-/g, "")}`;

  // Estimated authoritative shipping fee: ₱150.00 (15000 minor units)
  const shippingMinor = 15000;
  const grandTotalMinor = cart.subtotal_minor + shippingMinor;

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">Checkout</p>
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

        <form action={processCheckout} className="checkout-layout">
          <input type="hidden" name="idempotency_key" value={checkoutIdempotencyKey} />
          <div className="checkout-main-column">
            <section className="checkout-section" aria-labelledby="shipping-addr-title">
              <h2 id="shipping-addr-title">1. Shipping Address</h2>
              <div className="checkout-address-list">
                {addresses.map((addr, idx) => (
                  <label key={addr.id} className="checkout-address-option">
                    <input
                      type="radio"
                      name="address_id"
                      value={addr.id}
                      defaultChecked={addr.is_default || idx === 0}
                      required
                    />
                    <div className="address-option-details">
                      <strong>{addr.recipient_name}</strong> ({addr.phone})
                      <p>
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
                <Link href="/account/addresses" className="button-link secondary small-btn">
                  + Add New Address
                </Link>
              </div>
            </section>

            <section className="checkout-section" aria-labelledby="payment-method-title">
              <h2 id="payment-method-title">2. Payment Method</h2>
              <div className="payment-options-list">
                <label className="payment-option-card">
                  <input
                    type="radio"
                    name="payment_method"
                    value="MANUAL_GCASH"
                    defaultChecked
                    required
                  />
                  <div className="payment-option-info">
                    <strong>Manual GCash</strong>
                    <p>
                      Transfer payment to our official GCash account and keep your reference number / receipt proof for verification.
                    </p>
                  </div>
                </label>

                <label className="payment-option-card">
                  <input
                    type="radio"
                    name="payment_method"
                    value="COD"
                    required
                  />
                  <div className="payment-option-info">
                    <strong>Cash on Delivery (COD)</strong>
                    <p>Pay in cash upon doorstep delivery to the courier.</p>
                  </div>
                </label>
              </div>
            </section>

            <section className="checkout-section" aria-labelledby="notes-title">
              <h2 id="notes-title">3. Order Notes (Optional)</h2>
              <label htmlFor="customer_note" className="sr-only">Special Delivery Instructions</label>
              <textarea
                id="customer_note"
                name="customer_note"
                rows={3}
                placeholder="Special delivery instructions, landmarks, or preferred schedule..."
                maxLength={500}
                className="checkout-notes-input"
              />
            </section>
          </div>

          <aside className="checkout-summary-column">
            <div className="cart-summary-card">
              <h2>Order Summary</h2>
              
              <div className="checkout-items-preview">
                {cart.items.map((item) => (
                  <div key={item.id} className="preview-line">
                    <span className="preview-title">
                      {item.product_name} ({item.quantity}x)
                    </span>
                    <span className="preview-price">
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>
                  </div>
                ))}
              </div>

              <hr style={{ margin: "1rem 0", borderColor: "var(--line)" }} />

              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatMinorUnitsToPHP(cart.subtotal_minor)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping (Standard)</span>
                <span>{formatMinorUnitsToPHP(shippingMinor)}</span>
              </div>
              <div className="summary-row total-row">
                <span>Total Amount</span>
                <span className="summary-amount">
                  {formatMinorUnitsToPHP(grandTotalMinor)}
                </span>
              </div>

              <button type="submit" className="button-link checkout-btn">
                Place Order
              </button>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
