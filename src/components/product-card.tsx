'use client';

import Image from 'next/image';
import { Eye, ShoppingBag } from 'lucide-react';
import { Product } from '@/types';
import { formatPHP } from '@/lib/money';
import { useCart } from '@/lib/cart-context';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const { addItem } = useCart();
  const primaryImage = product.images[0]?.storage_path || '/images/1968%20CLOTHING%20V1.webp';
  const defaultVariant = product.variants[0];
  const price = defaultVariant?.price_minor || 49900;
  const comparePrice = defaultVariant?.compare_at_price_minor;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!defaultVariant) return;
    addItem({
      variantId: defaultVariant.id,
      productId: product.id,
      productName: product.name,
      variantName: defaultVariant.name,
      priceMinor: defaultVariant.price_minor,
      image: primaryImage,
    });
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className="group relative bg-zinc-950/70 border border-zinc-800/80 hover:border-amber-500/50 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 cursor-pointer"
    >
      {/* Product Image */}
      <div className="relative w-full aspect-square bg-zinc-900 overflow-hidden">
        <Image
          src={primaryImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Badge */}
        {comparePrice && (
          <span className="absolute top-3 left-3 bg-amber-500 text-black font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-mono shadow">
            Sale
          </span>
        )}

        {/* Hover Quick Action Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
          <button
            onClick={() => onSelect(product)}
            className="p-2.5 rounded-full bg-zinc-900/90 text-white hover:bg-amber-500 hover:text-black transition"
            title="View Details"
          >
            <Eye className="size-4" />
          </button>
          <button
            onClick={handleQuickAdd}
            className="p-2.5 rounded-full bg-zinc-900/90 text-white hover:bg-amber-500 hover:text-black transition"
            title="Quick Add"
          >
            <ShoppingBag className="size-4" />
          </button>
        </div>
      </div>

      {/* Card Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
            <span className="uppercase tracking-wider">{product.category?.name || '1968 Apparel'}</span>
            <span className="text-zinc-500">Heavyweight</span>
          </div>

          <h3 className="font-bold text-sm text-zinc-100 group-hover:text-amber-400 transition-colors line-clamp-1">
            {product.name}
          </h3>
        </div>

        {/* Price & Sizes */}
        <div className="mt-3 pt-3 border-t border-zinc-850 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base text-zinc-100 font-mono">
              {formatPHP(price)}
            </span>
            {comparePrice && (
              <span className="text-xs text-zinc-500 line-through font-mono">
                {formatPHP(comparePrice)}
              </span>
            )}
          </div>

          {/* Size Pills */}
          <div className="flex gap-1 text-[10px] font-mono text-zinc-400">
            {product.variants.slice(0, 4).map((v) => (
              <span
                key={v.id}
                className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800"
              >
                {v.name.replace('Size ', '')}
              </span>
            ))}
            {product.variants.length > 4 && (
              <span className="px-1 py-0.5 text-zinc-500">+</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
