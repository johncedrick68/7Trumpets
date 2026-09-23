import Link from "next/link";
import { getCategories, getProducts, type Category } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { CatalogSearch } from "@/components/catalog-search";

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

  // Category name lookup for card eyebrows
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  // Result count formatting
  const countLabel = search
    ? `${products.length} ${products.length === 1 ? "result" : "results"} for “${search}”`
    : activeCategory
    ? `${products.length} ${products.length === 1 ? "piece" : "pieces"} in ${activeCategory.name}`
    : `${products.length} ${products.length === 1 ? "piece" : "pieces"}`;

  return (
    <main id="main-content" tabIndex={-1} className="store-container catalog-page min-h-screen">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <header className="catalog-page-header">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Shop
        </p>
        <h1 className="mt-1.5 text-h1 text-foreground">
          {activeCategory ? activeCategory.name : "1968 Collection"}
        </h1>
        {activeCategory?.description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {activeCategory.description}
          </p>
        )}
      </header>

      {/* ── Search Bar ───────────────────────────────────────────── */}
      <CatalogSearch query={search} category={categorySlug} sort={sort} availability={availability} />

      {/* ── Category Navigation Pills ────────────────────────────── */}
      <nav aria-label="Catalog collections" className="catalog-rail mb-6">
        <div
          className="flex w-full flex-nowrap gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Category filters"
        >
          <Link
            href={buildCatalogUrl({ sort, q: search, availability })}
            className={`catalog-rail-link ${
              !categorySlug
                ? "is-active"
                : ""
            }`}
            aria-current={!categorySlug ? "page" : undefined}
          >
            All Pieces
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildCatalogUrl({ category: cat.slug, sort, q: search, availability })}
              className={`catalog-rail-link ${
                categorySlug === cat.slug
                  ? "is-active"
                  : ""
              }`}
              aria-current={categorySlug === cat.slug ? "page" : undefined}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── Controls Row: Result Count + Filter + Sort ────────────── */}
      <div className="mb-8 flex flex-col items-stretch gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        {/* Result Count with polite announcement */}
        <div aria-live="polite" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {countLabel}
        </div>

        {/* Filter & Sort Controls */}
        <form
          method="GET"
          action="/products"
          className="flex flex-wrap items-center gap-3 sm:gap-4"
        >
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
          {search && <input type="hidden" name="q" value={search} />}

          {/* Availability Filter */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="catalog-availability"
              name="availability"
              value="in_stock"
              defaultChecked={availability === "in_stock"}
              className="size-4.5 rounded border-border accent-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label
              htmlFor="catalog-availability"
              className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground cursor-pointer select-none"
            >
              In stock only
            </label>
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="catalog-sort"
              className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
            >
              Sort by
            </label>
            <select
              id="catalog-sort"
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-md border border-border bg-background px-3 py-1 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A–Z</option>
            </select>
          </div>

          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-10 px-4 font-mono text-[11px] uppercase tracking-wider"
          >
            Apply
          </Button>
        </form>
      </div>

      {/* ── Active Filters Bar (when filter or search active) ─────── */}
      {(search || availability === "in_stock") && (
        <div className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="text-muted-foreground uppercase tracking-wider mr-1">Active filters:</span>
          {search && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-foreground">
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-foreground">
              <span>In stock only</span>
              <Link
                href={buildCatalogUrl({ category: categorySlug, sort, q: search, availability: "all" })}
                className="text-muted-foreground hover:text-foreground font-bold"
                aria-label="Remove in stock availability filter"
              >
                ✕
              </Link>
            </span>
          )}
          <Link
            href={buildCatalogUrl({ category: categorySlug, sort })}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground ml-2"
          >
            Clear all
          </Link>
        </div>
      )}

      {/* ── Empty States & Product Grid ──────────────────────────── */}
      {products.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-muted/20 p-8 max-w-lg mx-auto">
          {search ? (
            <>
              <p className="text-base font-semibold text-foreground mb-1">
                No pieces found for “{search}”
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Try searching with different terms or check for spelling errors.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild variant="outline" className="h-11 px-5 font-mono text-xs uppercase tracking-wider">
                  <Link href={buildCatalogUrl({ category: categorySlug, sort, availability })}>
                    Clear search
                  </Link>
                </Button>
                <Button asChild className="h-11 px-5 font-mono text-xs uppercase tracking-wider">
                  <Link href="/products">
                    Browse all pieces
                  </Link>
                </Button>
              </div>
            </>
          ) : availability === "in_stock" ? (
            <>
              <p className="text-base font-semibold text-foreground mb-1">
                No in-stock pieces currently match your selection
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                All pieces in this view are currently out of stock. You can view all archival releases.
              </p>
              <Button asChild className="h-11 px-5 font-mono text-xs uppercase tracking-wider">
                <Link href={buildCatalogUrl({ category: categorySlug, sort, q: search, availability: "all" })}>
                  Show all pieces (including out of stock)
                </Link>
              </Button>
            </>
          ) : activeCategory ? (
            <>
              <p className="text-base font-semibold text-foreground mb-1">
                No pieces currently in {activeCategory.name}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                This collection is being prepared for upcoming drops. Explore other pieces from our catalog.
              </p>
              <Button asChild className="h-11 px-5 font-mono text-xs uppercase tracking-wider">
                <Link href="/products">
                  Browse all pieces
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-foreground mb-1">
                No products found
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                No catalog pieces match your current filters.
              </p>
              <Button asChild className="h-11 px-5 font-mono text-xs uppercase tracking-wider">
                <Link href="/products">
                  Reset filters
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        /* ── Product Grid ────────────────────────────────────────── */
        <ul
          className="product-grid grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4"
          aria-label="Products"
        >
          {products.map((product, index) => {
            const categoryName = product.category_id ? categoryMap[product.category_id] : null;

            return (
              <li key={product.id} className="h-full">
                <ProductCard
                  product={product}
                  categoryName={categoryName}
                  priority={index < 4}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
