"use client";

import { useState, useRef } from "react";
import Link from "next/link";
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

  // Quantity Stepper state (1 to 10)
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

  // Determine active variant
  const activeVariant =
    options.length > 0
      ? (Object.keys(selected).length === options.length
          ? findVariant(variants, options.map((option) => selected[option.id] ?? ""))
          : null)
      : (variants.find((v) => v.id === directVariantId) ?? null);

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
      if (result && result.success) {
        setFeedback({
          productName,
          sizeLabel: selectedSizeLabel,
          quantity,
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
          let assignedFirstRef = false;

          return (
            <fieldset
              key={option.id}
              className="space-y-3"
              aria-describedby={validationError ? "size-validation-error" : undefined}
            >
              <legend className="flex items-center justify-between w-full text-sm font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <span>{option.name}</span>
                  {selectedValueObj && (
                    <span className="font-normal text-muted-foreground">
                      — {selectedValueObj.value}
                    </span>
                  )}
                </span>
                {isSizeOption && <SizeChartDialog />}
              </legend>

              <div
                className="flex flex-wrap gap-2.5"
                role="radiogroup"
                aria-label={option.name}
              >
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
                        "relative min-w-[50px] h-11 px-4 rounded-md border text-sm font-semibold transition-all flex items-center justify-center select-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                        !isAvailable
                          ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground line-through opacity-50"
                          : isSelected
                          ? "bg-neutral-950 text-white border-neutral-950 shadow-xs cursor-pointer dark:bg-white dark:text-neutral-950"
                          : "bg-background text-foreground border-border hover:border-foreground cursor-pointer"
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
          <legend className="flex items-center justify-between w-full text-sm font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <span>Select Size</span>
              {activeVariant && (
                <span className="font-normal text-muted-foreground">
                  — {activeVariant.name || activeVariant.sku}
                </span>
              )}
            </span>
            <SizeChartDialog />
          </legend>

          <div
            className="flex flex-wrap gap-2.5"
            role="radiogroup"
            aria-label="Select Size"
          >
            {variants.map((v) => {
              const isSelected = activeVariant?.id === v.id;
              const displayLabel = (v.name || v.sku).replace(/^size\s+/i, "");
              const isAvailable = v.is_available;

              return (
                <label
                  key={v.id}
                  htmlFor={`variant-${v.id}`}
                  className={cn(
                    "relative min-w-[50px] h-11 px-4 rounded-md border text-sm font-semibold transition-all flex items-center justify-center select-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                    !isAvailable
                      ? "cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground line-through opacity-50"
                      : isSelected
                      ? "bg-neutral-950 text-white border-neutral-950 shadow-xs cursor-pointer dark:bg-white dark:text-neutral-950"
                      : "bg-background text-foreground border-border hover:border-foreground cursor-pointer"
                  )}
                >
                  <input
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
          className="flex items-center gap-2.5 rounded-md border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-900 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200"
        >
          <AlertCircle className="size-4 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      {/* ── 3. Quantity Stepper ─────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        <label htmlFor="quantity-input" className="text-sm font-semibold text-foreground">
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-md border border-border bg-background">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || (activeVariant !== null && !activeVariant.is_available)}
              className="size-11 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>

            <span
              aria-live="polite"
              className="w-12 text-center font-mono text-sm font-bold text-foreground select-none"
            >
              {quantity}
            </span>

            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              disabled={quantity >= 10 || (activeVariant !== null && !activeVariant.is_available)}
              className="size-11 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
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
        className="flex items-center gap-1.5 text-xs text-muted-foreground min-h-5"
      >
        {activeVariant?.is_available ? (
          <>
            <Check className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
            <span className="text-foreground font-semibold">In stock</span>
            <span className="font-mono text-muted-foreground">· SKU: {activeVariant.sku}</span>
          </>
        ) : activeVariant ? (
          <span className="text-muted-foreground font-medium">Out of stock in selected size</span>
        ) : (
          <span className="text-muted-foreground">Select your size to view stock and purchase</span>
        )}
      </div>

      {/* ── 5. Add to Bag Button ─────────────────────────────────── */}
      <div>
        <Button
          type="submit"
          disabled={activeVariant !== null && !activeVariant.is_available}
          size="lg"
          className="w-full font-bold h-13 rounded-md text-sm bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer min-h-[44px] dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {isPending
              ? "Adding to Bag…"
              : isAdded
              ? "Added to Bag ✓"
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
          className="rounded-lg border border-border bg-neutral-100 dark:bg-neutral-900 p-4 transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-foreground shrink-0" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">
                <span className="font-semibold">{feedback.productName}</span>
                {feedback.sizeLabel && <> (Size {feedback.sizeLabel})</>} added to your bag.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-wider p-1"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button asChild size="sm" className="h-9 px-4 font-mono text-xs uppercase tracking-wider">
              <Link href="/cart">View Bag ({feedback.quantity}) &rarr;</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFeedback(null)}
              className="h-9 px-4 font-mono text-xs uppercase tracking-wider"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
