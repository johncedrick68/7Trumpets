import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/product-card";
import { CollectionRail } from "@/components/collection-rail";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col">
      <div className="store-container storefront-catalog flex-1 pt-4 pb-16">
        {/* ── 1. Fast Horizontal Collection Rail ─────────────────── */}
        <CollectionRail categories={categories} baseUrl="/products" />

        {/* ── 2. Products Immediately (Zero Hero Obstruction) ─────── */}
        <section aria-labelledby="collection-heading" className="space-y-6">
          <div className="flex items-end justify-between border-b border-border pb-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Archival Streetwear
              </p>
              <h1 id="collection-heading" className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-0.5">
                Current Collection
              </h1>
            </div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-foreground hover:underline underline-offset-4"
            >
              <span>View all {products.length}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="py-20 text-center rounded-none border border-dashed border-border p-8 max-w-lg mx-auto">
              <h2 className="text-lg font-bold text-foreground">Collection coming soon</h2>
              <p className="mt-1 text-sm text-muted-foreground">Archival pieces are being prepared. Check back shortly.</p>
            </div>
          ) : (
            <ul
              className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 lg:grid-cols-4"
              aria-label="Current collection"
            >
              {products.slice(0, 12).map((product, index) => (
                <li key={product.id} className="h-full">
                  <ProductCard
                    product={product}
                    categoryName={product.category_id ? categoryMap[product.category_id] : null}
                    priority={index < 4}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── 3. Restrained Brand Story Below Products ────────────── */}
        <section
          id="story"
          className="mt-16 sm:mt-24 border-t border-border pt-12 pb-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-start"
          aria-labelledby="story-heading"
        >
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Heritage & Ethos
            </p>
            <h2 id="story-heading" className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-1">
              Defend the Culture.
            </h2>
          </div>
          <div className="md:col-span-2 space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Founded on the principles of authenticity and independent craftsmanship, 1968 Clothing creates archival garments designed for the daily journey. Every drop is crafted in limited batches in the Philippines.
            </p>
            <div>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground hover:underline underline-offset-4"
              >
                <span>Explore the full archival catalog</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
