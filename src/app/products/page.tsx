import Link from "next/link";
import { getCategories, getProducts, type Category } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/product-card";
import { CollectionRail } from "@/components/collection-rail";
import { CatalogSearch } from "@/components/catalog-search";
import { CatalogFilters } from "@/components/catalog-filters";

export const dynamic = "force-dynamic";

function buildCatalogUrl(params: {
  category?: string;
  sort?: string;
  q?: string;
  availability?: string;
}) {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.q) sp.set("q", params.q);
  if (params.sort && params.sort !== "newest") sp.set("sort", params.sort);
  if (params.availability && params.availability !== "all") sp.set("availability", params.availability);
  const qs = sp.toString();
  return qs ? `/products?${qs}` : "/products";
}

export default async function ProductsPage(props: {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
    availability?: "all" | "in_stock";
  }>;
}) {
  const searchParams = await props.searchParams;
  const search = searchParams?.q?.trim() || "";
  const categorySlug = searchParams?.category || "";
  const sort = searchParams?.sort || "newest";
  const availability = searchParams?.availability || "all";

  const categories: Category[] = await getCategories();
  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;

  const products = await getProducts({
    categoryId: activeCategory?.id,
    search: search || undefined,
    sort: sort,
    availability: availability,
  });

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  // Retail product count formatting
  const countLabel = `${products.length} ${products.length === 1 ? "product" : "products"}`;

  return (
    <main id="main-content" tabIndex={-1} className="store-container catalog-page min-h-screen pt-4 pb-20">
      {/* ── 1. Retail Page Header & Search ────────────────────────── */}
      <header className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Collection
            </p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mt-0.5">
              {activeCategory ? activeCategory.name : "All Products"}
            </h1>
          </div>
          <div aria-live="polite" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {countLabel}
          </div>
        </div>

        {activeCategory?.description && (
          <p className="mt-2 text-xs text-muted-foreground max-w-2xl leading-relaxed">
            {activeCategory.description}
          </p>
        )}
      </header>

      {/* ── 2. Integrated Search Bar ──────────────────────────────── */}
      <div className="mb-6">
        <CatalogSearch query={search} category={categorySlug} sort={sort} availability={availability} />
      </div>

      {/* ── 3. Collection Rail ────────────────────────────────────── */}
      <CollectionRail
        categories={categories}
        activeSlug={categorySlug}
        baseUrl="/products"
        preserveParams={{ sort, q: search, availability }}
      />

      {/* ── 4. Retail Filter & Sort Toolbar ───────────────────────── */}
      <CatalogFilters
        categorySlug={categorySlug}
        search={search}
        sort={sort}
        availability={availability}
      />

      {/* ── 5. Active Filters Pills ───────────────────────────────── */}
      {(search || availability === "in_stock" || categorySlug) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground uppercase tracking-wider mr-1">Active filters:</span>
          {categorySlug && activeCategory && (
            <span className="inline-flex items-center gap-1.5 rounded-none border border-border bg-muted/30 px-2.5 py-1 text-foreground">
              <span>Category: {activeCategory.name}</span>
              <Link
                href={buildCatalogUrl({ sort, q: search, availability })}
                className="text-muted-foreground hover:text-foreground font-bold"
                aria-label={`Remove category filter ${activeCategory.name}`}
              >
                ✕
              </Link>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1.5 rounded-none border border-border bg-muted/30 px-2.5 py-1 text-foreground">
              <span>Query: “{search}”</span>
              <Link
                href={buildCatalogUrl({ category: categorySlug, sort, availability })}
                className="text-muted-foreground hover:text-foreground font-bold"
                aria-label="Remove search query filter"
              >
                ✕
              </Link>
            </span>
          )}
          {availability === "in_stock" && (
            <span className="inline-flex items-center gap-1.5 rounded-none border border-border bg-muted/30 px-2.5 py-1 text-foreground">
              <span>In stock only</span>
              <Link
                href={buildCatalogUrl({ category: categorySlug, sort, q: search, availability: "all" })}
                className="text-muted-foreground hover:text-foreground font-bold"
                aria-label="Remove in stock filter"
              >
                ✕
              </Link>
            </span>
          )}
          <Link
            href="/products"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground ml-2 uppercase tracking-wider"
          >
            Clear all
          </Link>
        </div>
      )}

      {/* ── 6. Product Grid or Empty State ────────────────────────── */}
      {products.length === 0 ? (
        <div className="py-20 text-center rounded-none border border-dashed border-border p-8 max-w-lg mx-auto">
          {search ? (
            <>
              <p className="text-base font-bold text-foreground mb-1">
                No products found for “{search}”
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Check for spelling or try searching for another term.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={buildCatalogUrl({ category: categorySlug, sort, availability })}
                  className="inline-flex items-center justify-center min-h-11 px-5 border border-border font-mono text-xs uppercase tracking-wider hover:bg-muted"
                >
                  Clear search
                </Link>
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center min-h-11 px-5 bg-black text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800"
                >
                  Browse all products
                </Link>
              </div>
            </>
          ) : availability === "in_stock" ? (
            <>
              <p className="text-base font-bold text-foreground mb-1">
                No in-stock pieces currently match your selection
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                All pieces in this view are currently out of stock. You can browse the full archival release catalog.
              </p>
              <Link
                href={buildCatalogUrl({ category: categorySlug, sort, q: search, availability: "all" })}
                className="inline-flex items-center justify-center min-h-11 px-5 bg-black text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800"
              >
                Show all products (including out of stock)
              </Link>
            </>
          ) : (
            <>
              <p className="text-base font-bold text-foreground mb-1">
                No products found in this collection
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                This collection is being prepared for upcoming drops.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center justify-center min-h-11 px-5 bg-black text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800"
              >
                Browse all products
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul
          className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3 lg:grid-cols-4"
          aria-label="Products"
        >
          {products.map((product, index) => (
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
    </main>
  );
}
