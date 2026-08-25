import { notFound } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP, getProductBySlug } from "@/lib/catalog/queries";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const activePrices = product.variants.map((v) => v.price_minor);
  const minPrice = activePrices.length > 0 ? Math.min(...activePrices) : 0;

  return (
    <main className="catalog-main">
      <div className="catalog-container">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link href="/products">Products</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        <article className="product-detail-card" aria-labelledby="product-title">
          <div className="product-detail-info">
            <p className="eyebrow">Product Details</p>
            <h1 id="product-title">{product.name}</h1>
            <p className="product-detail-price">
              {formatMinorUnitsToPHP(minPrice)}
            </p>

            {product.description && (
              <div className="product-detail-description">
                <p>{product.description}</p>
              </div>
            )}

            {product.options.length > 0 && (
              <section className="product-options" aria-label="Product options">
                {product.options.map((opt) => (
                  <div key={opt.id} className="option-group">
                    <h3 className="option-name">{opt.name}</h3>
                    <div className="option-values">
                      {opt.values.map((val) => (
                        <span key={val.id} className="option-badge">
                          {val.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {product.variants.length > 0 && (
              <section className="product-variants" aria-label="Available variants">
                <h3>Available Variants</h3>
                <ul className="variant-list">
                  {product.variants.map((variant) => (
                    <li key={variant.id} className="variant-item">
                      <span className="variant-title">{variant.name || variant.sku}</span>
                      <span className="variant-sku">SKU: {variant.sku}</span>
                      <span className="variant-price">
                        {formatMinorUnitsToPHP(variant.price_minor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
