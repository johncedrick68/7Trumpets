"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Truck, Store, ArrowRight, Check, MapPin, Clock, Info, Banknote, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { calculateShippingMinor } from "@/lib/checkout/shipping";

export interface CheckoutFormClientProps {
  cart: {
    id: string;
    subtotal_minor: number;
    items: Array<{
      id: string;
      product_name: string;
      variant_name?: string | null;
      quantity: number;
      line_total_minor: number;
    }>;
  };
  addresses: Array<{
    id: string;
    recipient_name: string;
    phone: string;
    address_line1: string;
    address_line2?: string | null;
    barangay?: string | null;
    city_municipality: string;
    province: string;
    postal_code: string;
    is_default?: boolean;
    label?: string | null;
  }>;
  fulfillmentSettings?: {
    shipping_fee_minor?: number;
    free_shipping_threshold_minor?: number;
    allow_store_pickup?: boolean;
    pickup_address?: string;
  };
  paymentSettings?: {
    gcash_number?: string;
    gcash_account_name?: string;
    gcash_qr_path?: string;
  };
}

export function CheckoutFormClient({
  cart,
  addresses,
  fulfillmentSettings,
  paymentSettings,
}: CheckoutFormClientProps) {
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"SHIPMENT" | "STORE_PICKUP">("SHIPMENT");
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "CASH" | "MANUAL_GCASH">("COD");
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.is_default)?.id || addresses[0]?.id || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shippingMinor = calculateShippingMinor(cart.subtotal_minor, fulfillmentMethod, fulfillmentSettings ?? {});
  const grandTotalMinor = cart.subtotal_minor + shippingMinor;

  const gcashNumber = paymentSettings?.gcash_number || "0917 196 8000";
  const gcashName = paymentSettings?.gcash_account_name || "1968 CLOTHING PH";
  const gcashQrPath = paymentSettings?.gcash_qr_path || "/images/gcash-merchant-qr.svg";
  const pickupAddress = fulfillmentSettings?.pickup_address || "1968 Flagship Store, Makati City";

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];

  const handleFulfillmentChange = (method: "SHIPMENT" | "STORE_PICKUP") => {
    setFulfillmentMethod(method);
    if (method === "STORE_PICKUP") {
      if (paymentMethod === "COD") {
        setPaymentMethod("CASH");
      }
    } else {
      if (paymentMethod === "CASH") {
        setPaymentMethod("COD");
      }
    }
  };

  return (
    <>
      <input type="hidden" name="fulfillment_method" value={fulfillmentMethod} />
      <input type="hidden" name="payment_method" value={paymentMethod} />
      <input type="hidden" name="address_id" value={selectedAddressId} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* ── Left Column ──────────────────────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

          {/* 1. Fulfillment Method Selection */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold">1</span>
                  Select Fulfillment Method
                </span>
                <span className="text-xs font-mono text-muted-foreground uppercase">Step 1 of 2</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Courier Option */}
                <button
                  type="button"
                  onClick={() => handleFulfillmentChange("SHIPMENT")}
                  className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    fulfillmentMethod === "SHIPMENT"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border hover:border-border/80 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <Truck className={`size-5 ${fulfillmentMethod === "SHIPMENT" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-bold text-sm">Courier Delivery</span>
                    </div>
                    <Badge variant={fulfillmentMethod === "SHIPMENT" ? "default" : "outline"} className="font-mono text-xs">
                      {shippingMinor === 0 ? "Free" : formatMinorUnitsToPHP(shippingMinor)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Doorstep parcel delivery across Metro Manila and provinces within 2–5 business days.
                  </p>
                  {fulfillmentMethod === "SHIPMENT" && (
                    <div className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" />
                    </div>
                  )}
                </button>

                {/* Store Pickup Option */}
                <button
                  type="button"
                  onClick={() => handleFulfillmentChange("STORE_PICKUP")}
                  className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    fulfillmentMethod === "STORE_PICKUP"
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border hover:border-border/80 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <Store className={`size-5 ${fulfillmentMethod === "STORE_PICKUP" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-bold text-sm">Store Pickup</span>
                    </div>
                    <Badge variant={fulfillmentMethod === "STORE_PICKUP" ? "default" : "outline"} className="font-mono text-xs bg-emerald-600 hover:bg-emerald-600 text-white">
                      FREE
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Collect directly at 1968 Flagship Store — Makati. Ready in 2h after payment approval.
                  </p>
                  {fulfillmentMethod === "STORE_PICKUP" && (
                    <div className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" />
                    </div>
                  )}
                </button>
              </div>

              {/* Conditional Address or Pickup Location details */}
              {fulfillmentMethod === "SHIPMENT" ? (
                <div className="pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                      Shipping Destination
                    </span>
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs font-medium">
                      <Link href="/account/addresses">+ Manage Addresses</Link>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {addresses.map((addr) => {
                      const isSelected = selectedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressId(addr.id)}
                          className={`relative flex items-start gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-xs"
                              : "border-border hover:border-border/80 bg-card"
                          }`}
                        >
                          <input
                            type="radio"
                            name="_address_radio"
                            checked={isSelected}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1 w-4 h-4 accent-primary shrink-0"
                          />
                          <div className="flex flex-col gap-0.5 w-full min-w-0">
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pt-3 space-y-3">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                        <MapPin className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">1968 Flagship Store — Makati</h4>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase bg-background">Flagship</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Ground Floor, Archival Retail Center, 77 Kamuning Rd / Makati Cultural District, Metro Manila
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border font-mono">
                      <Clock className="size-3.5 shrink-0 text-primary" />
                      <span>Pickup Hours: Monday to Sunday · 11:00 AM – 8:00 PM</span>
                    </div>
                  </div>

                  {/* Collector Verification Card */}
                  <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                        Authorized Collector
                      </span>
                      {addresses.length > 1 && (
                        <select
                          value={selectedAddressId}
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          aria-label="Select Authorized Collector profile"
                          className="text-xs bg-muted/50 border border-border rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {addresses.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.recipient_name} ({a.phone})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {selectedAddress && (
                      <div className="flex items-center justify-between text-xs bg-muted/30 p-2.5 rounded-md font-mono">
                        <span className="font-bold text-foreground">{selectedAddress.recipient_name}</span>
                        <span className="text-muted-foreground">{selectedAddress.phone}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                      <Info className="size-3 shrink-0 text-primary" />
                      <span>Please present a government-issued photo ID and your Order Number upon pickup.</span>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Payment Method Selection */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold">2</span>
                  Select Payment Method
                </span>
                <span className="text-xs font-mono text-muted-foreground uppercase">Step 2 of 2</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fulfillmentMethod === "STORE_PICKUP" ? (
                  <>
                    {/* Store Pickup: Cash */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("CASH")}
                      className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        paymentMethod === "CASH"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:border-border/80 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <div className="flex items-center gap-2">
                          <Banknote className={`size-5 ${paymentMethod === "CASH" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-bold text-sm">Cash upon Pickup</span>
                        </div>
                        <Badge variant={paymentMethod === "CASH" ? "default" : "outline"} className="font-mono text-[10px]">
                          Counter Cash
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Pay in-person at the 1968 Flagship Store Makati pickup desk upon order inspection.
                      </p>
                      {paymentMethod === "CASH" && (
                        <div className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </button>

                    {/* Store Pickup: GCash */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("MANUAL_GCASH")}
                      className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        paymentMethod === "MANUAL_GCASH"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:border-border/80 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className={`size-5 ${paymentMethod === "MANUAL_GCASH" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-bold text-sm">GCash Pre-payment</span>
                        </div>
                        <Badge variant={paymentMethod === "MANUAL_GCASH" ? "default" : "outline"} className="font-mono text-[10px]">
                          Fast Handover
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Pre-pay via GCash now so your order is pre-packed and ready for express pickup.
                      </p>
                      {paymentMethod === "MANUAL_GCASH" && (
                        <div className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {/* Shipment: COD */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("COD")}
                      className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        paymentMethod === "COD"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:border-border/80 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <div className="flex items-center gap-2">
                          <Banknote className={`size-5 ${paymentMethod === "COD" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-bold text-sm">Cash on Delivery</span>
                        </div>
                        <Badge variant={paymentMethod === "COD" ? "default" : "outline"} className="font-mono text-[10px]">
                          COD
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Pay cash directly to the courier upon delivery of your parcel at your doorstep.
                      </p>
                      {paymentMethod === "COD" && (
                        <div className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </button>

                    {/* Shipment: GCash */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("MANUAL_GCASH")}
                      className={`relative flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        paymentMethod === "MANUAL_GCASH"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:border-border/80 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className={`size-5 ${paymentMethod === "MANUAL_GCASH" ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-bold text-sm">GCash Transfer</span>
                        </div>
                        <Badge variant={paymentMethod === "MANUAL_GCASH" ? "default" : "outline"} className="font-mono text-[10px]">
                          Contactless
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Transfer via GCash before dispatch for priority contactless parcel shipment.
                      </p>
                      {paymentMethod === "MANUAL_GCASH" && (
                        <div className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Conditional Payment Details */}
              {paymentMethod === "MANUAL_GCASH" ? (
                <div className="bg-neutral-50 dark:bg-neutral-900/70 border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-foreground text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                      <span>📱</span> Official 1968 GCash payment details
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Transfer directly to our registered merchant account using the exact grand total:
                  </p>
                  <div className="bg-neutral-950 text-white font-mono font-bold text-xl sm:text-2xl tracking-widest px-4 py-3 rounded-lg text-center select-all border border-neutral-800 shadow-inner">
                    {gcashNumber}
                  </div>
                  <p className="text-[11px] font-mono text-center text-muted-foreground font-semibold uppercase tracking-wider">
                    Account Name: {gcashName}
                  </p>
                  <div className="mx-auto w-full max-w-44 rounded-lg border bg-white p-3"><Image src={gcashQrPath} alt="GCash payment QR code" width={176} height={176} className="h-auto w-full" /></div>
                  <Separator className="my-2" />
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Confirm order below to reserve inventory for 2 hours.</li>
                    <li>Transfer exact amount (<strong className="font-semibold tabular-nums text-foreground">{formatMinorUnitsToPHP(grandTotalMinor)}</strong>) via GCash.</li>
                    <li>Upload payment screenshot on your Order Tracking page.</li>
                  </ol>
                </div>
              ) : paymentMethod === "CASH" ? (
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="size-4 text-primary" />
                    <span className="font-bold text-xs uppercase font-mono text-foreground">Flagship Counter Settlement</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Please prepare exact cash (<strong className="font-semibold tabular-nums text-foreground">{formatMinorUnitsToPHP(grandTotalMinor)}</strong>) when collecting your order at {pickupAddress}.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-primary" />
                    <span className="font-bold text-xs uppercase font-mono text-foreground">Courier Cash Settlement</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Please prepare exact cash (<strong className="font-semibold tabular-nums text-foreground">{formatMinorUnitsToPHP(grandTotalMinor)}</strong>) to hand over to the courier upon parcel delivery.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Order Summary ────────────── */}
        <aside className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Items */}
              <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-2">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start gap-4 text-sm">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium truncate text-foreground text-xs sm:text-sm">
                        {item.product_name}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                        {item.variant_name && <span>{item.variant_name}</span>}
                        <span>Qty {item.quantity}</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold shrink-0 text-xs sm:text-sm mt-0.5">
                      {formatMinorUnitsToPHP(item.line_total_minor)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-2" />

              {/* Totals */}
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatMinorUnitsToPHP(cart.subtotal_minor)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Fulfillment</span>
                    <Badge variant="outline" className="text-[9px] font-mono uppercase px-1 py-0">
                      {fulfillmentMethod === "STORE_PICKUP" ? "Pickup" : "Courier"}
                    </Badge>
                  </div>
                  <span className="font-mono font-bold">
                    {fulfillmentMethod === "STORE_PICKUP" ? (
                      <span className="text-emerald-600">FREE</span>
                    ) : (
                      formatMinorUnitsToPHP(shippingMinor)
                    )}
                  </span>
                </div>
              </div>

              <Separator className="border-foreground/20" />

              <div className="flex justify-between items-end pt-1">
                <span className="font-bold text-base">Grand Total</span>
                <strong className="text-2xl font-mono font-bold text-foreground">
                  {formatMinorUnitsToPHP(grandTotalMinor)}
                </strong>
              </div>
            </CardContent>

            <CardContent className="pt-0">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                onClick={() => setIsSubmitting(true)}
                className="w-full font-bold h-14 flex items-center justify-center gap-2 bg-neutral-950 text-white hover:bg-neutral-800 uppercase tracking-wider text-sm rounded-md shadow-xs transition-all cursor-pointer"
              >
                <span>{isSubmitting ? "Securing Order..." : "Place Order"}</span>
                <ArrowRight className="size-4" />
              </Button>

              <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed px-2">
                By placing your order you agree to submit payment proof within 2 hours.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
