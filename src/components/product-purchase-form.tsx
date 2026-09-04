"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart/actions";
import { findVariant } from "@/lib/catalog/variants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag } from "lucide-react";
import { SizeChartDialog } from "@/components/size-chart-dialog";

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
}

export function ProductPurchaseForm({
  options,
  variants,
}: {
  options: Option[];
  variants: Variant[];
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const variant = findVariant(variants, options.map((option) => selected[option.id] ?? ""));

  return (
    <form action={addToCart} className="flex flex-col gap-5 mt-4">
      <div className="flex items-end justify-between gap-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Choose your fit</p>
        <SizeChartDialog />
      </div>
      {options.map((option) => (
        <div key={option.id} className="space-y-2">
          <Label htmlFor={`option-${option.id}`} className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {option.name}
          </Label>
          <Select 
            name={`option-${option.id}`} 
            value={selected[option.id]} 
            onValueChange={(val) => setSelected({ ...selected, [option.id]: val })}
            required
          >
            <SelectTrigger id={`option-${option.id}`} className="w-full h-12 rounded-none border-border">
              <SelectValue placeholder={`Select ${option.name}`} />
            </SelectTrigger>
            <SelectContent>
              {option.values.map((value) => (
                <SelectItem key={value.id} value={value.id}>{value.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
      <input type="hidden" name="quantity" value="1" />
      
      <div aria-live="polite" className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest min-h-4">
        {variant ? `Available · SKU: ${variant.sku}` : "Select all options to see availability."}
      </div>
      
      <Button type="submit" disabled={!variant} size="lg" className="w-full font-bold h-14 rounded-none uppercase tracking-widest text-sm bg-foreground text-background hover:bg-foreground/90 transition-all flex items-center justify-center gap-2">
        <ShoppingBag className="w-4 h-4" />
        Add to Bag {variant && `· ${variant.formatted_price}`}
      </Button>
    </form>
  );
}
