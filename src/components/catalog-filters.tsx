"use client";

interface CatalogFiltersProps {
  categorySlug?: string;
  search?: string;
  sort: string;
  availability: string;
}

export function CatalogFilters({
  categorySlug,
  search,
  sort,
  availability,
}: CatalogFiltersProps) {

  function updateQuery(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (categorySlug) sp.set("category", categorySlug);
    if (search) sp.set("q", search);
    for (const [key, val] of Object.entries(updates)) {
      if (val && val !== "all" && val !== "newest") {
        sp.set(key, val);
      } else {
        sp.delete(key);
      }
    }
    const qs = sp.toString();
    const dest = qs ? `/products?${qs}` : "/products";
    if (typeof window !== "undefined") {
      window.location.assign(dest);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-y border-border py-3">
      {/* Availability Toggle */}
      <form
        method="GET"
        action="/products"
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="flex items-center gap-2"
      >
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        {search && <input type="hidden" name="q" value={search} />}
        {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}

        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            name="availability"
            value="in_stock"
            checked={availability === "in_stock"}
            onChange={(e) => {
              updateQuery({ availability: e.target.checked ? "in_stock" : undefined });
            }}
            className="size-4 rounded-none border-border accent-foreground cursor-pointer"
          />
          <span className="font-mono text-xs uppercase tracking-wider text-foreground">
            In stock only
          </span>
        </label>
      </form>

      {/* Sort Dropdown */}
      <form
        method="GET"
        action="/products"
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="flex items-center gap-2"
      >
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        {search && <input type="hidden" name="q" value={search} />}
        {availability !== "all" && <input type="hidden" name="availability" value={availability} />}

        <label
          htmlFor="catalog-sort"
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap"
        >
          Sort by
        </label>
        <select
          id="catalog-sort"
          name="sort"
          value={sort}
          onChange={(e) => {
            updateQuery({ sort: e.target.value });
          }}
          className="h-9 rounded-none border border-border bg-background px-3 py-1 font-mono text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-foreground"
        >
          <option value="newest">Featured / Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name_asc">Alphabetical, A–Z</option>
        </select>
      </form>
    </div>
  );
}
