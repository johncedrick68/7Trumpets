import "server-only";

import {
  type GcashConfig,
  parseGcashConfig,
  validateAndNormalizeGcashNumber,
} from "./gcash";

export type { GcashConfig };
export { parseGcashConfig, validateAndNormalizeGcashNumber };

/**
 * Server-only configuration accessor for manual GCash payment instructions.
 * Protects against unconfigured or placeholder payment destinations.
 * Never leaks configuration as client-side environment variables.
 * Never logs raw or normalized account numbers.
 */
export function getGcashConfig(): GcashConfig {
  return parseGcashConfig(
    process.env.GCASH_ACCOUNT_NUMBER,
    process.env.GCASH_ACCOUNT_NAME
  );
}
