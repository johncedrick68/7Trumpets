import { notFound } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getProductBySlug } from "@/lib/catalog/queries";
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
    <main className="store-container store-page min-h-screen">
      <div className="w-full">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-8">
          <Link href="/products" className="hover:text-foreground transition-colors">Collection</Link>
          <span>/</span>
          <span className="text-foreground font-bold">{product.name}</span>
        </nav>

        {/* Mobile-only header — shown above gallery on small screens */}
        <header className="mb-5 lg:hidden">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {categoryName}
          </p>
          <h1 className="mt-2 text-h2 text-foreground">
            {product.name}
          </h1>
          <p className="mt-3 text-h3 text-foreground">
            {formattedPrice}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)] lg:gap-16 xl:gap-20">

          {/* ── Gallery Column ────────────────────────────────── */}
          <ProductGallery
            productName={product.name}
            images={(product.images.length > 0 ? product.images : [{ id: "fallback", storage_path: "/images/1968%20CLOTHING%20V1.0.webp", alt_text: product.name, position: 0, variant_id: null }]).map((image) => ({ id: image.id, url: image.storage_path, alt: image.alt_text || product.name, position: image.position, variantId: image.variant_id }))}
          />

          {/* ── Info Column ──────────────────────────────────── */}
          <div className="flex w-full min-w-0 flex-col lg:sticky lg:top-24 lg:self-start">

            {/* Desktop-only product identity — hidden on mobile (shown above gallery) */}
            <div className="hidden lg:block">
              {/* eyebrow → title: 8px */}
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {categoryName}
              </p>
              {/* title */}
              <h1 className="mt-2 text-h1 text-foreground">
                {product.name}
              </h1>
              {/* title → price: 12px */}
              <p className="mt-3 text-h2 text-foreground">
                {formattedPrice}
              </p>
              {/* price → description: 12–16px */}
              {product.description && (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              )}
            </div>

            {/* description → size block: 32px */}
            {product.variants.length > 0 && (
              <div className="mt-8 lg:mt-8">
                <ProductPurchaseForm
                  options={product.options}
                  variants={product.variants.map((variant) => ({
                    ...variant,
                    formatted_price: formatMinorUnitsToPHP(variant.price_minor),
                  }))}
                />
              </div>
            )}

            {/* Add to Bag → product information: 32px */}
            <div className="mt-8 grid gap-6 border-t border-border pt-6 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <section aria-labelledby="product-details-heading">
                <h2 id="product-details-heading" className="font-semibold text-foreground">
                  Product Details
                </h2>
                {product.description && <p className="mt-2 leading-relaxed lg:hidden">{product.description}</p>}
                <ul className="mt-2 space-y-1.5 leading-relaxed">
                  <li>Heavyweight pre-shrunk cotton, 220–240 GSM</li>
                  <li>High-density plastisol screenprint</li>
                </ul>
              </section>
              <section aria-labelledby="delivery-payment-heading">
                <h2 id="delivery-payment-heading" className="font-semibold text-foreground">
                  Delivery &amp; Payment
                </h2>
                <ul className="mt-2 space-y-1.5 leading-relaxed">
                  <li>Metro Manila 2–3 days; provincial 3–6 days</li>
                  <li>Cash on Delivery or manually verified GCash</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
