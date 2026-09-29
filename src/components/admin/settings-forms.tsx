"use client";

import * as React from "react";
import { Megaphone, Truck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStoreSetting } from "@/lib/settings/actions";

interface SettingsFormProps {
  initialSettings: {
    announcement: {
      enabled: boolean;
      text: string;
      link: string;
    };
    hero: {
      title: string;
      subtitle: string;
      cta_text: string;
      cta_link: string;
    };
    fulfillment: {
      shipping_fee_minor: number;
      free_shipping_threshold_minor: number;
      allow_store_pickup: boolean;
      pickup_address: string;
    };
    payment: {
      gcash_enabled: boolean;
      gcash_number: string;
      gcash_account_name: string;
      gcash_qr_path: string;
      cod_enabled: boolean;
      cod_max_minor: number;
    };
    footer?: {
      brand_copy: string;
      support_email: string;
      location: string;
    };
  };
}

export function SettingsWorkspace({ initialSettings }: SettingsFormProps) {
  // Form 1: Announcement
  const [annEnabled, setAnnEnabled] = React.useState(initialSettings.announcement.enabled);
  const [annText, setAnnText] = React.useState(initialSettings.announcement.text);
  const [annLink, setAnnLink] = React.useState(initialSettings.announcement.link);
  const [annPending, startAnnTransition] = React.useTransition();

  // Form 2: Hero
  const [heroTitle, setHeroTitle] = React.useState(initialSettings.hero.title);
  const [heroSubtitle, setHeroSubtitle] = React.useState(initialSettings.hero.subtitle);
  const [heroCtaText, setHeroCtaText] = React.useState(initialSettings.hero.cta_text);
  const [heroCtaLink, setHeroCtaLink] = React.useState(initialSettings.hero.cta_link);
  const [heroPending, startHeroTransition] = React.useTransition();

  // Form 3: Fulfillment
  const [shippingFeePesos, setShippingFeePesos] = React.useState(
    (initialSettings.fulfillment.shipping_fee_minor / 100).toFixed(2)
  );
  const [freeThresholdPesos, setFreeThresholdPesos] = React.useState(
    (initialSettings.fulfillment.free_shipping_threshold_minor / 100).toFixed(2)
  );
  const [allowPickup, setAllowPickup] = React.useState(
    initialSettings.fulfillment.allow_store_pickup
  );
  const [pickupAddress, setPickupAddress] = React.useState(
    initialSettings.fulfillment.pickup_address
  );
  const [fulPending, startFulTransition] = React.useTransition();

  // Form 4: Payment
  const [codEnabled, setCodEnabled] = React.useState(initialSettings.payment.cod_enabled);
  const [codMaxPesos, setCodMaxPesos] = React.useState(
    (initialSettings.payment.cod_max_minor / 100).toFixed(2)
  );
  const [gcashEnabled, setGcashEnabled] = React.useState(initialSettings.payment.gcash_enabled);
  const [gcashNumber, setGcashNumber] = React.useState(initialSettings.payment.gcash_number);
  const [gcashName, setGcashName] = React.useState(initialSettings.payment.gcash_account_name);
  const [gcashQrPath, setGcashQrPath] = React.useState(initialSettings.payment.gcash_qr_path);
  const [payPending, startPayTransition] = React.useTransition();

  // Save Announcement
  const handleSaveAnnouncement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      enabled: annEnabled,
      text: annText.trim(),
      link: annLink.trim(),
    };
    const fd = new FormData();
    fd.set("key", "announcement");
    fd.set("value_json", JSON.stringify(payload));
    startAnnTransition(async () => {
      await updateStoreSetting(fd);
    });
  };

  // Save Hero
  const handleSaveHero = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      title: heroTitle.trim(),
      subtitle: heroSubtitle.trim(),
      cta_text: heroCtaText.trim(),
      cta_link: heroCtaLink.trim(),
    };
    const fd = new FormData();
    fd.set("key", "hero");
    fd.set("value_json", JSON.stringify(payload));
    startHeroTransition(async () => {
      await updateStoreSetting(fd);
    });
  };

  // Save Fulfillment
  const handleSaveFulfillment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const feeMinor = Math.max(0, Math.round(parseFloat(shippingFeePesos || "0") * 100));
    const thresholdMinor = Math.max(0, Math.round(parseFloat(freeThresholdPesos || "0") * 100));
    const payload = {
      shipping_fee_minor: feeMinor,
      free_shipping_threshold_minor: thresholdMinor,
      allow_store_pickup: allowPickup,
      pickup_address: pickupAddress.trim(),
    };
    const fd = new FormData();
    fd.set("key", "fulfillment");
    fd.set("value_json", JSON.stringify(payload));
    startFulTransition(async () => {
      await updateStoreSetting(fd);
    });
  };

  // Save Payment
  const handleSavePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const maxCodMinor = Math.max(0, Math.round(parseFloat(codMaxPesos || "0") * 100));
    const payload = {
      cod_enabled: codEnabled,
      cod_max_minor: maxCodMinor,
      gcash_enabled: gcashEnabled,
      gcash_number: gcashNumber.trim(),
      gcash_account_name: gcashName.trim(),
      gcash_qr_path: gcashQrPath.trim(),
    };
    const fd = new FormData();
    fd.set("key", "payment");
    fd.set("value_json", JSON.stringify(payload));
    startPayTransition(async () => {
      await updateStoreSetting(fd);
    });
  };

  return (
    <div className="max-w-4xl space-y-10">
      {/* ── Section 1: Storefront Announcement ─────────────────────── */}
      <section className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            Announcement Bar
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Configure the persistent notification banner displayed across the top of every storefront page.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <form onSubmit={handleSaveAnnouncement} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                id="ann-enabled"
                type="checkbox"
                checked={annEnabled}
                onChange={(e) => setAnnEnabled(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="ann-enabled" className="text-xs font-semibold cursor-pointer">
                Display Announcement Banner on Storefront
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-text" className="text-xs font-medium">
                Banner Message
              </Label>
              <Input
                id="ann-text"
                value={annText}
                onChange={(e) => setAnnText(e.target.value)}
                placeholder="e.g. COMPLIMENTARY METRO MANILA SHIPPING OVER ₱3,500"
                className="text-xs"
                required={annEnabled}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-link" className="text-xs font-medium">
                Banner Destination URL
              </Label>
              <Input
                id="ann-link"
                value={annLink}
                onChange={(e) => setAnnLink(e.target.value)}
                placeholder="/products"
                className="text-xs font-mono"
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button type="submit" size="sm" disabled={annPending} className="text-xs font-medium">
                {annPending ? "Saving..." : "Save Announcement"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <hr className="border-border" />

      {/* ── Section 2: Homepage Hero ───────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground">
            Homepage Hero Headline
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Main title, brand ethos subtitle, and primary call-to-action button on the customer homepage.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <form onSubmit={handleSaveHero} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hero-title" className="text-xs font-medium">
                Hero Title
              </Label>
              <Input
                id="hero-title"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="1968 CLOTHING"
                className="text-xs font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hero-subtitle" className="text-xs font-medium">
                Brand Ethos Subtitle
              </Label>
              <Input
                id="hero-subtitle"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="DEFEND THE CULTURE. ARCHIVAL STREETWEAR."
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hero-cta-text" className="text-xs font-medium">
                  Primary Action Button Label
                </Label>
                <Input
                  id="hero-cta-text"
                  value={heroCtaText}
                  onChange={(e) => setHeroCtaText(e.target.value)}
                  placeholder="EXPLORE DROP 01"
                  className="text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hero-cta-link" className="text-xs font-medium">
                  Button Destination
                </Label>
                <Input
                  id="hero-cta-link"
                  value={heroCtaLink}
                  onChange={(e) => setHeroCtaLink(e.target.value)}
                  placeholder="/products"
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button type="submit" size="sm" disabled={heroPending} className="text-xs font-medium">
                {heroPending ? "Saving..." : "Save Hero Section"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <hr className="border-border" />

      {/* ── Section 3: Shipping & Fulfillment ──────────────────────── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            Fulfillment & Shipping
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Authoritative flat shipping rates, free shipping promotional thresholds, and flagship store pickup.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <form onSubmit={handleSaveFulfillment} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shipping-fee" className="text-xs font-medium">
                  Standard Flat Shipping Fee (PHP)
                </Label>
                <Input
                  id="shipping-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingFeePesos}
                  onChange={(e) => setShippingFeePesos(e.target.value)}
                  placeholder="150.00"
                  className="text-xs font-mono"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Applied to standard courier dispatch orders.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="free-threshold" className="text-xs font-medium">
                  Free Shipping Minimum Order (PHP)
                </Label>
                <Input
                  id="free-threshold"
                  type="number"
                  step="0.01"
                  min="0"
                  value={freeThresholdPesos}
                  onChange={(e) => setFreeThresholdPesos(e.target.value)}
                  placeholder="3500.00"
                  className="text-xs font-mono"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Orders equal or above this subtotal qualify for complimentary shipping.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  id="allow-pickup"
                  type="checkbox"
                  checked={allowPickup}
                  onChange={(e) => setAllowPickup(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="allow-pickup" className="text-xs font-semibold cursor-pointer">
                  Allow In-Store Pickup Option at Checkout
                </Label>
              </div>

              {allowPickup && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="pickup-address" className="text-xs font-medium">
                    Store Pickup Address
                  </Label>
                  <Input
                    id="pickup-address"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="1968 Flagship Store, Makati City"
                    className="text-xs"
                    required={allowPickup}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button type="submit" size="sm" disabled={fulPending} className="text-xs font-medium">
                {fulPending ? "Saving..." : "Save Shipping Settings"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <hr className="border-border" />

      {/* ── Section 4: Payment Gateways & Cash Ceilings ─────────────── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            Payment Methods
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Payment gateway availability, COD risk ceiling, and manual GCash account details.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <form onSubmit={handleSavePayment} className="space-y-5">
            {/* COD Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="cod-enabled"
                    type="checkbox"
                    checked={codEnabled}
                    onChange={(e) => setCodEnabled(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="cod-enabled" className="text-xs font-bold cursor-pointer">
                    Cash on Delivery (COD)
                  </Label>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {codEnabled ? "Active" : "Disabled"}
                </span>
              </div>

              {codEnabled && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="cod-max" className="text-xs font-medium">
                    Maximum COD Order Value Ceiling (PHP)
                  </Label>
                  <Input
                    id="cod-max"
                    type="number"
                    step="0.01"
                    min="0"
                    value={codMaxPesos}
                    onChange={(e) => setCodMaxPesos(e.target.value)}
                    placeholder="10000.00"
                    className="text-xs font-mono max-w-xs"
                    required={codEnabled}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Orders exceeding this limit cannot select COD and must use GCash.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              {/* GCash Settings */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="gcash-enabled"
                    type="checkbox"
                    checked={gcashEnabled}
                    onChange={(e) => setGcashEnabled(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="gcash-enabled" className="text-xs font-bold cursor-pointer">
                    Manual GCash Verification
                  </Label>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {gcashEnabled ? "Active" : "Disabled"}
                </span>
              </div>

              {gcashEnabled && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="gcash-number" className="text-xs font-medium">
                        GCash Mobile Number
                      </Label>
                      <Input
                        id="gcash-number"
                        value={gcashNumber}
                        onChange={(e) => setGcashNumber(e.target.value)}
                        placeholder="0917-196-8000"
                        className="text-xs font-mono"
                        required={gcashEnabled}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gcash-name" className="text-xs font-medium">
                        GCash Account Name
                      </Label>
                      <Input
                        id="gcash-name"
                        value={gcashName}
                        onChange={(e) => setGcashName(e.target.value)}
                        placeholder="1968 CLOTHING PH"
                        className="text-xs uppercase"
                        required={gcashEnabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gcash-qr" className="text-xs font-medium">
                      Merchant QR Code Path
                    </Label>
                    <Input
                      id="gcash-qr"
                      value={gcashQrPath}
                      onChange={(e) => setGcashQrPath(e.target.value)}
                      placeholder="/images/gcash-merchant-qr.svg"
                      className="text-xs font-mono"
                      required={gcashEnabled}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button type="submit" size="sm" disabled={payPending} className="text-xs font-medium">
                {payPending ? "Saving..." : "Save Payment Settings"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
