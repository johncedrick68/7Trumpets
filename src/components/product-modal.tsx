'use client';

import Image from 'next/image';
import { useState } from 'react';
import { X, Check, ShoppingBag, Ruler } from 'lucide-react';
import { Product, ProductVariant } from '@/types';
import { formatPHP } from '@/lib/money';
import { useCart } from '@/lib/cart-context';
import { SizeChartDialog } from '@/components/size-chart-dialog';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product?.variants[0] || null
  );
  const [selectedImage, setSelectedImage] = useState<string>(
    product?.images[0]?.storage_path || '/images/1968%20CLOTHING%20V1.webp'
  );
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const currentVariant = selectedVariant || product.variants[0];
  const primaryImage = selectedImage || product.images[0]?.storage_path || '/images/1968%20CLOTHING%20V1.webp';

  const handleAddToCart = () => {
    if (!currentVariant) return;
    addItem(
      {
        variantId: currentVariant.id,
        productId: product.id,
        productName: product.name,
        variantName: currentVariant.name,
        priceMinor: currentVariant.price_minor,
        image: primaryImage,
      },
      quantity
    );
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:flex-row">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-zinc-300 hover:text-white hover:bg-black transition"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>

          {/* Left: Image gallery */}
          <div className="md:w-1/2 bg-zinc-900/50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/80">
              <Image
                src={primaryImage}
                alt={product.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 384px"
              />
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto w-full pb-1">
                {product.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.storage_path)}
                    className={`relative size-14 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                      selectedImage === img.storage_path
                        ? 'border-amber-500'
                        : 'border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image
                      src={img.storage_path}
                      alt={img.alt_text || product.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details & Options */}
          <div className="md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono text-amber-500 uppercase tracking-widest font-semibold">
                  1968 Heavyweight Drop
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 mt-1">
                  {product.name}
                </h3>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {formatPHP(currentVariant?.price_minor || 49900)}
                </span>
                {currentVariant?.compare_at_price_minor && (
                  <span className="text-sm font-mono text-zinc-500 line-through">
                    {formatPHP(currentVariant.compare_at_price_minor)}
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                {product.description}
              </p>

              {/* Size selector */}
              <div className="space-y-2 pt-2 border-t border-zinc-850">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Select Size
                  </span>
                  <button
                    onClick={() => setSizeGuideOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-amber-500 hover:underline"
                  >
                    <Ruler className="size-3" />
                    <span>Size Guide</span>
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {product.variants.map((variant) => {
                    const isSelected = currentVariant?.id === variant.id;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariant(variant)}
                        className={`py-2 text-xs font-mono font-bold rounded-lg border transition ${
                          isSelected
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {variant.name.replace('Size ', '')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Quantity
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-zinc-800 rounded-lg bg-zinc-900">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 text-zinc-400 hover:text-white transition"
                    >
                      -
                    </button>
                    <span className="px-3 text-xs font-mono font-semibold text-zinc-100">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="px-3 py-1.5 text-zinc-400 hover:text-white transition"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[11px] text-zinc-500">In stock, ready to pack</span>
                </div>
              </div>
            </div>

            {/* Add to bag action */}
            <div className="pt-6 border-t border-zinc-850 mt-6 space-y-3">
              <button
                onClick={handleAddToCart}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <ShoppingBag className="size-4" />
                <span>Add to Bag — {formatPHP((currentVariant?.price_minor || 49900) * quantity)}</span>
              </button>
              <p className="text-center text-[10px] text-zinc-500 uppercase tracking-widest">
                Nationwide COD • Manual GCash • 100% Authentic 1968
              </p>
            </div>
          </div>
        </div>
      </div>

      <SizeChartDialog isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
    </>
  );
}
