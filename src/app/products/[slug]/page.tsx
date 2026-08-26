import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { addToCart } from "@/lib/cart/actions";
import { formatMinorUnitsToPHP, getProductBySlug } from "@/lib/catalog/queries";
import { ProductPurchaseForm } from "@/components/product-purchase-form";
import { BagIcon } from "@/components/icons";

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
        <nav aria-label="Breadcrumb" style={{ display: "flex", gap: "0.4rem", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-muted)", marginBottom: "1.5rem", textTransform: "uppercase" }}>
          <Link href="/products" style={{ color: "var(--ink-muted)" }}>Collection</Link>
          <span>/</span>
          <span style={{ color: "var(--ink)" }}>{product.name}</span>
        </nav>

        <div className="product-detail-layout">
          {/* Gallery Column */}
          <div>
            <div className="gallery-main-wrap">
              {product.images.length > 0 ? (
                <Image
                  src={
                    product.images[0].storage_path.startsWith("http")
                      ? product.images[0].storage_path
                      : `/images/${product.images[0].storage_path.split("/").pop()}`
                  }
                  alt={product.name}
                  width={600}
                  height={600}
                  priority
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Image
                  src="/images/1968%20CLOTHING%20V1.webp"
                  alt={product.name}
                  width={600}
                  height={600}
                  priority
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>

            {product.images.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem", marginTop: "0.75rem" }}>
                {product.images.slice(0, 4).map((img, idx) => (
                  <div key={img.id || idx} style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)" }}>
                    <Image
                      src={
                        img.storage_path.startsWith("http")
                          ? img.storage_path
                          : `/images/${img.storage_path.split("/").pop()}`
                      }
                      alt={img.alt_text || product.name}
                      width={150}
                      height={150}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Column */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p className="eyebrow">
              Archival Garment
            </p>

            <h1 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, margin: "0 0 0.85rem", letterSpacing: "-0.02em" }}>
              {product.name}
            </h1>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.4rem", fontWeight: 800, color: "var(--ink)", marginBottom: "1.5rem" }}>
              {formatMinorUnitsToPHP(minPrice)}
            </div>

            {product.description && (
              <div style={{ color: "var(--ink-secondary)", fontSize: "14px", lineHeight: 1.7, marginBottom: "1.75rem", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "1rem 0" }}>
                <p style={{ margin: 0 }}>{product.description}</p>
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
              <div style={{ marginTop: "0.5rem" }}>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-muted)", marginBottom: "0.75rem" }}>
                  Select Size &amp; Add to Bag
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {product.variants.map((variant) => (
                    <form key={variant.id} action={addToCart} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 0.85rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)" }}>
                      <input type="hidden" name="variant_id" value={variant.id} />
                      <input type="hidden" name="quantity" value="1" />
                      <div>
                        <strong style={{ fontSize: "13px" }}>{variant.name || variant.sku}</strong>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-muted)" }}>SKU: {variant.sku}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px" }}>{formatMinorUnitsToPHP(variant.price_minor)}</span>
                        <button type="submit" className="btn btn-primary small-btn" style={{ gap: "0.35rem" }}>
                          <BagIcon size={12} />
                          <span>Add to Bag</span>
                        </button>
                      </div>
                    </form>
                  ))}
                </div>
              </div>
            )}

            {/* Specifications Box */}
            <div style={{ marginTop: "2rem", padding: "1rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", display: "flex", flexDirection: "column", gap: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-muted)" }}>
              <div><strong>FABRIC:</strong> 100% Heavyweight Pre-Shrunk Cotton (220-240 GSM)</div>
              <div><strong>PRINT:</strong> Archival High-Density Plastisol Screenprint</div>
              <div><strong>SHIPPING:</strong> Metro Manila 2-3 business days · Provincial 3-6 business days</div>
              <div><strong>PAYMENTS:</strong> Doorstep Cash on Delivery (COD) · Manual GCash</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
