"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart/actions";
import { findVariant } from "@/lib/catalog/variants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Check } from "lucide-react";
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
  options,
  variants,
}: {
  options: Option[];
  variants: Variant[];
}) {
  // Option-based selection state
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    options.forEach((opt) => {
      if (opt.values.length === 1) {
        initial[opt.id] = opt.values[0].id;
      }
    });
    return initial;
  });

  // Direct variant selection state (when no options defined)
  const [directVariantId, setDirectVariantId] = useState<string>(
    variants[0]?.id ?? ""
  );

  const activeVariant =
    options.length > 0
      ? findVariant(variants, options.map((option) => selected[option.id] ?? ""))
      : variants.find((v) => v.id === directVariantId) ?? variants[0];

  return (
    <form action={addToCart} className="flex flex-col">
      {/* 1. Multi-Option Selector (e.g. Size, Color) */}
      {options.length > 0 &&
        options.map((option) => {
          const isSizeOption = option.name.toLowerCase().includes("size");

          return (
            // size label → size buttons: 12px (space-y-3)
            <div key={option.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`option-${option.id}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {option.name}
                  {selected[option.id] && (
                    <span className="ml-2 font-normal text-muted-foreground lowercase">
                      — {option.values.find((v) => v.id === selected[option.id])?.value}
                    </span>
                  )}
                </Label>
                {isSizeOption && <SizeChartDialog />}
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={option.name}
              >
                {option.values.map((value) => {
                  const isSelected = selected[option.id] === value.id;

                  return (
                    <button
                      key={value.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() =>
                        setSelected((prev) => ({ ...prev, [option.id]: value.id }))
                      }
                      className={cn(
                        "min-w-[48px] h-11 px-4 rounded-md border text-sm font-semibold transition-all flex items-center justify-center cursor-pointer select-none",
                        isSelected
                          ? "bg-neutral-950 text-white border-neutral-950 shadow-xs"
                          : "bg-background text-foreground border-border hover:border-foreground"
                      )}
                    >
                      {value.value}
                    </button>
                  );
                })}
              </div>

              <input
                type="hidden"
                id={`option-${option.id}`}
                name={`option-${option.id}`}
                value={selected[option.id] ?? ""}
              />
            </div>
          );
        })}

      {/* 2. Direct Variant Selector (when product has direct variants without options) */}
      {options.length === 0 && variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-foreground">
              Select Size
              {activeVariant && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {activeVariant.name || activeVariant.sku}
                </span>
              )}
            </Label>
            <SizeChartDialog />
          </div>

          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Select Size"
          >
            {variants.map((v) => {
              const isSelected = activeVariant?.id === v.id;
              const displayLabel = (v.name || v.sku).replace(/^size\s+/i, "");
              const isAvailable = v.is_available;

              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={!isAvailable}
                  disabled={!isAvailable}
                  onClick={() => setDirectVariantId(v.id)}
                  className={cn(
                    "min-w-[48px] h-11 px-4 rounded-md border text-sm font-semibold transition-all flex items-center justify-center cursor-pointer select-none",
                    !isAvailable
                      ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through opacity-60"
                      : isSelected
                      ? "bg-neutral-950 text-white border-neutral-950 shadow-xs"
                      : "bg-background text-foreground border-border hover:border-foreground"
                  )}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <input type="hidden" name="variant_id" value={activeVariant?.id ?? ""} />
      <input type="hidden" name="quantity" value="1" />

      {/* Stock status — size buttons → stock: 20px */}
      <div
        aria-live="polite"
        className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground min-h-5"
      >
        {activeVariant?.is_available ? (
          <>
            <Check className="w-3.5 h-3.5 text-foreground" />
            <span className="text-foreground font-semibold">In stock</span>
            <span className="font-mono text-xs">· SKU: {activeVariant.sku}</span>
          </>
        ) : (
          <span>{activeVariant ? "Out of stock" : "Select your size to view availability"}</span>
        )}
      </div>

      {/* Add to Bag — stock → CTA: 24px */}
      <div className="mt-6">
        <Button
          type="submit"
          disabled={!activeVariant || !activeVariant.is_available}
          size="lg"
          className="w-full font-bold h-13 rounded-md text-sm bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{activeVariant?.is_available ? `Add to Bag · ${activeVariant.formatted_price}` : "Out of stock"}</span>
        </Button>
      </div>
    </form>
  );
}
