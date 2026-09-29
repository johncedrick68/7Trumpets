import Link from "next/link";
import "./checkout.css";

export function CheckoutUnavailable({ message = "We couldn't load the current delivery and payment options. Please try again." }: { message?: string }) {
  return <main id="main-content" tabIndex={-1} className="checkout-page"><h1>Checkout</h1>
    <section className="checkout-unavailable" role="alert"><h2>Checkout is temporarily unavailable.</h2><p>{message}</p>
      <Link href="/checkout" className="checkout-submit">Try Again</Link><Link href="/cart" className="checkout-link">Back to Cart</Link>
    </section>
  </main>;
}
