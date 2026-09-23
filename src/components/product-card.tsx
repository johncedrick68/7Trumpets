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
        className="group flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Product image container */}
        <div className="product-tile-image relative aspect-[4/5] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <Image
            src={imagePath}
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, (min-width: 640px) 46vw, 50vw"
            priority={priority}
            className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />

          {!product.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/55 p-3">
              <span className="bg-neutral-950 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        {/* Product Information */}
        <div className="product-tile-copy flex flex-1 flex-col justify-between">
          <div>
            {categoryName ? <p className="product-tile-category">{categoryName}</p> : null}
            <h2 className="product-tile-name">
              {product.name}
            </h2>
            <p className="product-tile-price">
              {formatMinorUnitsToPHP(product.min_price_minor)}
            </p>
          </div>

          {/* Action indicator: Choose Options (clothing requires size selection) vs Out of Stock */}
          <div className="product-tile-state">
            <span
              className={product.is_available ? "" : "opacity-70"}
            >
              {product.is_available ? "Choose Options" : "Out of Stock"}
            </span>
            <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
