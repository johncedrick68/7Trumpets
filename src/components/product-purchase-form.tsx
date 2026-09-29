"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart/actions";
import { findVariant } from "@/lib/catalog/variants";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Check, Minus, Plus, AlertCircle } from "lucide-react";
import { SizeChartDialog } from "@/components/size-chart-dialog";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

interface Variant {
  id: string;
  sku: string;
  name: string | null;
  formatted_price: string;
  option_value_ids: string[];
  is_available: boolean;
}

export function ProductPurchaseForm({
  productName,
  productSlug,
  options,
  variants,
}: {
  productName: string;
  productSlug: string;
  options: Option[];
  variants: Variant[];
}) {
  const router = useRouter();
  // Option-based selection state — require explicit choice if multiple options exist
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    options.forEach((opt) => {
      if (opt.values.length === 1) {
        initial[opt.id] = opt.values[0].id;
      }
    });
    return initial;
  });

  // Direct variant selection state — require explicit choice if multiple variants exist
  const [directVariantId, setDirectVariantId] = useState<string>(() => {
    return variants.length === 1 ? (variants[0]?.id ?? "") : "";
  });

  // The server validates quantity against current authoritative inventory.
  const [quantity, setQuantity] = useState<number>(1);

  // Status & Feedback states
  const [isPending, setIsPending] = useState<boolean>(false);
  const [isAdded, setIsAdded] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    productName: string;
    sizeLabel?: string;
    quantity: number;
  } | null>(null);

  const firstAvailableRef = useRef<HTMLInputElement>(null);
  let assignedFirstRef = false;
  let assignedDirectRef = false;

  // Determine active variant
  const activeVariant =
    options.length > 0
      ? (Object.keys(selected).length === options.length
          ? findVariant(variants, options.map((option) => selected[option.id] ?? ""))
          : null)
      : (variants.find((v) => v.id === directVariantId) ?? null);

  // Determine if all variants are out of stock
  const isAllOutOfStock = variants.length > 0 && variants.every((v) => !v.is_available);

  // Selected size label for feedback and display
  const selectedSizeLabel =
    options.length > 0
      ? options
          .filter((opt) => opt.name.toLowerCase().includes("size"))
          .map((opt) => opt.values.find((v) => v.id === selected[opt.id])?.value)
          .filter(Boolean)[0]
      : activeVariant?.name?.replace(/^size\s+/i, "") || activeVariant?.sku;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!activeVariant) {
      setValidationError("Please select a size to continue.");
      firstAvailableRef.current?.focus();
      return;
    }

    if (!activeVariant.is_available) {
      setValidationError("Selected size is currently out of stock.");
      return;
    }

    setValidationError(null);
    setIsPending(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("variant_id", activeVariant.id);
      formData.set("quantity", String(quantity));
      formData.set("return_to", `/products/${productSlug}`);
      formData.set("stay", "true");

      const result = await addToCart(formData);
      if (!result.success) {
        setValidationError(result.error);
      } else {
        router.refresh();
        setFeedback({
          productName,
          sizeLabel: selectedSizeLabel,
          quantity: result.itemCount,
        });
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 3000);
      }
    } catch (err: unknown) {
      // If Next.js threw a redirect (e.g. to login for unauthenticated users), rethrow so router executes it
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
      {/* ── 1. Multi-Option Selector (e.g. Size) ────────────────── */}
      {options.length > 0 &&
        options.map((option) => {
          const isSizeOption = option.name.toLowerCase().includes("size");
          const selectedValue = selected[option.id];
          const selectedValueObj = option.values.find((v) => v.id === selectedValue);
          return (
            <fieldset
              key={option.id}
              className="space-y-3"
              aria-describedby={validationError ? "size-validation-error" : undefined}
            >
              <legend className="flex items-center justify-between w-full font-mono text-xs uppercase tracking-wider text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="font-bold">{option.name}:</span>
                  <span className="text-muted-foreground">
                    {selectedValueObj ? selectedValueObj.value : "Choose"}
                  </span>
                </span>
                {isSizeOption && <SizeChartDialog />}
              </legend>

              <div className="flex flex-wrap gap-2">
                {option.values.map((val) => {
                  const isSelected = selectedValue === val.id;

                  // Check if any active variant has this option value and is in stock
                  const variantForVal = variants.find((v) =>
                    v.option_value_ids.includes(val.id)
                  );
                  const isAvailable = variantForVal ? variantForVal.is_available : true;

                  const shouldAttachRef = !assignedFirstRef && isAvailable;
                  if (shouldAttachRef) assignedFirstRef = true;

                  return (
                    <label
                      key={val.id}
                      htmlFor={`option-${option.id}-${val.id}`}
                      className={cn(
                        "relative min-w-[52px] h-11 px-3.5 rounded-none border font-mono text-xs uppercase tracking-wider font-bold transition-colors flex items-center justify-center select-none focus-within:ring-1 focus-within:ring-foreground",
                        !isAvailable
                          ? "cursor-not-allowed border-border/50 bg-neutral-100 text-muted-foreground line-through opacity-50"
                          : isSelected
                          ? "bg-black text-white border-black cursor-pointer dark:bg-white dark:text-black"
                          : "bg-background text-foreground border-border hover:border-black cursor-pointer"
                      )}
                    >
                      <input
                        ref={shouldAttachRef ? firstAvailableRef : undefined}
                        type="radio"
                        id={`option-${option.id}-${val.id}`}
                        name={`option-${option.id}`}
                        value={val.id}
                        checked={isSelected}
                        disabled={!isAvailable}
                        onChange={() => {
                          setSelected((prev) => ({ ...prev, [option.id]: val.id }));
                          setValidationError(null);
                        }}
                        className="sr-only"
                      />
                      <span>{val.value}</span>
                      {!isAvailable && <span className="sr-only"> (Sold out)</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

      {/* ── 2. Direct Variant Selector (when product has direct variants) */}
      {options.length === 0 && variants.length > 0 && (
        <fieldset
          className="space-y-3"
          aria-describedby={validationError ? "size-validation-error" : undefined}
        >
          <legend className="flex items-center justify-between w-full font-mono text-xs uppercase tracking-wider text-foreground">
            <span className="flex items-center gap-1.5">
              <span className="font-bold">Size:</span>
              <span className="text-muted-foreground">
                {activeVariant ? (activeVariant.name || activeVariant.sku).replace(/^size\s+/i, "") : "Choose"}
              </span>
            </span>
            <SizeChartDialog />
          </legend>

          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const isSelected = activeVariant?.id === v.id;
              const displayLabel = (v.name || v.sku).replace(/^size\s+/i, "");
              const isAvailable = v.is_available;
              const shouldAttachRef = !assignedDirectRef && isAvailable;
              if (shouldAttachRef) assignedDirectRef = true;

              return (
                <label
                  key={v.id}
                  htmlFor={`variant-${v.id}`}
                  className={cn(
                    "relative min-w-[52px] h-11 px-3.5 rounded-none border font-mono text-xs uppercase tracking-wider font-bold transition-colors flex items-center justify-center select-none focus-within:ring-1 focus-within:ring-foreground",
                    !isAvailable
                      ? "cursor-not-allowed border-border/50 bg-neutral-100 text-muted-foreground line-through opacity-50"
                      : isSelected
                      ? "bg-black text-white border-black cursor-pointer dark:bg-white dark:text-black"
                      : "bg-background text-foreground border-border hover:border-black cursor-pointer"
                  )}
                >
                  <input
                    ref={shouldAttachRef ? firstAvailableRef : undefined}
                    type="radio"
                    id={`variant-${v.id}`}
                    name="direct_variant_id"
                    value={v.id}
                    checked={isSelected}
                    disabled={!isAvailable}
                    onChange={() => {
                      setDirectVariantId(v.id);
                      setValidationError(null);
                    }}
                    className="sr-only"
                  />
                  <span>{displayLabel}</span>
                  {!isAvailable && <span className="sr-only"> (Sold out)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* ── Validation Error Alert (Live region) ────────────────── */}
      {validationError && (
        <div
          id="size-validation-error"
          role="alert"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-none border border-black/20 bg-neutral-100 dark:bg-neutral-900 p-3 font-mono text-xs text-foreground"
        >
          <AlertCircle className="size-4 shrink-0 text-foreground" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      {/* ── 3. Quantity Stepper ─────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        <label htmlFor="quantity-input" className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-none border border-border bg-background">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || (activeVariant !== null && !activeVariant.is_available)}
              className="size-11 flex items-center justify-center text-foreground hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-none cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>

            <span
              aria-live="polite"
              className="w-12 text-center font-mono text-xs font-bold text-foreground select-none"
            >
              {quantity}
            </span>

            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              disabled={activeVariant !== null && !activeVariant.is_available}
              className="size-11 flex items-center justify-center text-foreground hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors rounded-none cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
          <input
            type="hidden"
            id="quantity-input"
            name="quantity"
            value={quantity}
          />
        </div>
      </div>

      {/* ── 4. Stock State Feedback ─────────────────────────────── */}
      <div
        aria-live="polite"
        className="flex items-center gap-2 text-xs font-mono min-h-5"
      >
        {isAllOutOfStock ? (
          <span className="text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
            Out of stock — all sizes sold out
          </span>
        ) : activeVariant?.is_available ? (
          <span className="text-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Check className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            In stock
          </span>
        ) : activeVariant ? (
          <span className="text-muted-foreground uppercase tracking-wider text-[11px]">
            Out of stock in selected size
          </span>
        ) : (
          <span className="text-muted-foreground uppercase tracking-wider text-[11px]">
            Select size to view availability
          </span>
        )}
      </div>

      {/* ── 5. Add to Bag Button ─────────────────────────────────── */}
      <div>
        <Button
          type="submit"
          disabled={isAllOutOfStock || (activeVariant !== null && !activeVariant.is_available)}
          className="w-full font-mono text-xs uppercase tracking-wider font-bold h-12 rounded-none bg-black text-white hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[48px] dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {isPending
              ? "Adding to Bag…"
              : isAdded
              ? "Added to Bag ✓"
              : isAllOutOfStock
              ? "Out of Stock"
              : !activeVariant
              ? "Select a Size"
              : !activeVariant.is_available
              ? "Out of Stock"
              : `Add to Bag · ${activeVariant.formatted_price}`}
          </span>
        </Button>
      </div>

      {/* ── 6. In-Page Success Feedback Banner ───────────────────── */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-none border border-border bg-neutral-50 dark:bg-neutral-900 p-4 transition-all space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-foreground shrink-0" aria-hidden="true" />
              <p className="text-xs font-mono uppercase tracking-wider text-foreground">
                <span className="font-bold">{feedback.productName}</span>
                {feedback.sizeLabel && <> ({feedback.sizeLabel})</>} added to your bag.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-wider p-1 cursor-pointer"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="inline-flex items-center justify-center h-10 px-4 rounded-none bg-black text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-wider font-bold transition-colors"
            >
              View Bag ({feedback.quantity}) &rarr;
            </Link>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="inline-flex items-center justify-center h-10 px-4 rounded-none border border-border bg-background text-foreground hover:bg-neutral-100 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
