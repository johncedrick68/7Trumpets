import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getProductBySlug } from "@/lib/catalog/queries";
import { AUTHORITATIVE_SIZING_NOTE } from "@/lib/catalog/sizing";
import { ProductPurchaseForm } from "@/components/product-purchase-form";
import { ProductGallery } from "@/components/product-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return {
      title: "Product Not Found · 1968",
    };
  }

  const primaryImage = product.images[0]?.storage_path || "/images/1968%20CLOTHING%20V1.0.webp";

  return {
    title: `${product.name} · 1968`,
    description:
      product.description ||
      `Shop ${product.name} from 1968 Clothing. Authentic streetwear with Cash on Delivery and GCash.`,
    openGraph: {
      title: `${product.name} · 1968`,
      description: product.description || `Shop ${product.name} from 1968 Clothing.`,
      images: [{ url: primaryImage }],
    },
  };
}

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
    ? (categories.find((c) => c.id === product.category_id)?.name ?? "1968 Drops")
    : "1968 Drops";

  return (
    <main id="main-content" tabIndex={-1} className="store-container pdp-page min-h-screen pt-4 pb-20">
      <div className="w-full">
        {/* ── Breadcrumb ────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase tracking-wider mb-6">
          <Link href="/products" className="hover:text-foreground transition-colors">
            Collection
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-foreground font-bold truncate max-w-[200px] sm:max-w-none" aria-current="page">
            {product.name}
          </span>
        </nav>

        {/* ── Responsive UA-Inspired 2-Column Composition ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-start">

          {/* Left Column: Gallery (Order 1 on mobile, 7 cols on desktop) */}
          <div className="lg:col-span-7 w-full min-w-0">
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
                variantId: image.variant_id,
              }))}
            />
          </div>

          {/* Right Column: Sticky Purchase Panel (Order 2 on mobile, 5 cols on desktop) */}
          <div className="lg:col-span-5 w-full min-w-0 lg:sticky lg:top-20 space-y-6">

            {/* 1. Product Identity */}
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
                {categoryName}
              </p>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase leading-tight">
                {product.name}
              </h1>
              <p className="mt-2.5 font-mono text-xl sm:text-2xl font-bold text-foreground">
                {formattedPrice}
              </p>
            </div>

            {/* 2. Verified Commerce Assurances (Factual 1968 rules only) */}
            <div className="border-y border-border py-3.5 space-y-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-foreground font-bold" aria-hidden="true">✓</span>
                <span>Cash on Delivery (COD) Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-bold" aria-hidden="true">✓</span>
                <span>Manual GCash with Verified Payment Proof</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-bold" aria-hidden="true">✓</span>
                <span>Inventory Confirmed Before Order</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-bold" aria-hidden="true">✓</span>
                <span>Tracking Provided After Fulfillment</span>
              </div>
            </div>

            {/* 3. Interactive Purchase Form */}
            {product.variants.length > 0 && (
              <ProductPurchaseForm
                productName={product.name}
                productSlug={product.slug}
                options={product.options}
                variants={product.variants.map((variant) => ({
                  ...variant,
                  formatted_price: formatMinorUnitsToPHP(variant.price_minor),
                }))}
              />
            )}

            {/* 4. Product Details & Standards (Flat minimal retail sections) */}
            <div className="border-t border-border pt-6 space-y-6">
              {product.description && (
                <section aria-labelledby="product-description-heading">
                  <h2
                    id="product-description-heading"
                    className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-2"
                  >
                    Description
                  </h2>
                  <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {product.description}
                  </p>
                </section>
              )}

              <section aria-labelledby="sizing-standard-heading" className="border-t border-border pt-5">
                <h2
                  id="sizing-standard-heading"
                  className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-2"
                >
                  Fabric &amp; Care Standard
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {AUTHORITATIVE_SIZING_NOTE}
                </p>
              </section>

              <section aria-labelledby="delivery-payment-heading" className="border-t border-border pt-5">
                <h2
                  id="delivery-payment-heading"
                  className="font-mono text-xs font-bold uppercase tracking-wider text-foreground mb-2"
                >
                  Delivery &amp; Customer Care
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Delivery progress is available in Order Tracking after checkout. Need assistance with sizing or tracking?{" "}
                  <Link
                    href="/account/support"
                    className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
                  >
                    Contact Support
                  </Link>
                </p>
              </section>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}
