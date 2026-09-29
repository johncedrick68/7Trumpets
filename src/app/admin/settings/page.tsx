import { CheckCircle2, XCircle } from "lucide-react";
import { requireAdminAal2 } from "@/lib/admin/auth";
import { getAllStoreSettings } from "@/lib/settings/queries";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SettingsWorkspace } from "@/components/admin/settings-forms";

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

  const announcementDefaults: AnnouncementSettings = {
    enabled: true,
    text: "NEW DROP: DROP 01 NOW AVAILABLE — COMPLIMENTARY METRO MANILA SHIPPING OVER ₱3,500",
    link: "/products",
  };
  const announcement = { ...announcementDefaults, ...((settings.announcement?.value as Partial<AnnouncementSettings>) || {}) };

  const heroDefaults: HeroSettings = {
    title: "1968 CLOTHING",
    subtitle: "DEFEND THE CULTURE. ARCHIVAL STREETWEAR.",
    cta_text: "EXPLORE DROP 01",
    cta_link: "/products",
  };
  const hero = { ...heroDefaults, ...((settings.hero?.value as Partial<HeroSettings>) || {}) };

  const fulfillmentDefaults: FulfillmentSettings = {
    shipping_fee_minor: 15000,
    free_shipping_threshold_minor: 350000,
    allow_store_pickup: true,
    pickup_address: "1968 Flagship Store, Makati City",
  };
  const fulfillment = { ...fulfillmentDefaults, ...((settings.fulfillment?.value as Partial<FulfillmentSettings>) || {}) };

  const paymentDefaults: PaymentSettings = {
    gcash_enabled: true,
    gcash_number: "0917-196-8000",
    gcash_account_name: "1968 CLOTHING PH",
    gcash_qr_path: "/images/gcash-merchant-qr.svg",
    cod_enabled: true,
    cod_max_minor: 1000000,
  };
  const payment = { ...paymentDefaults, ...((settings.payment?.value as Partial<PaymentSettings>) || {}) };

  const footerDefaults: FooterSettings = {
    brand_copy: "Independent Filipino streetwear · Est. 1968. Archival garments crafted for the daily journey.",
    support_email: "1968clothing.official@gmail.com",
    location: "Manila, Philippines",
  };
  const footer = { ...footerDefaults, ...((settings.footer?.value as Partial<FooterSettings>) || {}) };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="System Configuration"
        title="Store Configuration"
        description="Authoritative business rules, storefront content, fulfillment rates, and payment methods."
      />

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300 max-w-4xl"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">
            {notice === "setting_updated" && "Store settings successfully updated and revalidated."}
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 max-w-4xl"
        >
          <XCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">
            {error === "missing_parameters" && "Unable to save setting: missing required parameters."}\n
            {error === "invalid_json" && "Unable to save setting: payload format error."}\n
            {error === "update_failed" && "Failed to persist setting to PostgreSQL. Check permissions and retry."}\n
            {!["missing_parameters", "invalid_json", "update_failed"].includes(error) && `Error: ${error}`}
          </span>
        </div>
      )}

      <SettingsWorkspace
        initialSettings={{
          announcement,
          hero,
          fulfillment,
          payment: {
            ...payment,
            cod_max_minor: payment.cod_max_minor,
          },
          footer,
        }}
      />
    </div>
  );
}
