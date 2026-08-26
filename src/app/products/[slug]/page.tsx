import { notFound } from "next/navigation";
import Link from "next/link";
import { formatMinorUnitsToPHP, getProductBySlug } from "@/lib/catalog/queries";
import { addToCart } from "@/lib/cart/actions";
import { ProductPurchaseForm } from "@/components/product-purchase-form";

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
          {product.images.length > 0 && (
            <div className="product-image-list">
              {product.images.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={image.id} src={image.storage_path} alt={image.alt_text} className="product-detail-image" />
              ))}
            </div>
          )}
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
              <ProductPurchaseForm
                options={product.options}
                variants={product.variants.map((variant) => ({
                  ...variant,
                  formatted_price: formatMinorUnitsToPHP(variant.price_minor),
                }))}
              />
            )}

            {product.options.length === 0 && product.variants.length > 0 && (
              <section className="product-variants" aria-label="Available variants">
                <h3>Available Variants</h3>
                <ul className="variant-list">
                  {product.variants.map((variant) => (
                    <li key={variant.id} className="variant-item">
                      <div className="variant-info">
                        <span className="variant-title">{variant.name || variant.sku}</span>
                        <span className="variant-sku">SKU: {variant.sku}</span>
                        <span className="variant-price">
                          {formatMinorUnitsToPHP(variant.price_minor)}
                        </span>
                      </div>
                      <form action={addToCart} className="variant-add-form">
                        <input type="hidden" name="variant_id" value={variant.id} />
                        <input type="hidden" name="quantity" value="1" />
                        <button type="submit" className="button-link small-btn">
                          Add to Cart
                        </button>
                      </form>
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
