import { CheckCircle2, Megaphone, Palette, Settings, Truck, Wallet } from "lucide-react";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { formatMinorUnitsToPHP } from "@/lib/money";
import { updateStoreSetting } from "@/lib/settings/actions";
import { getAllStoreSettings } from "@/lib/settings/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

interface SearchParams {
  notice?: string;
  error?: string;
}

interface AnnouncementSettings {
  enabled: boolean;
  text: string;
  link: string;
}

interface HeroSettings {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
}

interface FulfillmentSettings {
  shipping_fee_minor: number;
  free_shipping_threshold_minor: number;
  allow_store_pickup: boolean;
  pickup_address: string;
}

interface PaymentSettings {
  gcash_enabled: boolean;
  gcash_number: string;
  gcash_account_name: string;
  gcash_qr_path: string;
  cod_enabled: boolean;
  cod_max_minor: number;
}

interface FooterSettings {
  brand_copy: string;
  support_email: string;
  location: string;
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminAal2("/admin/settings");
  const { notice, error } = await searchParams;

  const settings = await getAllStoreSettings();

  const announcement = (settings.announcement?.value as AnnouncementSettings) || {
    enabled: true,
    text: "NEW DROP: DROP 01 NOW AVAILABLE — COMPLIMENTARY METRO MANILA SHIPPING OVER ₱3,500",
    link: "/products",
  };

  const hero = (settings.hero?.value as HeroSettings) || {
    title: "1968 CLOTHING",
    subtitle: "DEFEND THE CULTURE. ARCHIVAL STREETWEAR.",
    cta_text: "EXPLORE DROP 01",
    cta_link: "/products",
  };

  const fulfillment = (settings.fulfillment?.value as FulfillmentSettings) || {
    shipping_fee_minor: 15000,
    free_shipping_threshold_minor: 350000,
    allow_store_pickup: true,
    pickup_address: "1968 Flagship Store, Makati City",
  };

  const payment = (settings.payment?.value as PaymentSettings) || {
    gcash_enabled: true,
    gcash_number: "0917-196-8000",
    gcash_account_name: "1968 CLOTHING PH",
    gcash_qr_path: "/images/gcash-merchant-qr.svg",
    cod_enabled: true,
    cod_max_minor: 1000000,
  };
  const footer = (settings.footer?.value as FooterSettings) || {
    brand_copy: "Independent Filipino streetwear · Est. 1968. Archival garments crafted for the daily journey.",
    support_email: "1968clothing.official@gmail.com",
    location: "Manila, Philippines",
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
          System &amp; Storefront Configuration
        </p>
        <h1 className="admin-h1 text-foreground flex items-center gap-2 mt-1">
          <Settings className="size-7 text-primary" />
          Store Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Control live marketing announcements, homepage hero copy, shipping fees, and payment channels.
        </p>
      </header>

      {notice === "setting_updated" && (
        <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-2 text-sm">
          <CheckCircle2 className="size-4" />
          Store configuration successfully saved and applied to storefront!
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm">
          Error saving settings: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <Card className="border-border shadow-xs">
          <CardHeader className="border-b border-border pb-3"><CardTitle className="text-base">Public footer</CardTitle><CardDescription className="text-xs">Brand and contact details shown across customer pages.</CardDescription></CardHeader>
          <CardContent className="p-4">
            <form action={async (formData: FormData) => { "use server"; const payload = { brand_copy: String(formData.get("brand_copy") || ""), support_email: String(formData.get("support_email") || ""), location: String(formData.get("location") || "") }; formData.set("key", "footer"); formData.set("value_json", JSON.stringify(payload)); await updateStoreSetting(formData); }} className="space-y-3">
              <div><Label htmlFor="footer_copy" className="text-xs">Brand copy</Label><Input id="footer_copy" name="brand_copy" defaultValue={footer.brand_copy} className="mt-1 h-9 text-xs" required /></div>
              <div><Label htmlFor="support_email" className="text-xs">Support email</Label><Input id="support_email" name="support_email" type="email" defaultValue={footer.support_email} className="mt-1 h-9 text-xs" required /></div>
              <div><Label htmlFor="store_location" className="text-xs">Store location</Label><Input id="store_location" name="location" defaultValue={footer.location} className="mt-1 h-9 text-xs" required /></div>
              <Button type="submit" size="sm" className="w-full">Save footer</Button>
            </form>
          </CardContent>
        </Card>
        {/* 1. Announcement Bar */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="size-4 text-primary" />
              Storefront Announcement Bar
            </CardTitle>
            <CardDescription className="text-xs">
              Header banner displayed across all customer pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form
              action={async (formData: FormData) => {
                "use server";
                const enabled = formData.get("enabled") === "on";
                const text = formData.get("text") as string;
                const link = formData.get("link") as string;
                const payload = { enabled, text, link };
                formData.set("key", "announcement");
                formData.set("value_json", JSON.stringify(payload));
                await updateStoreSetting(formData);
              }}
              className="space-y-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ann_enabled"
                  name="enabled"
                  defaultChecked={announcement.enabled}
                  className="rounded border-input text-primary focus:ring-primary size-4"
                />
                <Label htmlFor="ann_enabled" className="text-xs font-bold">Enable Announcement Banner</Label>
              </div>

              <div>
                <Label htmlFor="ann_text" className="text-xs">Banner Text</Label>
                <Input
                  id="ann_text"
                  name="text"
                  defaultValue={announcement.text}
                  className="h-8 text-xs mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="ann_link" className="text-xs">Destination Link (Optional)</Label>
                <Input
                  id="ann_link"
                  name="link"
                  defaultValue={announcement.link}
                  className="h-8 text-xs mt-1"
                  placeholder="/products"
                />
              </div>

              <Button type="submit" size="sm" className="w-full text-xs font-bold mt-2">
                Save Announcement
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 2. Homepage Hero Banner */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              Homepage Hero Banner
            </CardTitle>
            <CardDescription className="text-xs">
              Editorial hero typography and primary CTA button.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form
              action={async (formData: FormData) => {
                "use server";
                const title = formData.get("title") as string;
                const subtitle = formData.get("subtitle") as string;
                const cta_text = formData.get("cta_text") as string;
                const cta_link = formData.get("cta_link") as string;
                const payload = { title, subtitle, cta_text, cta_link };
                formData.set("key", "hero");
                formData.set("value_json", JSON.stringify(payload));
                await updateStoreSetting(formData);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <Label htmlFor="hero_title" className="text-xs">Headline</Label>
                <Input
                  id="hero_title"
                  name="title"
                  defaultValue={hero.title}
                  className="h-8 text-xs mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="hero_subtitle" className="text-xs">Subheading</Label>
                <Input
                  id="hero_subtitle"
                  name="subtitle"
                  defaultValue={hero.subtitle}
                  className="h-8 text-xs mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="hero_cta" className="text-xs">CTA Button Text</Label>
                  <Input
                    id="hero_cta"
                    name="cta_text"
                    defaultValue={hero.cta_text}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="hero_link" className="text-xs">CTA Link</Label>
                  <Input
                    id="hero_link"
                    name="cta_link"
                    defaultValue={hero.cta_link}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full text-xs font-bold mt-2">
                Save Hero Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 3. Fulfillment & Shipping */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              Fulfillment &amp; Delivery Rates
            </CardTitle>
            <CardDescription className="text-xs">
              Shipping calculations and store pickup policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form
              action={async (formData: FormData) => {
                "use server";
                const shipping_fee_minor = parseInt(formData.get("shipping_fee_minor") as string, 10);
                const free_shipping_threshold_minor = parseInt(formData.get("free_shipping_threshold_minor") as string, 10);
                const allow_store_pickup = formData.get("allow_store_pickup") === "on";
                const pickup_address = formData.get("pickup_address") as string;
                const payload = { shipping_fee_minor, free_shipping_threshold_minor, allow_store_pickup, pickup_address };
                formData.set("key", "fulfillment");
                formData.set("value_json", JSON.stringify(payload));
                await updateStoreSetting(formData);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="ship_fee" className="text-xs">Courier Fee (Centavos)</Label>
                  <Input
                    id="ship_fee"
                    name="shipping_fee_minor"
                    type="number"
                    defaultValue={fulfillment.shipping_fee_minor}
                    className="h-8 text-xs font-mono mt-1"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Current: {formatMinorUnitsToPHP(fulfillment.shipping_fee_minor)}
                  </span>
                </div>
                <div>
                  <Label htmlFor="free_thresh" className="text-xs">Free Ship Over (Centavos)</Label>
                  <Input
                    id="free_thresh"
                    name="free_shipping_threshold_minor"
                    type="number"
                    defaultValue={fulfillment.free_shipping_threshold_minor}
                    className="h-8 text-xs font-mono mt-1"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Current: {formatMinorUnitsToPHP(fulfillment.free_shipping_threshold_minor)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allow_pickup"
                  name="allow_store_pickup"
                  defaultChecked={fulfillment.allow_store_pickup}
                  className="rounded border-input text-primary focus:ring-primary size-4"
                />
                <Label htmlFor="allow_pickup" className="text-xs font-bold">Allow Flagship Store Pickup</Label>
              </div>

              <div>
                <Label htmlFor="pickup_addr" className="text-xs">Store Pickup Address / Notice</Label>
                <Input
                  id="pickup_addr"
                  name="pickup_address"
                  defaultValue={fulfillment.pickup_address}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <Button type="submit" size="sm" className="w-full text-xs font-bold mt-2">
                Save Fulfillment Rules
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 4. Payment Gateway Settings */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              Payment Channels &amp; GCash
            </CardTitle>
            <CardDescription className="text-xs">
              Configure manual GCash merchant account and COD availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form
              action={async (formData: FormData) => {
                "use server";
                const gcash_number = formData.get("gcash_number") as string;
                const gcash_account_name = formData.get("gcash_account_name") as string;
                const gcash_qr_path = formData.get("gcash_qr_path") as string;
                const gcash_enabled = formData.get("gcash_enabled") === "on";
                const cod_enabled = formData.get("cod_enabled") === "on";
                const payload = { gcash_number, gcash_account_name, gcash_qr_path, gcash_enabled, cod_enabled };
                formData.set("key", "payment");
                formData.set("value_json", JSON.stringify(payload));
                await updateStoreSetting(formData);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <Label htmlFor="gcash_num" className="text-xs">GCash Account Number</Label>
                <Input
                  id="gcash_num"
                  name="gcash_number"
                  defaultValue={payment.gcash_number}
                  className="h-8 text-xs font-mono font-bold mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="gcash_name" className="text-xs">GCash Registered Name</Label>
                <Input
                  id="gcash_name"
                  name="gcash_account_name"
                  defaultValue={payment.gcash_account_name}
                  className="h-8 text-xs mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="gcash_qr" className="text-xs">GCash QR asset path</Label>
                <Input id="gcash_qr" name="gcash_qr_path" defaultValue={payment.gcash_qr_path} className="mt-1 h-8 text-xs" required pattern="/images/.*" />
                <p className="mt-1 text-[10px] text-muted-foreground">Keep this QR synchronized with the account number and registered name above.</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="gc_enable"
                    name="gcash_enabled"
                    defaultChecked={payment.gcash_enabled}
                    className="rounded border-input text-primary focus:ring-primary size-4"
                  />
                  <Label htmlFor="gc_enable" className="text-xs font-bold">Accept GCash</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="cod_enable"
                    name="cod_enabled"
                    defaultChecked={payment.cod_enabled}
                    className="rounded border-input text-primary focus:ring-primary size-4"
                  />
                  <Label htmlFor="cod_enable" className="text-xs font-bold">Accept COD</Label>
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full text-xs font-bold mt-2">
                Save Payment Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
