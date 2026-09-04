import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerAddresses } from "@/lib/addresses/actions";
import { getOrCreateCart } from "@/lib/cart/actions";
import { formatMinorUnitsToPHP } from "@/lib/catalog/queries";
import { processCheckout } from "@/lib/checkout/actions";
import { ShieldCheckIcon, TruckIcon, ArrowRightIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-7xl mx-auto">
      <header className="mb-8 md:mb-12">
        <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase mb-2">
          Secure Checkout
        </p>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Complete Your Order
        </h1>
        <p className="text-muted-foreground mt-2">
          Review your items, select a delivery address, and confirm your order.
        </p>
      </header>

      {/* Error banners */}
      {params.error === "missing_fields" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">Please select a delivery address.</div>
      )}
      {params.error === "invalid_payment_method" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">Payment method is invalid. Please reload the page.</div>
      )}
      {params.error === "invalid_idempotency_key" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">Session expired. Please reload the page and try again.</div>
      )}
      {params.error === "checkout_failed" && (
        <div className="mb-6 p-4 text-sm text-red-800 bg-red-50 rounded-md border border-red-200" role="alert">
          Order could not be placed. Item availability may have changed. Please review your bag.
        </div>
      )}

      <form action={processCheckout}>
        {/* Hidden fields */}
        <input type="hidden" name="idempotency_key" value={checkoutIdempotencyKey} />
        <input type="hidden" name="payment_method" value="MANUAL_GCASH" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* ── Left Column ──────────────────────────────── */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

            {/* 1. Delivery Address */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <TruckIcon size={20} />
                  1. Select Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr, idx) => (
                    <label 
                      key={addr.id} 
                      className="relative flex items-start gap-3 p-4 rounded-lg border-2 border-border cursor-pointer hover:border-foreground/50 has-[:checked]:border-foreground has-[:checked]:bg-muted/30 transition-all"
                    >
                      <input
                        type="radio"
                        name="address_id"
                        value={addr.id}
                        defaultChecked={addr.is_default || idx === 0}
                        required
                        className="mt-1 w-4 h-4 accent-foreground"
                      />
                      <div className="flex flex-col gap-1 w-full min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-sm truncate">{addr.recipient_name}</strong>
                          {addr.is_default && (
                            <Badge variant="default" className="text-[9px] uppercase px-1.5 py-0">Default</Badge>
                          )}
                          {addr.label && (
                            <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 text-muted-foreground">{addr.label}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                          {addr.phone}<br />
                          {addr.address_line1}
                          {addr.address_line2 && <>, {addr.address_line2}</>}
                          {addr.barangay && <>, Brgy. {addr.barangay}</>}<br />
                          {addr.city_municipality}, {addr.province} {addr.postal_code}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="pt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/account/addresses">
                      + Manage Addresses
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2. Payment — GCash Only */}
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <ShieldCheckIcon size={20} />
                  2. Payment via GCash
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* GCash Instructions Panel */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-5">
                  <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <span>📱</span> How to Pay
                  </h3>
                  <p className="text-sm text-blue-800/80 mb-4">
                    Send the exact order total to our official GCash number:
                  </p>
                  <div className="bg-blue-100 text-blue-950 font-mono font-bold text-2xl tracking-widest px-4 py-3 rounded-md mb-4 text-center">
                    09XX XXX XXXX
                  </div>
                  <ol className="text-sm text-blue-900 space-y-2 list-decimal list-inside">
                    <li>Open GCash &rarr; Send Money &rarr; enter the number above.</li>
                    <li>Enter the <strong>exact grand total</strong> shown in your order summary.</li>
                    <li>Add your order number in the message/note field.</li>
                    <li>Screenshot the GCash confirmation screen.</li>
                    <li><strong>Upload the screenshot</strong> on your Order Details page after checkout.</li>
                  </ol>
                </div>

                {/* Selected Payment Method Indicator */}
                <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-foreground bg-muted/30">
                  <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-foreground text-background shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="flex flex-col gap-1">
                    <strong className="text-sm">Manual GCash Transfer</strong>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Send payment to our GCash number and upload your receipt after placing your order.
                      Orders are processed once payment is verified by our team (usually within 1–2 hours).
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>

          </div>

          {/* ── Right Column: Order Summary ────────────── */}
          <aside className="lg:col-span-5 xl:col-span-4 sticky top-6">
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-extrabold tracking-tight">Order Summary</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Items */}
                <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-2">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start gap-4 text-sm">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-medium truncate text-foreground">
                          {item.product_name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                          {item.variant_name && <span>{item.variant_name}</span>}
                          <span>Qty {item.quantity}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold shrink-0 mt-0.5">
                        {formatMinorUnitsToPHP(item.line_total_minor)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="my-2" />

                {/* Totals */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono font-bold">{formatMinorUnitsToPHP(cart.subtotal_minor)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Standard Shipping</span>
                    <span className="font-mono font-bold">{formatMinorUnitsToPHP(shippingMinor)}</span>
                  </div>
                </div>

                <Separator className="border-foreground/20" />

                <div className="flex justify-between items-end pt-2">
                  <span className="font-bold text-lg">Grand Total</span>
                  <strong className="text-2xl font-mono font-bold text-foreground">
                    {formatMinorUnitsToPHP(grandTotalMinor)}
                  </strong>
                </div>
              </CardContent>

              <CardContent className="pt-0">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full font-bold h-14 flex items-center justify-center gap-2"
                >
                  <span>Place Order</span>
                  <ArrowRightIcon size={16} />
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed px-2">
                  By placing your order you agree to upload your GCash receipt within 24 hours. Unverified orders may be cancelled.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </form>
    </main>
  );
}
