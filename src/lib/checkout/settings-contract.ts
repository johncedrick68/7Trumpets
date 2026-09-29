export class CheckoutConfigurationError extends Error {
  readonly reason: "query" | "missing" | "malformed";
  constructor(reason: "query" | "missing" | "malformed") {
    super("Checkout configuration unavailable");
    this.name = "CheckoutConfigurationError";
    this.reason = reason;
  }
}

export type CheckoutSettings = {
  fulfillment: { shipping_fee_minor: number; free_shipping_threshold_minor: number; allow_store_pickup: boolean; pickup_address?: string };
  payment: { cod_enabled: boolean; cod_max_minor: number; gcash_enabled: boolean; gcash_number: string; gcash_account_name: string; gcash_qr_path?: string };
};

export async function resolveCheckoutSettings(query: () => PromiseLike<{ data: { key: string; value: unknown }[] | null; error: unknown }>): Promise<CheckoutSettings> {
  let result;
  try { result = await query(); }
  catch { throw new CheckoutConfigurationError("query"); }
  if (result.error || !result.data) throw new CheckoutConfigurationError("query");
  return validateCheckoutSettings(result.data);
}

export function validateCheckoutSettings(rows: { key: string; value: unknown }[]): CheckoutSettings {
  const fulfillment = rows.find((row) => row.key === "fulfillment")?.value;
  const payment = rows.find((row) => row.key === "payment")?.value;
  if (fulfillment === undefined || payment === undefined) throw new CheckoutConfigurationError("missing");
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
  const minor = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  if (!record(fulfillment) || !record(payment)
      || !minor(fulfillment.shipping_fee_minor) || !minor(fulfillment.free_shipping_threshold_minor)
      || typeof fulfillment.allow_store_pickup !== "boolean"
      || (fulfillment.allow_store_pickup && !text(fulfillment.pickup_address))
      || typeof payment.cod_enabled !== "boolean" || !minor(payment.cod_max_minor)
      || typeof payment.gcash_enabled !== "boolean" || (!payment.cod_enabled && !payment.gcash_enabled)
      || (payment.gcash_enabled && (!text(payment.gcash_number) || !text(payment.gcash_account_name)))
      || (payment.gcash_qr_path !== undefined && typeof payment.gcash_qr_path !== "string")) {
    throw new CheckoutConfigurationError("malformed");
  }
  return { fulfillment, payment } as CheckoutSettings;
}
