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
            <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "1rem", color: "var(--accent-soft)" }}>
              <BagIcon size={36} />
            </div>
            <span className="eyebrow">Shopping Bag</span>
            <h2>Sign in to view your bag</h2>
            <p style={{ color: "var(--muted)", margin: "0.5rem 0 1.5rem" }}>
              Sign in with your account or Google to manage your streetwear pieces and proceed to checkout.
            </p>
            <Link href="/login?next=/cart" className="btn btn-primary" style={{ gap: "0.5rem" }}>
              <span>Sign In</span>
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="admin-page-header">
          <p className="eyebrow">Your Bag</p>
          <h1>Shopping Bag ({cart.item_count})</h1>
        </header>

        {cart.items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1.5rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "1rem", color: "var(--muted)" }}>
              <BagIcon size={44} />
            </div>
            <h2>Your bag is empty</h2>
            <p style={{ color: "var(--muted)", margin: "0.5rem 0 1.5rem" }}>
              Explore the latest 1968 Clothing collection drops.
            </p>
            <Link href="/products" className="btn btn-primary" style={{ gap: "0.5rem" }}>
              <span>Explore Collection</span>
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", alignItems: "start" }}>
            {/* Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {cart.items.map((item) => (
                <article key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                      <Link href={`/products/${item.product_slug}`}>
                        {item.product_name}
                      </Link>
                    </h2>
                    {item.variant_name && (
                      <p style={{ fontSize: "0.85rem", color: "var(--accent-soft)", margin: "0 0 0.25rem" }}>{item.variant_name}</p>
                    )}
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>SKU: {item.sku}</p>
                    <p style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
                      {formatMinorUnitsToPHP(item.price_minor)} each
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                    <form action={updateCartItemQuantity} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input
                        id={`qty-${item.id}`}
                        type="number"
                        name="quantity"
                        min="1"
                        max="99"
                        defaultValue={item.quantity}
                        style={{ width: "60px", padding: "0.4rem", minHeight: "36px", textAlign: "center" }}
                      />
                      <button type="submit" className="btn btn-secondary small-btn" style={{ minHeight: "36px", padding: "0.3rem 0.6rem" }}>
                        Update
                      </button>
                    </form>

                    <span style={{ fontSize: "1.1rem", fontWeight: 800, minWidth: "90px", textAlign: "right" }}>
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>

                    <form action={removeCartItem}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <button type="submit" style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1.4rem", padding: "0.5rem" }} title="Remove item">
                        &times;
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>

            {/* Summary Sidebar */}
            <aside style={{ padding: "1.5rem", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 1rem" }}>Order Summary</h2>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.75rem" }}>
                <span style={{ color: "var(--muted)" }}>Subtotal ({cart.item_count} pieces)</span>
                <strong>{formatMinorUnitsToPHP(cart.subtotal_minor)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.2rem" }}>
                  <span>Total</span>
                  <strong style={{ color: "var(--ink)" }}>{formatMinorUnitsToPHP(cart.subtotal_minor)}</strong>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link href="/checkout" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", gap: "0.4rem" }}>
                  <span>Proceed to Checkout</span>
                  <ArrowRightIcon size={16} />
                </Link>
                <Link href="/products" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Continue Shopping
                </Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.25rem", color: "var(--muted)", fontSize: "0.8rem", justifyContent: "center" }}>
                <ShieldCheckIcon size={16} />
                <span>Encrypted checkout &amp; GCash protection</span>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
