import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: {
  searchParams?: Promise<{ q?: string; category?: string; sort?: "newest" | "price_asc" | "price_desc" }>;
}) {
  const searchParams = await props.searchParams;
  const search = searchParams?.q || "";
  const categorySlug = searchParams?.category || "";
  const sort = searchParams?.sort || "newest";

  const categories = await getCategories();
  const activeCategory = categorySlug ? categories.find(c => c.slug === categorySlug) : undefined;

  const products = await getProducts({
    categoryId: activeCategory?.id,
    search: search || undefined,
    sort: sort,
  });

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">7Trumpets Catalog</p>
          <h1>{activeCategory ? activeCategory.name : "All Products"}</h1>
          <p className="summary">
            {activeCategory?.description || "Faith-driven garments, accessories, and devotional items."}
          </p>
        </header>

        {/* Search and Sort controls */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem" }}>
          <form method="GET" action="/products" style={{ display: "flex", gap: "0.5rem", flex: 1, maxWidth: "400px" }}>
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Search products..."
              style={{ flex: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border)" }}
            />
            <button type="submit" className="button button-primary" style={{ padding: "0.5rem 1rem" }}>
              Search
            </button>
          </form>

          <form method="GET" action="/products" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {search && <input type="hidden" name="q" value={search} />}
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            <label htmlFor="sort-select" className="small-text">Sort by:</label>
            <select
              id="sort-select"
              name="sort"
              defaultValue={sort}
              style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border)" }}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
            <button type="submit" className="button button-secondary">Apply</button>
          </form>
        </div>

        {categories.length > 0 && (
          <nav className="category-nav" aria-label="Product categories" style={{ marginBottom: "1.5rem" }}>
            <Link href="/products" className={`category-pill ${!categorySlug ? "active" : ""}`}>
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                className={`category-pill ${categorySlug === cat.slug ? "active" : ""}`}
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        )}

        {products.length === 0 ? (
          <section className="catalog-empty">
            <p>No products found matching your selection.</p>
          </section>
        ) : (
          <section className="product-grid" aria-label="Products">
            {products.map((product) => (
              <article key={product.id} className="product-card">
                {product.primary_image_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.primary_image_path} alt="" className="product-card-image" />
                )}
                <div className="product-card-body">
                  <h2 className="product-title">
                    <Link href={`/products/${product.slug}`}>{product.name}</Link>
                  </h2>
                  {product.description && (
                    <p className="product-description">{product.description}</p>
                  )}
                  <p className="product-price">
                    {formatMinorUnitsToPHP(product.min_price_minor)}
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
