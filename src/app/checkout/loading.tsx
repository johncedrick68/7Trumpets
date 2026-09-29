import "./checkout.css";

export default function CheckoutLoading() {
  return <main id="main-content" tabIndex={-1} className="checkout-page" aria-busy="true" aria-label="Loading checkout"><h1>Checkout</h1>
    <p role="status" className="sr-only">Loading checkout details.</p><div className="checkout-grid" aria-hidden="true">
      <div>{["Account", "Delivery address", "Fulfillment", "Payment"].map(label => <section className="checkout-section" key={label}><h2>{label}</h2><div className="checkout-skeleton" /></section>)}</div>
      <div className="checkout-summary"><h2>Order summary</h2><div className="checkout-skeleton" /><div className="checkout-skeleton" /><div className="checkout-skeleton" /></div>
    </div>
  </main>;
}
