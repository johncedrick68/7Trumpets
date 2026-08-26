"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart/actions";
import { findVariant } from "@/lib/catalog/variants";

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
    <form action={addToCart} className="product-options">
      {options.map((option) => (
        <div key={option.id} className="option-group">
          <label className="option-name" htmlFor={`option-${option.id}`}>{option.name}</label>
          <select
            id={`option-${option.id}`}
            value={selected[option.id] ?? ""}
            onChange={(event) => setSelected({ ...selected, [option.id]: event.target.value })}
            required
          >
            <option value="">Select {option.name}</option>
            {option.values.map((value) => (
              <option key={value.id} value={value.id}>{value.value}</option>
            ))}
          </select>
        </div>
      ))}
      <input type="hidden" name="variant_id" value={variant?.id ?? ""} />
      <input type="hidden" name="quantity" value="1" />
      <p aria-live="polite" className="selected-variant">
        {variant ? `Available · SKU: ${variant.sku} · ${variant.formatted_price}` : "Select all options to see availability."}
      </p>
      <button type="submit" className="button-link" disabled={!variant}>Add to Cart</button>
    </form>
  );
}
