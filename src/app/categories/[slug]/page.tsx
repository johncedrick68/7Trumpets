import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategories, getCategoryBySlug, getProducts } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/product-card";
import { CollectionRail } from "@/components/collection-rail";

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
  const countLabel = `${products.length} ${products.length === 1 ? "product" : "products"}`;

  return (
    <main id="main-content" tabIndex={-1} className="store-container catalog-page min-h-screen pt-4 pb-20">
      {/* ── 1. Page Header ───────────────────────────────────────── */}
      <header className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Collection
            </p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mt-0.5">
              {category.name}
            </h1>
          </div>
          <div aria-live="polite" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {countLabel}
          </div>
        </div>

        {category.description && (
          <p className="mt-2 text-xs text-muted-foreground max-w-2xl leading-relaxed">
            {category.description}
          </p>
        )}
      </header>

      {/* ── 2. Collection Rail ────────────────────────────────────── */}
      <CollectionRail
        categories={categories}
        activeSlug={category.slug}
        baseUrl="/products"
      />

      {/* ── 3. Product Grid or Empty State ────────────────────────── */}
      {products.length === 0 ? (
        <div className="py-20 text-center rounded-none border border-dashed border-border p-8 max-w-lg mx-auto">
          <p className="text-base font-bold text-foreground mb-1">
            No products found in this collection
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            This collection is currently being prepared for upcoming releases.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center min-h-11 px-5 bg-black text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800"
          >
            Explore all products
          </Link>
        </div>
      ) : (
        <ul
          className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 lg:grid-cols-4"
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
