import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return (
    <>
      {/* Editorial Hero */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-inner">
          <p className="eyebrow" style={{ justifyContent: "center" }}>
            01 / Drop 01 Archive
          </p>

          <div style={{ margin: "1.25rem auto 1.5rem", maxWidth: "500px" }}>
            <Image
              src="/images/1968%20Clothing%20Banner%20transparent.png"
              alt="1968 Clothing"
              width={500}
              height={120}
              priority
              sizes="(max-width: 768px) 90vw, 500px"
              className="hero-banner-img"
              style={{ width: "100%", height: "auto", objectFit: "contain" }}
            />
          </div>

          <h1 id="hero-title" className="hero-title">
            Wear the legacy.<br />Move the culture.
          </h1>
          <p className="hero-intro">
            Limited-run garments shaped by community, history, and the streets we call home. Heavyweight custom cotton with archival screenprint artwork.
          </p>

          <div className="hero-actions">
            <Link href="/products" className="btn btn-primary" style={{ padding: "0.8rem 1.8rem" }}>
              <span>View Collection</span>
              <ArrowRightIcon size={14} />
            </Link>
            <Link href="#story" className="btn btn-secondary">
              Our Story
            </Link>
          </div>
        </div>
      </section>

      {/* Technical Qualities Strip */}
      <div className="trust-strip">
        <div className="trust-item">
          <div>
            <strong>01 — Limited Releases</strong>
            <span>Numbered archival production runs</span>
          </div>
        </div>
        <div className="trust-item">
          <div>
            <strong>02 — Designed in Manila</strong>
            <span>Rooted in Philippine streetwear</span>
          </div>
        </div>
        <div className="trust-item">
          <div>
            <strong>03 — Doorstep Delivery</strong>
            <span>Secure Cash on Delivery &amp; GCash</span>
          </div>
        </div>
        <div className="trust-item">
          <div>
            <strong>04 — Guaranteed Genuine</strong>
            <span>100% Official 1968 merchandise</span>
          </div>
        </div>
      </div>

      <main className="catalog-main">
        <div className="catalog-container">
        {/* Drop 01 Releases */}
        <section aria-labelledby="collection-title">
          <div className="section-header">
            <div>
              <p className="eyebrow">The Current Release</p>
              <h2 id="collection-title" className="section-title">Drop 01 Pieces</h2>
            </div>
            <Link href="/products" className="btn btn-secondary small-btn">
              <span>View All ({products.length})</span>
              <ArrowRightIcon size={12} />
            </Link>
          </div>

          {categories.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.75rem" }}>
              <Link href="/products" className="category-pill active">
                All
              </Link>
              {categories.map((cat) => (
                <Link key={cat.id} href={`/categories/${cat.slug}`} className="category-pill">
                  {cat.name}
                </Link>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3.5rem 1.5rem", background: "var(--surface)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-strong)" }}>
              <p style={{ color: "var(--ink)", fontWeight: 700, fontSize: "15px", marginBottom: "0.35rem" }}>
                Archival Releases Loading
              </p>
              <p style={{ color: "var(--ink-secondary)", fontSize: "13px", maxWidth: "440px", margin: "0 auto" }}>
                Our Drop 01 streetwear archive is currently being prepared. Browse our collection or brand story below.
              </p>
              <Link href="/products" className="btn btn-secondary small-btn" style={{ marginTop: "1rem" }}>
                Browse Catalog &rarr;
              </Link>
            </div>
          ) : (
            <div className="product-grid">
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
                      <h3 className="product-card-title">
                        <Link href={`/products/${product.slug}`}>{product.name}</Link>
                      </h3>
                      {product.description && (
                        <p style={{ fontSize: "13px", color: "var(--ink-muted)", margin: "0 0 0.85rem", flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                          {product.description}
                        </p>
                      )}
                      <div className="product-card-prices">
                        <span className="price-current">
                          {formatMinorUnitsToPHP(product.min_price_minor)}
                        </span>
                      </div>
                      <Link href={`/products/${product.slug}`} className="btn btn-secondary small-btn" style={{ width: "100%", justifyContent: "center" }}>
                        <span>Select Size</span>
                        <ArrowRightIcon size={12} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Story Section */}
        <section id="story" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "clamp(2rem, 5vw, 4rem)", marginTop: "4rem" }}>
          <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
            <p className="eyebrow" style={{ justifyContent: "center" }}>Heritage &amp; Identity</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, margin: "0.5rem 0 1.25rem", letterSpacing: "-0.02em", color: "var(--ink)" }}>
              Built by the culture.<br />Worn by the community.
            </h2>
            <p style={{ fontSize: "15px", color: "var(--ink-secondary)", lineHeight: 1.75, margin: "0 0 2rem" }}>
              1968 is not just a number—it represents principles of brotherhood, resilience, and creative independence. Every release is a wearable statement built for the daily journey, engineered to carry a story across every street.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/products" className="btn btn-primary">
                Shop the Collection &rarr;
              </Link>
              <Link href="/orders" className="btn btn-secondary">
                Track Existing Order
              </Link>
            </div>
          </div>
        </section>
        </div>
      </main>
    </>
  );
}
