import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { addToCart } from "@/lib/cart/actions";
import { formatMinorUnitsToPHP, getProductBySlug } from "@/lib/catalog/queries";
import { ProductPurchaseForm } from "@/components/product-purchase-form";
import { BagIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SizeChartDialog } from "@/components/size-chart-dialog";

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
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-7xl mx-auto">
      <div className="w-full max-w-6xl mx-auto">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-8">
          <Link href="/products" className="hover:text-foreground transition-colors">Collection</Link>
          <span>/</span>
          <span className="text-foreground font-bold">{product.name}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Gallery Column */}
          <div className="w-full lg:w-3/5 flex flex-col gap-4">
            <div className="aspect-[4/5] md:aspect-square w-full rounded-xl overflow-hidden bg-muted border border-border relative">
              {product.images.length > 0 ? (
                <Image
                  src={
                    product.images[0].storage_path.startsWith("http")
                      ? product.images[0].storage_path
                      : `/images/${product.images[0].storage_path.split("/").pop()}`
                  }
                  alt={product.name}
                  width={800}
                  height={1000}
                  priority
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src="/images/1968%20CLOTHING%20V1.webp"
                  alt={product.name}
                  width={800}
                  height={1000}
                  priority
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.slice(0, 4).map((img, idx) => (
                  <div key={img.id || idx} className="aspect-square rounded-lg overflow-hidden border border-border bg-muted relative">
                    <Image
                      src={
                        img.storage_path.startsWith("http")
                          ? img.storage_path
                          : `/images/${img.storage_path.split("/").pop()}`
                      }
                      alt={img.alt_text || product.name}
                      width={150}
                      height={150}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Column */}
          <div className="w-full lg:w-2/5 flex flex-col">
            <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase mb-2">
              Archival Garment
            </p>

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              {product.name}
            </h1>

            <div className="font-mono text-2xl font-bold text-foreground mb-8">
              {formatMinorUnitsToPHP(minPrice)}
            </div>

            {product.description && (
              <div className="text-muted-foreground text-sm leading-relaxed mb-8 py-6 border-y border-border">
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
              <div className="mt-4">
                <label className="block font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                  Select Size &amp; Add to Bag
                </label>
                <SizeChartDialog />
                <div className="flex flex-col gap-3">
                  {product.variants.map((variant) => (
                    <form key={variant.id} action={addToCart} className="flex justify-between items-center p-4 bg-muted/30 border border-border rounded-lg">
                      <input type="hidden" name="variant_id" value={variant.id} />
                      <input type="hidden" name="quantity" value="1" />
                      <div>
                        <strong className="text-sm">{variant.name || variant.sku}</strong>
                        <div className="font-mono text-[11px] text-muted-foreground mt-1">SKU: {variant.sku}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{formatMinorUnitsToPHP(variant.price_minor)}</span>
                        <Button type="submit" size="sm" className="gap-2">
                          <BagIcon size={14} />
                          <span>Add to Bag</span>
                        </Button>
                      </div>
                    </form>
                  ))}
                </div>
              </div>
            )}

            {/* Specifications Box */}
            <div className="mt-10 p-5 bg-muted/40 border border-border rounded-lg flex flex-col gap-3 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
              <div><strong className="text-foreground">FABRIC:</strong> 100% Heavyweight Pre-Shrunk Cotton (220-240 GSM)</div>
              <div><strong className="text-foreground">PRINT:</strong> Archival High-Density Plastisol Screenprint</div>
              <div><strong className="text-foreground">SHIPPING:</strong> Metro Manila 2-3 business days · Provincial 3-6 business days</div>
              <div><strong className="text-foreground">PAYMENTS:</strong> Doorstep Cash on Delivery (COD) · Manual GCash</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
