import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getCategories, getCategoryBySlug, getProducts } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ]);

  if (!category) {
    notFound();
  }

  const products = await getProducts({ categoryId: category.id });

  return (
    <main className="store-container store-page min-h-screen">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <header className="mb-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Collection
        </p>
        <h1 className="mt-1.5 text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-muted-foreground max-w-2xl text-sm leading-relaxed">
            {category.description}
          </p>
        )}
      </header>

      {/* ── Category Pills ───────────────────────────────────────── */}
      {categories.length > 0 && (
        <div
          className="mb-8 flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Category filters"
        >
          <Link
            href="/products"
            className="shrink-0 rounded-full border border-border bg-transparent px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className={`shrink-0 rounded-full border px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                cat.id === category.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
              aria-current={cat.id === category.id ? "true" : undefined}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-muted/20 p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            No products found in this collection
          </p>
          <Button asChild variant="outline">
            <Link href="/products">
              Explore All Drops &rarr;
            </Link>
          </Button>
        </div>
      ) : (
        /* ── Product Grid ────────────────────────────────────────── */
        <section
          className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4"
          aria-label={`Products in ${category.name}`}
        >
          {products.map((product, index) => {
            const imagePath = product.primary_image_path || "/images/1968%20CLOTHING%20V1.webp";

            return (
              <article key={product.id} className="group flex flex-col">
                <Link
                  href={`/products/${product.slug}`}
                  className="relative block aspect-[4/5] w-full overflow-hidden bg-muted rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`View ${product.name}`}
                >
                  <Image
                    src={imagePath}
                    alt={product.name}
                    fill
                    priority={index < 4}
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, 46vw"
                    className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="absolute top-2.5 left-2.5 bg-neutral-950/90 text-white font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-xs">
                    {category.name}
                  </span>
                </Link>

                <div className="mt-3 flex flex-col">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground line-clamp-1">
                    <Link href={`/products/${product.slug}`} className="hover:underline underline-offset-4">
                      {product.name}
                    </Link>
                  </h2>
                  <p className="mt-1 font-mono text-sm font-bold text-foreground">
                    {formatMinorUnitsToPHP(product.min_price_minor)}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

