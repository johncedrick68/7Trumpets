import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories, getProducts } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col">
      <div className="store-container storefront-catalog flex-1">
        <nav aria-label="Shop by category" className="catalog-rail">
          <Link href="/products" className="catalog-rail-link" aria-current="page">All</Link>
          {categories.map((category) => (
            <Link key={category.id} href={`/categories/${category.slug}`} className="catalog-rail-link">
              {category.name}
            </Link>
          ))}
        </nav>

        <section aria-labelledby="collection-heading">
          <div className="catalog-heading">
            <div>
              <p className="catalog-kicker">Current collection</p>
              <h1 id="collection-heading" className="catalog-title">Shop 1968 Clothing</h1>
            </div>
            <Link href="/products" className="catalog-view-all">
              <span>View all {products.length}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="catalog-empty">
              <h2>Collection coming soon</h2>
              <p>Products are being prepared. Check back shortly.</p>
            </div>
          ) : (
            <ul className="product-grid" aria-label="Current collection">
              {products.slice(0, 8).map((product, index) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    categoryName={product.category_id ? categoryMap[product.category_id] : null}
                    priority={index < 4}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="story" className="storefront-story" aria-labelledby="story-heading">
          <p className="catalog-kicker">1968 Clothing</p>
          <h2 id="story-heading">Independent clothing for everyday wear.</h2>
          <p>Explore the current collection, choose your size, and check availability before adding an item to your bag.</p>
          <Link href="/products" className="storefront-story-link">
            Shop the collection <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}
