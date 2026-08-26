import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";
import { SearchIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: {
  searchParams?: Promise<{ q?: string; category?: string; sort?: "newest" | "price_asc" | "price_desc" }>;
}) {
  const searchParams = await props.searchParams;
  const search = searchParams?.q || "";
  const categorySlug = searchParams?.category || "";
  const sort = searchParams?.sort || "newest";

  const categories = await getCategories();
  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;

  const products = await getProducts({
    categoryId: activeCategory?.id,
    search: search || undefined,
    sort: sort,
  });

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="admin-page-header" style={{ marginBottom: "2rem" }}>
          <p className="eyebrow">1968 Clothing Collection</p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.6rem)", fontWeight: 800 }}>
            {activeCategory ? activeCategory.name : "All Streetwear Pieces"}
          </h1>
          <p style={{ color: "var(--muted)", maxWidth: "600px", margin: "0.5rem 0 0" }}>
            {activeCategory?.description || "Independent Filipino streetwear. Limited releases, made to be worn."}
          </p>
        </header>

        {/* Collection Controls */}
        <div className="collection-tools">
          <div className="filter-tabs" role="group" aria-label="Category filters">
            <Link href="/products" className={`filter-tab ${!categorySlug ? "active" : ""}`}>
              All ({products.length})
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                className={`filter-tab ${categorySlug === cat.slug ? "active" : ""}`}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          <form method="GET" action="/products" className="search-form">
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: "12px", color: "var(--muted)", pointerEvents: "none" }}>
                <SearchIcon size={16} />
              </div>
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Search pieces..."
                aria-label="Search products"
                style={{ paddingLeft: "36px" }}
              />
            </div>
          </form>
        </div>

        {products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", background: "var(--surface)", borderRadius: "var(--radius)" }}>
            <p className="subtle-text">No pieces found matching your criteria.</p>
            <Link href="/products" className="btn btn-secondary small-btn" style={{ marginTop: "1rem" }}>
              Reset Filters
            </Link>
          </div>
        ) : (
          <section className="product-grid" aria-label="Products">
            {products.map((product) => {
              const imagePath = product.primary_image_path || "/images/1968%20CLOTHING%20V1.webp";

              return (
                <article key={product.id} className="product-card">
                  <Link href={`/products/${product.slug}`} className="product-image-wrap" tabIndex={-1} aria-hidden="true">
                    <Image
                      src={imagePath}
                      alt={product.name}
                      width={400}
                      height={400}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span className="badge new">New</span>
                  </Link>

                  <div className="product-card-body">
                    <h2 className="product-card-title">
                      <Link href={`/products/${product.slug}`}>{product.name}</Link>
                    </h2>
                    {product.description && (
                      <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 1rem", flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {product.description}
                      </p>
                    )}
                    <div className="product-card-prices">
                      <span className="price-current">
                        {formatMinorUnitsToPHP(product.min_price_minor)}
                      </span>
                    </div>
                    <Link href={`/products/${product.slug}`} className="btn btn-secondary small-btn" style={{ width: "100%", justifyContent: "center", gap: "0.4rem" }}>
                      <span>Select Size</span>
                      <ArrowRightIcon size={14} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
