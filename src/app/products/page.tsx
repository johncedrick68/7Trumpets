import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">7Trumpets Catalog</p>
          <h1>All Products</h1>
          <p className="summary">
            Faith-driven garments, accessories, and devotional items.
          </p>
        </header>

        {categories.length > 0 && (
          <nav className="category-nav" aria-label="Product categories">
            <Link href="/products" className="category-pill active">
              All
            </Link>
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
        )}

        {products.length === 0 ? (
          <section className="catalog-empty">
            <p>No products are currently published in the catalog.</p>
          </section>
        ) : (
          <section className="product-grid" aria-label="Products">
            {products.map((product) => (
              <article key={product.id} className="product-card">
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
