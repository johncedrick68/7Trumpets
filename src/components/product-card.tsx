import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, type ProductSummary } from "@/lib/catalog/queries";

export interface ProductCardProps {
  product: ProductSummary;
  categoryName?: string | null;
  priority?: boolean;
}

export function ProductCard({
  product,
  categoryName,
  priority = false,
}: ProductCardProps) {
  const imagePath = product.primary_image_path || "/images/1968%20CLOTHING%20V1.webp";

  return (
    <article className="product-tile group flex h-full flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="group flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-none"
      >
        {/* Product Image Container (1:1 square aspect ratio) */}
        <div className="product-tile-image relative aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-border">
          <Image
            src={imagePath}
            alt=""
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />

          {!product.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-3">
              <span className="bg-black text-white px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="product-tile-copy flex flex-1 flex-col justify-between pt-2.5 pb-1">
          <div>
            {categoryName ? (
              <p className="product-tile-category text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                {categoryName}
              </p>
            ) : null}
            <h2 className="product-tile-name text-xs sm:text-sm font-bold text-foreground leading-snug tracking-tight group-hover:underline underline-offset-4 decoration-1">
              {product.name}
            </h2>
            <p className="product-tile-price font-mono text-xs sm:text-sm font-semibold text-foreground mt-1">
              {formatMinorUnitsToPHP(product.min_price_minor)}
            </p>
          </div>

          {/* Action indicator: Choose Options vs Out of Stock */}
          <div className="product-tile-state mt-2.5 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground border-t border-border/50 pt-2">
            <span className={product.is_available ? "text-foreground font-semibold" : "text-muted-foreground"}>
              {product.is_available ? "Choose Options" : "Out of Stock"}
            </span>
            <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-1">
              &rarr;
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
