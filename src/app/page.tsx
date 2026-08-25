import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featuredProducts] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="hero-section">
          <p className="eyebrow">Faith-Driven Commerce</p>
          <h1>7Trumpets</h1>
          <p className="summary">
            Authentic garments, accessories, and devotional items.
          </p>
          <div className="hero-actions">
            <Link href="/products" className="button-link">
              Browse All Products
            </Link>
            <Link href="/account" className="button-link secondary">
              My Account
            </Link>
          </div>
        </header>

        {categories.length > 0 && (
          <section className="categories-section" aria-labelledby="cat-heading">
            <h2 id="cat-heading" className="section-title">Categories</h2>
            <nav className="category-nav" aria-label="Featured categories">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="category-pill"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </section>
        )}

        <section className="products-section" aria-labelledby="featured-heading">
          <div className="section-header">
            <h2 id="featured-heading" className="section-title">Featured Products</h2>
            <Link href="/products" className="view-all-link">View all &rarr;</Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="catalog-empty">
              <p>No products published in the catalog yet.</p>
            </div>
          ) : (
            <div className="product-grid" aria-label="Featured products">
              {featuredProducts.slice(0, 6).map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-card-body">
                    <h3 className="product-title">
                      <Link href={`/products/${product.slug}`}>{product.name}</Link>
                    </h3>
                    {product.description && (
                      <p className="product-description">{product.description}</p>
                    )}
                    <p className="product-price">
                      {formatMinorUnitsToPHP(product.min_price_minor)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
