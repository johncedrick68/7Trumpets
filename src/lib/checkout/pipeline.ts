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

export interface CheckoutExecutionDeps {
  paymentMethod: string;
  gcashConfig: GcashConfig;
  onReject: (redirectUrl: string) => never | void;
  invokeRpc: (payload: { paymentMethod: string; gcashExpiresAt: string | null }) => Promise<unknown>;
  deleteCartItems: () => Promise<unknown>;
}

/**
 * Behavioral execution harness for checkout payment validation.
 * Proves that unconfigured GCash rejects before invoking RPC or deleting cart.
 */
export async function executeCheckoutPaymentFlow(deps: CheckoutExecutionDeps) {
  const gate = validateCheckoutPaymentGate(deps.paymentMethod, deps.gcashConfig);
  if (!gate.valid && gate.redirectUrl) {
    return deps.onReject(gate.redirectUrl);
  }

  const gcashExpiresAt = calculateGcashExpiresAt(deps.paymentMethod);
  const rpcResult = await deps.invokeRpc({
    paymentMethod: deps.paymentMethod,
    gcashExpiresAt,
  });

  await deps.deleteCartItems();
  return rpcResult;
}
