import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getProductBySlug } from "@/lib/catalog/queries";
import { addToCart } from "@/lib/cart/actions";
import { ProductPurchaseForm } from "@/components/product-purchase-form";
import { BagIcon, TruckIcon, ShieldCheckIcon, SparklesIcon, CheckIcon } from "@/components/icons";

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
        <nav aria-label="Breadcrumb" style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
          <Link href="/products" style={{ color: "var(--muted)" }}>Collection</Link>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginTop: "1rem" }}>
                {product.images.slice(0, 4).map((img, idx) => (
                  <div key={img.id || idx} style={{ borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--line)", background: "var(--surface)" }}>
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
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--accent-soft)", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
              <SparklesIcon size={14} />
              <span>Authentic 1968 Drop</span>
            </div>

            <h1 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, margin: "0 0 1rem" }}>
              {product.name}
            </h1>

            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--ink)", marginBottom: "1.5rem" }}>
              {formatMinorUnitsToPHP(minPrice)}
            </div>

            {product.description && (
              <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "2rem", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "1.25rem 0" }}>
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
              <div style={{ marginTop: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", marginBottom: "0.75rem" }}>
                  Select Size &amp; Add to Bag
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {product.variants.map((variant) => (
                    <form key={variant.id} action={addToCart} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                      <input type="hidden" name="variant_id" value={variant.id} />
                      <input type="hidden" name="quantity" value="1" />
                      <div>
                        <strong>{variant.name || variant.sku}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>SKU: {variant.sku}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontWeight: 700 }}>{formatMinorUnitsToPHP(variant.price_minor)}</span>
                        <button type="submit" className="btn btn-primary small-btn" style={{ gap: "0.4rem" }}>
                          <BagIcon size={14} />
                          <span>Add to Bag</span>
                        </button>
                      </div>
                    </form>
                  ))}
                </div>
              </div>
            )}

            {/* Quality & Delivery Assurance Card */}
            <div style={{ marginTop: "2.5rem", padding: "1.25rem", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
                <TruckIcon size={18} style={{ color: "var(--accent-soft)" }} />
                <span><strong>Nationwide Shipping:</strong> 2-4 days NCR, 3-7 days Provincial</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
                <CheckIcon size={18} style={{ color: "#34d399" }} />
                <span><strong>Doorstep COD &amp; GCash:</strong> Safe payment upon arrival or instant QR</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem" }}>
                <ShieldCheckIcon size={18} style={{ color: "var(--accent-soft)" }} />
                <span><strong>Guaranteed Quality:</strong> 100% Cotton, High-Density Screenprint</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
