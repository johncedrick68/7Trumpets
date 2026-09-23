import { notFound } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getProductBySlug } from "@/lib/catalog/queries";
import { AUTHORITATIVE_SIZING_NOTE } from "@/lib/catalog/sizing";
import { ProductPurchaseForm } from "@/components/product-purchase-form";
import { ProductGallery } from "@/components/product-gallery";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([
    getProductBySlug(slug),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  const activePrices = product.variants.map((v) => v.price_minor);
  const minPrice = activePrices.length > 0 ? Math.min(...activePrices) : 0;
  const formattedPrice = formatMinorUnitsToPHP(minPrice);

  const categoryName = product.category_id
    ? (categories.find((c) => c.id === product.category_id)?.name ?? "1968 Clothing")
    : "1968 Clothing";

  return (
    <main id="main-content" tabIndex={-1} className="store-container pdp-page min-h-screen">
      <div className="w-full">
        {/* ── Breadcrumb ────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-6 sm:mb-8">
          <Link href="/products" className="hover:text-foreground transition-colors">Collection</Link>
          <span aria-hidden="true">/</span>
          <span className="text-foreground font-bold" aria-current="page">{product.name}</span>
        </nav>

        {/* ── Responsive PDP Layout ─────────────────────────────── */}
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.55fr)] gap-8 lg:gap-12 xl:gap-16 items-start">

          {/* Product Identity Header — Single H1 on both mobile & desktop */}
          <header className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 border-b border-border pb-5 lg:border-none lg:pb-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {categoryName}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {product.name}
            </h1>
            <p className="mt-2 text-xl font-bold font-mono text-foreground sm:text-2xl">
              {formattedPrice}
            </p>
          </header>

          {/* Gallery — Order 2 on mobile, Column 1 on desktop spanning both rows */}
          <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2 w-full min-w-0">
            <ProductGallery
              productName={product.name}
              images={(product.images.length > 0
                ? product.images
                : [{ id: "fallback", storage_path: "/images/1968%20CLOTHING%20V1.0.webp", alt_text: product.name, position: 0, variant_id: null }]
              ).map((image) => ({
                id: image.id,
                url: image.storage_path,
                alt: image.alt_text || product.name,
                position: image.position,
                variantId: image.variant_id
              }))}
            />
          </div>

          {/* Purchasing Form, Assurances & Details — Order 3 on mobile, Row 2 Column 2 on desktop */}
          <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-2 flex w-full min-w-0 flex-col space-y-7 lg:sticky lg:top-24">
            {/* Real Product Description */}
            {product.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}

            {/* Purchase Form (Size Radio Selector, Quantity Stepper, Add to Bag) */}
            {product.variants.length > 0 && (
              <div className="pt-1">
                <ProductPurchaseForm
                  productName={product.name}
                  productSlug={product.slug}
                  options={product.options}
                  variants={product.variants.map((variant) => ({
                    ...variant,
                    formatted_price: formatMinorUnitsToPHP(variant.price_minor),
                  }))}
                />
              </div>
            )}

            {/* Purchase information backed by the current commerce flow */}
            <div className="border-y border-border py-5 space-y-2.5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Purchase Information
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-foreground" aria-hidden="true">✓</span>
                  <span>Cash on Delivery (COD) available</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-foreground" aria-hidden="true">✓</span>
                  <span>Manual GCash payment with staff-verified proof</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-foreground" aria-hidden="true">✓</span>
                  <span>Inventory and order totals are validated securely</span>
                </li>
              </ul>
            </div>

            {/* Fabric & Sizing Standard Note (Verbatim from 1968 Brand Asset) */}
            <section aria-labelledby="sizing-standard-heading" className="border-t border-border pt-5">
              <h2 id="sizing-standard-heading" className="text-sm font-semibold text-foreground">
                Fabric &amp; Care Standard
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {AUTHORITATIVE_SIZING_NOTE}
              </p>
            </section>

            {/* Delivery & Customer Care */}
            <section aria-labelledby="delivery-payment-heading" className="border-t border-border pt-5">
              <h2 id="delivery-payment-heading" className="text-sm font-semibold text-foreground">
                Delivery &amp; Customer Care
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Delivery progress is available in Order Tracking after checkout. Need assistance with sizing or tracking?{" "}
                <Link href="/account/support" className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80">
                  Contact Support
                </Link>
              </p>
            </section>
          </div>

        </div>
      </div>
    </main>
  );
}
