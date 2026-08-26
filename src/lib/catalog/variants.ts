export interface SelectableVariant {
  option_value_ids: string[];
}

export function findVariant<T extends SelectableVariant>(
  variants: T[],
  selectedOptionValueIds: string[],
): T | null {
  if (selectedOptionValueIds.some((id) => !id)) return null;

  return variants.find(
    (variant) =>
      variant.option_value_ids.length === selectedOptionValueIds.length &&
      selectedOptionValueIds.every((id) => variant.option_value_ids.includes(id)),
  ) ?? null;
}

export function sortByMinPrice<T extends { min_price_minor: number }>(
  products: T[],
  direction: "price_asc" | "price_desc",
): T[] {
  return products.sort((a, b) => direction === "price_asc"
    ? a.min_price_minor - b.min_price_minor
    : b.min_price_minor - a.min_price_minor);
}
