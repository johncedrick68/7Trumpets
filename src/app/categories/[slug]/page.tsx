import { notFound } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP, getCategories, getCategoryBySlug, getProducts } from "@/lib/catalog/queries";

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
    <main className="catalog-main">
      <div className="catalog-container">
        <header className="catalog-header">
          <p className="eyebrow">Category</p>
          <h1>{category.name}</h1>
          {category.description && (
            <p className="summary">{category.description}</p>
          )}
        </header>

        {categories.length > 0 && (
          <nav className="category-nav" aria-label="Product categories">
            <Link href="/products" className="category-pill">
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className={`category-pill ${cat.id === category.id ? "active" : ""}`}
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        )}

        {products.length === 0 ? (
          <section className="catalog-empty">
            <p>No products found in this category.</p>
          </section>
        ) : (
          <section className="product-grid" aria-label={`Products in ${category.name}`}>
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
