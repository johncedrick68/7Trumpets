import Link from "next/link";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { getOrCreateCart, removeCartItem, updateCartItemQuantity } from "@/lib/cart/actions";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getOrCreateCart();

  if (!cart) {
    return (
      <main className="catalog-main">
        <div className="catalog-container">
          <section className="catalog-empty">
            <h2>Sign in to view your cart</h2>
            <p>You need to be logged in to manage your cart and save items.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <Link href="/login?next=/cart" className="button-link">
                Sign In
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">Shopping Bag</p>
          <h1>Your Cart ({cart.item_count})</h1>
        </header>

        {cart.items.length === 0 ? (
          <section className="catalog-empty">
            <h2>Your cart is empty</h2>
            <p>Looks like you haven&apos;t added any devotional garments or items yet.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <Link href="/products" className="button-link">
                Explore Products
              </Link>
            </div>
          </section>
        ) : (
          <div className="cart-layout">
            <div className="cart-items-list">
              {cart.items.map((item) => (
                <article key={item.id} className="cart-item-card">
                  <div className="cart-item-details">
                    <h2 className="cart-item-title">
                      <Link href={`/products/${item.product_slug}`}>
                        {item.product_name}
                      </Link>
                    </h2>
                    {item.variant_name && (
                      <p className="cart-item-variant">{item.variant_name}</p>
                    )}
                    <p className="cart-item-sku">SKU: {item.sku}</p>
                    <p className="cart-item-unit-price">
                      {formatMinorUnitsToPHP(item.price_minor)} each
                    </p>
                  </div>

                  <div className="cart-item-actions">
                    <form action={updateCartItemQuantity} className="cart-qty-form">
                      <input type="hidden" name="item_id" value={item.id} />
                      <label htmlFor={`qty-${item.id}`} className="sr-only">
                        Quantity
                      </label>
                      <input
                        id={`qty-${item.id}`}
                        type="number"
                        name="quantity"
                        min="1"
                        max="99"
                        defaultValue={item.quantity}
                        className="cart-qty-input"
                      />
                      <button type="submit" className="qty-update-btn">
                        Update
                      </button>
                    </form>

                    <form action={removeCartItem} className="cart-remove-form">
                      <input type="hidden" name="item_id" value={item.id} />
                      <button type="submit" className="remove-item-btn">
                        Remove
                      </button>
                    </form>
                  </div>

                  <div className="cart-item-total">
                    <span className="cart-line-total">
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <aside className="cart-summary-card">
              <h2>Order Summary</h2>
              <div className="summary-row">
                <span>Subtotal ({cart.item_count} items)</span>
                <span className="summary-amount">
                  {formatMinorUnitsToPHP(cart.subtotal_minor)}
                </span>
              </div>
              <p className="summary-note">
                Shipping and taxes calculated during checkout.
              </p>
              <div className="cart-checkout-actions">
                <Link href="/checkout" className="button-link" style={{ textAlign: "center" }}>
                  Proceed to Checkout
                </Link>
                <Link href="/products" className="button-link secondary" style={{ textAlign: "center" }}>
                  Continue Shopping
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
