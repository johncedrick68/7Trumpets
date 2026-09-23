export function parseCartQuantity(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

export function cartAddErrorMessage(message: string | undefined): string {
  if (message?.includes("CART_OUT_OF_STOCK")) {
    return "This size is currently out of stock.";
  }
  if (message?.includes("CART_QUANTITY_EXCEEDS_STOCK")) {
    return "That quantity is no longer available. Choose a lower quantity and try again.";
  }
  if (message?.includes("CART_VARIANT_UNAVAILABLE")) {
    return "This product option is no longer available.";
  }
  if (message?.includes("CART_INVALID_QUANTITY")) {
    return "Enter a valid quantity.";
  }
  return "We could not update your bag. Please try again.";
}
