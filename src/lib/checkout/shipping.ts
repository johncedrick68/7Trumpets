export type FulfillmentPricingSettings = {
  shipping_fee_minor?: number;
  free_shipping_threshold_minor?: number | null;
};

const DEFAULT_SHIPPING_MINOR = 15_000;

function validMinorUnits(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

export function calculateShippingMinor(
  subtotalMinor: number,
  fulfillmentMethod: "SHIPMENT" | "STORE_PICKUP",
  settings: FulfillmentPricingSettings,
): number {
  if (fulfillmentMethod === "STORE_PICKUP") return 0;

  const shippingFeeMinor = validMinorUnits(settings.shipping_fee_minor, DEFAULT_SHIPPING_MINOR);
  const threshold = settings.free_shipping_threshold_minor;
  const freeShippingThresholdMinor = threshold == null
    ? null
    : validMinorUnits(threshold, Number.MAX_SAFE_INTEGER);

  return freeShippingThresholdMinor !== null && subtotalMinor >= freeShippingThresholdMinor
    ? 0
    : shippingFeeMinor;
}
