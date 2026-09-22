import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Truck, Sparkles, MapPin } from "lucide-react";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";

import { getStoreSetting } from "@/lib/settings/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products, heroSetting] = await Promise.all([
    getCategories(),
    getProducts(),
    getStoreSetting("hero", {
      title: "Wear the legacy.\nMove the culture.",
      subtitle: "Limited-run garments shaped by community, heritage, and the streets of Manila. Heavyweight custom cotton with archival screenprint artwork.",
      cta_text: "Explore Collection",
      cta_link: "/products",
    }),
  ]);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <main id="main-content" className="flex flex-col min-h-screen">
      {/* ── Editorial Hero ─────────────────────────────────────────── */}
      <section className="border-b border-border bg-background py-16 sm:py-20 lg:py-24" aria-labelledby="hero-title">
        <div className="store-container text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
            01 / Drop 01 Archive
          </p>

          <div className="mx-auto my-6 max-w-[420px] px-4">
            <Image
              src="/images/1968%20Clothing%20Banner%20transparent.png"
              alt="1968 Clothing"
              width={500}
              height={120}
              priority
              sizes="(max-width: 768px) 85vw, 420px"
              className="w-full h-auto object-contain"
            />
          </div>

          <h1 id="hero-title" className="text-hero text-foreground max-w-2xl mx-auto whitespace-pre-line">
            {heroSetting.title}
          </h1>

          <p className="mt-5 text-body text-muted-foreground max-w-xl mx-auto">
            {heroSetting.subtitle}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button asChild size="lg" className="h-12 px-8 font-semibold bg-primary text-primary-foreground rounded-full">
              <Link href={heroSetting.cta_link || "/products"} className="flex items-center gap-2">
                <span>{heroSetting.cta_text || "Explore Collection"}</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 font-semibold rounded-full">
              <Link href="#story">
                Our Story
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Brand Trust & Value Propositions ───────────────────────── */}
      <section className="border-b border-border bg-muted/30" aria-label="Brand Qualities">
        <div className="store-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-background border border-border text-foreground shrink-0">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">01 — Limited Releases</p>
                <p className="text-xs text-muted-foreground mt-0.5">Archival numbered runs</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-background border border-border text-foreground shrink-0">
                <MapPin className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">02 — Manila Heritage</p>
                <p className="text-xs text-muted-foreground mt-0.5">Rooted in street culture</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-background border border-border text-foreground shrink-0">
                <Truck className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">03 — Doorstep Delivery</p>
                <p className="text-xs text-muted-foreground mt-0.5">Secure COD &amp; GCash</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-background border border-border text-foreground shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">04 — Guaranteed Official</p>
                <p className="text-xs text-muted-foreground mt-0.5">100% genuine craftsmanship</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Curated Releases ───────────────────────────────────────── */}
      <div className="store-container store-page flex-1">
        <section aria-labelledby="collection-heading">
          <nav aria-label="Shop by category" className="mb-8 flex gap-2 overflow-x-auto border-b border-border pb-4">
            <Link href="/products" className="category-filter" aria-current="page">All</Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`} className="category-filter">
                {category.name}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-border pb-6">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Current Release
              </p>
              <h2 id="collection-heading" className="mt-1 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                Drop 01 Pieces
              </h2>
            </div>

            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground hover:text-muted-foreground transition-colors"
            >
              <span>View all {products.length} pieces</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Product Grid */}
          {products.length === 0 ? (
            <div className="py-20 text-center rounded-xl border border-dashed border-border bg-muted/20 p-8">
              <p className="font-bold text-foreground text-base mb-1">
                Archival Releases Loading
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Our Drop 01 streetwear archive is currently being prepared. Check back shortly or read our story below.
              </p>
              <Button asChild variant="outline">
                <Link href="/products">Browse Catalog</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4">
              {products.slice(0, 4).map((product, index) => {
                const imagePath = product.primary_image_path || "/images/1968%20CLOTHING%20V1.webp";
                const categoryName = product.category_id ? categoryMap[product.category_id] : null;

                return (
                  <article key={product.id} className="group flex flex-col">
                    <Link
                      href={`/products/${product.slug}`}
                      className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-neutral-100 transition-colors active:border-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group-hover:border-foreground/40 dark:bg-neutral-900"
                      aria-label={product.name}
                    >
                      <Image
                        src={imagePath}
                        alt={product.name}
                        fill
                        sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, 46vw"
                        priority={index < 4}
                        className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transform-none"
                      />
                      {categoryName && (
                        <span className="absolute top-2.5 left-2.5 bg-neutral-950 text-white font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-xs">
                          {categoryName}
                        </span>
                      )}
                    </Link>

                    <div className="mt-3 flex flex-col">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-1">
                        <Link href={`/products/${product.slug}`} className="hover:underline underline-offset-4">
                          {product.name}
                        </Link>
                      </h3>
                      <p className="mt-1 font-mono text-sm font-bold text-foreground">
                        {formatMinorUnitsToPHP(product.min_price_minor)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Brand Heritage Story ────────────────────────────────── */}
        <section
          id="story"
          className="mt-20 sm:mt-28 rounded-2xl border border-border bg-muted/40 p-8 sm:p-12 lg:p-16 text-center"
          aria-labelledby="story-heading"
        >
          <div className="max-w-2xl mx-auto">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Heritage &amp; Identity
            </p>
            <h2 id="story-heading" className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-foreground">
              Built by the culture.<br />Worn by the community.
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
              1968 is not merely a label—it embodies principles of resilience, brotherhood, and creative independence. Every garment is engineered for the daily journey, crafted to carry heritage across every avenue.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11 px-6 font-semibold bg-primary text-primary-foreground rounded-full">
                <Link href="/products" className="flex items-center gap-2">
                  <span>Shop the Collection</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-6 font-semibold rounded-full">
                <Link href="/orders">
                  Track Existing Order
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
