import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";
import { SparklesIcon, TruckIcon, ShieldCheckIcon, PackageIcon, ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return (
    <main>
      {/* Hero Section */}
      <section className="hero" aria-labelledby="hero-title" style={{ width: "100%", maxWidth: "none", background: "none", border: "none", borderRadius: 0, padding: "clamp(2.5rem, 6vw, 4.5rem) var(--pad)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }} className="hero-kicker">
            <SparklesIcon size={14} />
            <span>Independent Filipino Streetwear · Est. 1968</span>
          </div>

          <div style={{ margin: "1.5rem auto 1.25rem", maxWidth: "640px" }}>
            <Image
              src="/images/1968%20Clothing%20Banner%20transparent.png"
              alt="1968 Clothing"
              width={640}
              height={140}
              priority
              style={{ width: "100%", height: "auto", objectFit: "contain" }}
            />
          </div>

          <h1 id="hero-title" className="hero-title">
            Wear the legacy.<br />Move the culture.
          </h1>
          <p className="hero-intro">
            Limited-run pieces shaped by community, history, and the streets we call home. Hand-crafted with heavyweight fabrics and archival prints.
          </p>

          <div className="hero-actions">
            <Link href="/products" className="btn btn-primary" style={{ padding: "0.85rem 2rem", fontSize: "0.95rem", gap: "0.5rem" }}>
              <span>Explore the Drop</span>
              <ArrowRightIcon size={18} />
            </Link>
            <Link href="#story" className="btn btn-secondary">
              Our Story
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="trust-strip">
        <div className="trust-item">
          <PackageIcon size={18} />
          <div>
            <strong>Limited-Run Releases</strong>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Numbered &amp; archival pieces</div>
          </div>
        </div>
        <div className="trust-item">
          <SparklesIcon size={18} />
          <div>
            <strong>Designed in PH</strong>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Rooted in Filipino streetwear culture</div>
          </div>
        </div>
        <div className="trust-item">
          <TruckIcon size={18} />
          <div>
            <strong>Doorstep COD &amp; GCash</strong>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Safe payment &amp; express shipping</div>
          </div>
        </div>
        <div className="trust-item">
          <ShieldCheckIcon size={18} />
          <div>
            <strong>Authentic Guarantee</strong>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>100% Genuine 1968 merchandise</div>
          </div>
        </div>
      </div>

      <div className="catalog-main" style={{ width: "100%", maxWidth: "var(--max)", margin: "0 auto", padding: "3rem var(--pad)" }}>
        {/* Drop 01 Release */}
        <section aria-labelledby="collection-title" style={{ width: "100%", maxWidth: "none", background: "none", border: "none", padding: 0 }}>
          <div className="section-header">
            <div>
              <p className="eyebrow">Drop 01 · The Current Release</p>
              <h2 id="collection-title" className="section-title">Pieces with Purpose</h2>
            </div>
            <Link href="/products" className="btn btn-secondary small-btn" style={{ gap: "0.4rem" }}>
              <span>View All ({products.length})</span>
              <ArrowRightIcon size={14} />
            </Link>
          </div>

          {categories.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem" }}>
              <Link href="/products" className="category-pill active">
                All Drops
              </Link>
              {categories.map((cat) => (
                <Link key={cat.id} href={`/categories/${cat.slug}`} className="category-pill">
                  {cat.name}
                </Link>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", background: "var(--surface)", borderRadius: "var(--radius)" }}>
              <p className="subtle-text">Loading catalog pieces...</p>
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
            </div>
          )}
        </section>

        {/* Story Section */}
        <section id="story" style={{ width: "100%", maxWidth: "none", background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "clamp(2rem, 5vw, 4rem)", marginTop: "4.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
            <span className="eyebrow">More Than a Number</span>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 800, margin: "0.5rem 0 1.5rem", letterSpacing: "-0.02em" }}>
              Built by the culture.<br />Worn by the community.
            </h2>
            <p style={{ fontSize: "1.05rem", color: "var(--muted)", lineHeight: 1.75, margin: "0 0 2rem" }}>
              1968 is not just a year—it is the root of brotherhood, strength, and identity. Every garment we craft is an ode to the resilient spirit of Philippine streetwear, bringing timeless principles into modern, wearable silhouettes.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
              <Link href="/products" className="btn btn-primary" style={{ padding: "0.85rem 2rem" }}>
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
  );
}
