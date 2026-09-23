import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategories, getCategoryBySlug, getProducts } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";

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
    <main id="main-content" tabIndex={-1} className="store-container store-page min-h-screen">
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
        <nav aria-label="Collections" className="mb-8">
          <div
            className="flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Category filters"
          >
            <Link
              href="/products"
              className="shrink-0 rounded-full border border-border bg-transparent px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              All Pieces
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className={`shrink-0 rounded-full border px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  cat.id === category.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
                aria-current={cat.id === category.id ? "page" : undefined}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* ── Result Count ─────────────────────────────────────────── */}
      <div className="mb-6 font-mono text-xs uppercase tracking-wider text-muted-foreground border-b border-border pb-4">
        {products.length} {products.length === 1 ? "piece" : "pieces"} in {category.name}
      </div>

      {/* ── Empty State ──────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-muted/20 p-8 max-w-lg mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            No products found in this collection
          </p>
          <Button asChild variant="outline" className="h-11 px-5 font-mono text-xs uppercase tracking-wider">
            <Link href="/products">
              Explore All Drops &rarr;
            </Link>
          </Button>
        </div>
      ) : (
        /* ── Product Grid ────────────────────────────────────────── */
        <ul
          className="product-grid grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4"
          aria-label={`Products in ${category.name}`}
        >
          {products.map((product, index) => (
            <li key={product.id} className="h-full">
              <ProductCard
                product={product}
                categoryName={category.name}
                priority={index < 4}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
