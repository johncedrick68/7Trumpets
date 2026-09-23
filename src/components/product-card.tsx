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
    <article className="group flex flex-col h-full">
      <Link
        href={`/products/${product.slug}`}
        className="group flex flex-col h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Product image container */}
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border/80 bg-neutral-100 transition-[border-color] group-hover:border-foreground/40 active:scale-[0.99] motion-reduce:active:scale-100 dark:bg-neutral-900">
          <Image
            src={imagePath}
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, (min-width: 640px) 46vw, 50vw"
            priority={priority}
            className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />

          {categoryName && (
            <span className="absolute top-2.5 left-2.5 bg-neutral-950 text-white font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-xs">
              {categoryName}
            </span>
          )}

          {!product.is_available && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center p-3">
              <span className="bg-neutral-950 text-white font-mono text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-xs shadow-sm">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="mt-3 flex flex-1 flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold leading-snug text-foreground group-hover:underline underline-offset-4 line-clamp-1">
              {product.name}
            </h2>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
              {formatMinorUnitsToPHP(product.min_price_minor)}
            </p>
          </div>

          {/* Action indicator: Choose Options (clothing requires size selection) vs Out of Stock */}
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-xs">
            <span
              className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                product.is_available ? "text-muted-foreground" : "text-muted-foreground/60"
              }`}
            >
              {product.is_available ? "Choose Options" : "Out of Stock"}
            </span>
            <span aria-hidden="true" className="font-mono text-xs text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
