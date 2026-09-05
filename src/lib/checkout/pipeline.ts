import type { GcashConfig } from "@/lib/payments/config";

export interface CheckoutPaymentValidation {
  valid: boolean;
  redirectUrl?: string;
}

/**
 * Validates payment method selection against current server-side configuration.
 * Fails closed before any database mutation, session check, or cart operation.
 */
export function validateCheckoutPaymentGate(
  paymentMethod: string,
  gcashConfig: GcashConfig
): CheckoutPaymentValidation {
  if (paymentMethod !== "COD" && paymentMethod !== "MANUAL_GCASH") {
    return { valid: false, redirectUrl: "/checkout?error=invalid_payment_method" };
  }

  if (paymentMethod === "MANUAL_GCASH" && !gcashConfig.isConfigured) {
    return { valid: false, redirectUrl: "/checkout?error=gcash_unavailable" };
  }

  return { valid: true };
}

/**
 * Calculates authoritative gcashExpiresAt parameter for database RPC.
 * - MANUAL_GCASH: Valid future timestamp (2 hours).
 * - COD: Explicit null (satisfies database constraint).
 */
export function calculateGcashExpiresAt(
  paymentMethod: string,
  now: number = Date.now()
): string | null {
  if (paymentMethod === "MANUAL_GCASH") {
    return new Date(now + 2 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

export interface CheckoutOrderRpcParams {
  p_customer_id: string;
  p_idempotency_key: string;
  p_lines: Array<{ variant_id: string; quantity: number }>;
  p_shipping_minor: number;
  p_payment_method: string;
  p_gcash_expires_at: string | null;
  p_delivery: Record<string, unknown>;
  p_customer_note?: string;
}

export interface CheckoutOrderContext {
  userId: string;
  userEmail: string;
  paymentMethod: string;
  idempotencyKey: string;
  customerNote?: string;
  cart: {
    id: string;
    items: Array<{ variant_id: string; quantity: number }>;
  };
  address: {
    recipient_name: string;
    phone: string;
    address_line1: string;
    address_line2?: string | null;
    barangay?: string | null;
    city_municipality: string;
    province: string;
    postal_code: string;
    country_code?: string | null;
  };
}

export interface CheckoutOrderDependencies {
  gcashConfig: GcashConfig;
  invokeCheckoutRpc: (
    params: CheckoutOrderRpcParams
  ) => Promise<{ data: unknown; error: unknown }>;
  clearCartItems: (cartId: string) => Promise<{ error: unknown }>;
  onRedirect: (url: string) => never;
  onLogServerError?: (scope: string, reason: string) => void;
  now?: number;
}

const CANONICAL_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that an untrusted runtime value from checkout RPC is a non-null,
 * non-array scalar object containing a valid canonical PostgreSQL UUID in its "id" property.
 * Returns the trimmed UUID string if valid, or null otherwise.
 */
export function extractValidOrderUuid(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const candidate = (data as Record<string, unknown>).id;
  if (typeof candidate !== "string") {
    return null;
  }
  const trimmed = candidate.trim();
  if (!trimmed || !CANONICAL_UUID_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Canonical checkout order execution pipeline.
 * Shared directly by production Server Action and behavioral tests.
 * Guarantees:
 * 1. Unconfigured GCash rejects before RPC and before cart deletion.
 * 2. COD strictly passes p_gcash_expires_at: null.
 * 3. RPC failure or exception leaves cart completely untouched.
 * 4. Missing, malformed, or non-UUID order result leaves cart completely untouched.
 * 5. Cart deletion only occurs after verified, authoritative order creation with a valid UUID.
 * 6. Cart deletion failure/exception after order creation does not obscure the created order.
 */
export async function executeCheckoutOrder(
  context: CheckoutOrderContext,
  deps: CheckoutOrderDependencies
): Promise<never> {
  // 1. Payment gate validation (fails closed before any side effects)
  const gate = validateCheckoutPaymentGate(context.paymentMethod, deps.gcashConfig);
  if (!gate.valid && gate.redirectUrl) {
    if (gate.redirectUrl.includes("gcash_unavailable") && deps.onLogServerError) {
      deps.onLogServerError("checkout.gcash_unavailable", "payment_destination_not_configured");
    }
    return deps.onRedirect(gate.redirectUrl);
  }

  // 2. Authoritative shipping calculation: flat ₱150 (15000 minor units)
  const shippingMinor = 15000;

  // 3. Expiry calculation: future ISO date for MANUAL_GCASH, explicit null for COD
  const gcashExpiresAt = calculateGcashExpiresAt(context.paymentMethod, deps.now);

  // 4. Payload assembly
  const linesPayload = context.cart.items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
  }));

  const deliveryPayload: Record<string, unknown> = {
    customer_email: context.userEmail,
    recipient_name: context.address.recipient_name,
    recipient_phone: context.address.phone,
    address_line1: context.address.address_line1,
    address_line2: context.address.address_line2 || undefined,
    barangay: context.address.barangay || undefined,
    city_municipality: context.address.city_municipality,
    province: context.address.province,
    postal_code: context.address.postal_code,
    country_code: context.address.country_code || "PH",
  };

  // 5. Atomic RPC invocation with exception catching
  let rpcResponse: { data: unknown; error: unknown };
  try {
    rpcResponse = await deps.invokeCheckoutRpc({
      p_customer_id: context.userId,
      p_idempotency_key: context.idempotencyKey,
      p_lines: linesPayload,
      p_shipping_minor: shippingMinor,
      p_payment_method: context.paymentMethod,
      p_gcash_expires_at: gcashExpiresAt,
      p_delivery: deliveryPayload,
      p_customer_note: context.customerNote,
    });
  } catch {
    if (deps.onLogServerError) {
      deps.onLogServerError("checkout.rpc_exception", "database_rpc_threw");
    }
    return deps.onRedirect("/checkout?error=checkout_failed");
  }

  if (rpcResponse.error) {
    if (deps.onLogServerError) {
      deps.onLogServerError("checkout.rpc_error", "database_rpc_returned_error");
    }
    return deps.onRedirect("/checkout?error=checkout_failed");
  }

  // 6. Runtime validation of checkout RPC result
  const orderId = extractValidOrderUuid(rpcResponse.data);
  if (!orderId) {
    if (deps.onLogServerError) {
      deps.onLogServerError("checkout.invalid_result", "malformed_order_payload");
    }
    return deps.onRedirect("/checkout?error=checkout_failed");
  }

  // 7. Cart deletion ONLY after successful authoritative order creation and validation.
  // If cart cleanup fails or throws, the order already authoritatively exists,
  // so we log the safe failure and still proceed to the order page.
  try {
    const { error: cleanupError } = await deps.clearCartItems(context.cart.id);
    if (cleanupError && deps.onLogServerError) {
      deps.onLogServerError("checkout.cart_cleanup", "database_failure");
    }
  } catch {
    if (deps.onLogServerError) {
      deps.onLogServerError("checkout.cart_cleanup_exception", "cart_cleanup_threw");
    }
  }

  return deps.onRedirect(`/orders/${orderId}`);
}
