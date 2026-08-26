import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { getOrCreateCart, removeCartItem, updateCartItemQuantity } from "@/lib/cart/actions";
import { BagIcon, ShieldCheckIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getOrCreateCart();

  if (!cart) {
    return (
      <main className="catalog-main">
        <div className="catalog-container">
          <div className="auth-card" style={{ textAlign: "center" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "1rem", color: "var(--ink-muted)" }}>
              <BagIcon size={36} />
            </div>
            <p className="eyebrow" style={{ justifyContent: "center" }}>Shopping Bag</p>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Sign in to view your bag</h2>
            <p style={{ color: "var(--ink-secondary)", margin: "0 0 1.5rem", fontSize: "14px" }}>
              Sign in with your account or Google to manage your streetwear pieces and proceed to checkout.
            </p>
            <Link href="/login?next=/cart" className="btn btn-primary" style={{ gap: "0.5rem" }}>
              <span>Sign In</span>
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header style={{ marginBottom: "1.75rem" }}>
          <p className="eyebrow">Shopping Bag</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
            Your Bag ({cart.item_count} {cart.item_count === 1 ? "piece" : "pieces"})
          </h1>
        </header>

        {cart.items.length === 0 ? (
          <div className="card-surface" style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "1rem", color: "var(--ink-muted)" }}>
              <BagIcon size={40} />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Your bag is empty</h2>
            <p style={{ color: "var(--ink-secondary)", margin: "0 0 1.5rem", fontSize: "14px" }}>
              Explore the latest 1968 Clothing archival collection drops.
            </p>
            <Link href="/products" className="btn btn-primary" style={{ gap: "0.5rem" }}>
              <span>Explore Collection</span>
              <ArrowRightIcon size={14} />
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "start" }}>
            {/* Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {cart.items.map((item) => (
                <article key={item.id} className="card-surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                      <Link href={`/products/${item.product_slug}`}>
                        {item.product_name}
                      </Link>
                    </h2>
                    {item.variant_name && (
                      <p style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", margin: "0 0 0.25rem" }}>
                        SIZE: {item.variant_name}
                      </p>
                    )}
                    <p style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--ink-muted)", margin: "0 0 0.5rem" }}>
                      SKU: {item.sku}
                    </p>
                    <p style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)", margin: 0 }}>
                      {formatMinorUnitsToPHP(item.price_minor)} each
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                    <form action={updateCartItemQuantity} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input
                        id={`qty-${item.id}`}
                        type="number"
                        name="quantity"
                        min="1"
                        max="99"
                        defaultValue={item.quantity}
                        style={{ width: "55px", padding: "0.35rem", minHeight: "36px", textAlign: "center" }}
                      />
                      <button type="submit" className="btn btn-secondary small-btn" style={{ minHeight: "36px", padding: "0.3rem 0.6rem" }}>
                        Update
                      </button>
                    </form>

                    <span style={{ fontSize: "1.1rem", fontWeight: 800, fontFamily: "var(--font-mono)", minWidth: "80px", textAlign: "right" }}>
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>

                    <form action={removeCartItem}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <button type="submit" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1.4rem", padding: "0.4rem" }} title="Remove item">
                        &times;
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>

            {/* Summary Sidebar */}
            <aside className="card-surface" style={{ padding: "1.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                Order Summary
              </h2>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "0.75rem" }}>
                <span style={{ color: "var(--ink-secondary)" }}>Subtotal ({cart.item_count} pieces)</span>
                <strong style={{ fontFamily: "var(--font-mono)" }}>{formatMinorUnitsToPHP(cart.subtotal_minor)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--ink-muted)", marginBottom: "1.25rem" }}>
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem" }}>
                  <span>Total Amount</span>
                  <strong style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{formatMinorUnitsToPHP(cart.subtotal_minor)}</strong>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", gap: "0.4rem" }}>
                  <span>Proceed to Checkout</span>
                  <ArrowRightIcon size={14} />
                </Link>
                <Link href="/products" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Continue Shopping
                </Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.25rem", color: "var(--ink-muted)", fontSize: "12px", justifyContent: "center" }}>
                <ShieldCheckIcon size={14} />
                <span>Encrypted checkout &amp; GCash protection</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
