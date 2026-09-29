"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP } from "@/lib/money";
import type { Address } from "@/lib/addresses/actions";
import type { CartDetail } from "@/lib/cart/actions";
import "./checkout.css";

export type CheckoutQuote = {
  method: "SHIPMENT" | "STORE_PICKUP";
  shippingMinor: number;
  totalMinor: number;
  payments: Array<{ value: "COD" | "CASH" | "MANUAL_GCASH"; label: string; description: string; disabled: boolean }>;
};

function PlaceOrder({ disabled, submitted }: { disabled: boolean; submitted: React.RefObject<boolean> }) {
  const { pending } = useFormStatus();
  useEffect(() => { if (!pending) submitted.current = false; }, [pending, submitted]);
  return <><button className="checkout-submit" type="submit" disabled={disabled || pending} aria-disabled={disabled || pending}>
    {pending ? "PLACING ORDER…" : "PLACE ORDER"}
  </button><p className="checkout-muted" role="status" aria-live="polite">{pending ? "Placing your order. Please wait." : ""}</p></>;
}

export function CheckoutFormClient({ cart, addresses, quotes, email, name, pickupAddress, error, errorTarget = "/cart", action, children }: {
  cart: CartDetail;
  addresses: Address[];
  quotes: CheckoutQuote[];
  email: string;
  name?: string;
  pickupAddress?: string;
  error?: string;
  errorTarget?: string;
  action: (form: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const [method, setMethod] = useState<CheckoutQuote["method"]>("SHIPMENT");
  const quote = quotes.find(q => q.method === method)!;
  const [payment, setPayment] = useState(quote.payments.find(p => !p.disabled)?.value ?? "");
  const [address, setAddress] = useState(addresses.find(a => a.is_default)?.id ?? addresses[0]?.id ?? "");
  const errorRef = useRef<HTMLDivElement>(null);
  const submitted = useRef(false);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const unavailable = cart.items.some(item => item.is_available === false);
  const validPayment = quote.payments.some(p => p.value === payment && !p.disabled);

  return <form action={action} className="checkout-grid" onSubmit={event => {
    if (submitted.current || !validPayment || !address || unavailable) { event.preventDefault(); return; }
    submitted.current = true;
  }}>
    {children}
    <div className="checkout-task">
      {error && <div ref={errorRef} tabIndex={-1} role="alert" className="checkout-error"><p>{error}</p><a href={errorTarget}>{errorTarget === "/cart" ? "Review Cart" : "Review selection"}</a></div>}
      <section className="checkout-section" aria-labelledby="checkout-account">
        <h2 id="checkout-account">Account</h2>
        {name && <p>{name}</p>}<p className="checkout-wrap">{email}</p>
      </section>
      <fieldset id="checkout-address" tabIndex={-1} className="checkout-section">
        <legend>Delivery address</legend>
        <p className="checkout-muted">{method === "STORE_PICKUP" ? "Select the saved recipient and contact details for collection." : "Select a saved delivery address."}</p>
        {addresses.length === 0 ? <p role="status">Add a saved address before placing your order.</p> : addresses.map(a => <label className="checkout-choice" key={a.id}>
          <input type="radio" name="address_id" value={a.id} required checked={address === a.id} onChange={() => setAddress(a.id)} />
          <span className="checkout-wrap"><strong>{a.recipient_name}</strong>{a.is_default && <span className="checkout-default">Default</span>}
            <span>{a.address_line1}{a.address_line2 && `, ${a.address_line2}`}</span>
            {a.barangay && <span>{a.barangay}</span>}<span>{a.city_municipality}, {a.province} {a.postal_code}</span><span>{a.phone}</span>
          </span>
        </label>)}
        <Link href="/account/addresses" className="checkout-link">Manage saved addresses</Link>
      </fieldset>
      <fieldset id="checkout-fulfillment" tabIndex={-1} className="checkout-section">
        <legend>Fulfillment</legend>
        {quotes.map(q => <label className="checkout-choice" key={q.method}>
          <input type="radio" name="fulfillment_method" value={q.method} checked={method === q.method} onChange={() => {
            setMethod(q.method);
            setPayment(q.payments.find(p => p.value === payment && !p.disabled)?.value ?? q.payments.find(p => !p.disabled)?.value ?? "");
          }} />
          <span><strong>{q.method === "SHIPMENT" ? "Delivery" : "Store pickup"}</strong>
            <span className="checkout-muted">{q.method === "SHIPMENT" ? "Delivered to your selected address." : pickupAddress}</span>
          </span>
        </label>)}
      </fieldset>
      <fieldset id="checkout-payment" tabIndex={-1} className="checkout-section">
        <legend>Payment</legend>
        {quote.payments.map(p => <label className="checkout-choice" key={p.value}>
          <input type="radio" name="payment_method" value={p.value} required checked={payment === p.value} disabled={p.disabled} aria-describedby={`payment-${p.value}`} onChange={() => setPayment(p.value)} />
          <span><strong>{p.label}</strong><span id={`payment-${p.value}`} className="checkout-muted">{p.description}</span></span>
        </label>)}
        {!validPayment && <p role="alert">No payment method is available for this order. Please review your cart or try again later.</p>}
        {payment === "MANUAL_GCASH" && <p className="checkout-muted">After placing your order, follow the payment instructions and upload your proof on the order page within the two-hour reservation window. Payment is manually verified.</p>}
      </fieldset>
    </div>
    <aside className="checkout-summary" aria-labelledby="checkout-summary">
      <h2 id="checkout-summary">Order summary</h2>
      <ul className="checkout-items">{cart.items.map(item => <li key={item.id}>
        {item.image_path && <Image src={item.image_path} alt="" width={72} height={90} className="checkout-image" />}
        <div className="checkout-wrap"><strong>{item.product_name}</strong><p className="checkout-muted">{item.variant_name} · Qty {item.quantity}</p>
          {item.is_available === false && <p>Currently unavailable</p>}
        </div><span className="checkout-line-price">{formatMinorUnitsToPHP(item.line_total_minor)}</span>
      </li>)}</ul>
      <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{formatMinorUnitsToPHP(cart.subtotal_minor)}</dd></div>
        <div><dt>Shipping{method === "STORE_PICKUP" && " · Pickup"}</dt><dd>{formatMinorUnitsToPHP(quote.shippingMinor)}</dd></div>
        <div className="checkout-total"><dt>Total</dt><dd>{formatMinorUnitsToPHP(quote.totalMinor)}</dd></div>
      </dl>
      {unavailable && <p role="alert" className="checkout-error">An item in your bag is no longer available. <Link href="/cart">Review Cart</Link></p>}
      <PlaceOrder disabled={!address || !validPayment || unavailable} submitted={submitted} />
      <p className="checkout-muted">{payment === "MANUAL_GCASH" ? "Your order is confirmed before payment verification." : payment === "CASH" ? "Pay when collecting your order." : "Pay when your order is delivered."}</p>
    </aside>
  </form>;
}
