import "server-only";

export interface GcashConfig {
  accountNumber: string | null;
  accountName: string | null;
  isConfigured: boolean;
}

/**
 * Server-only configuration accessor for manual GCash payment instructions.
 * Protects against unconfigured or placeholder payment destinations.
 * Never leaks configuration as client-side environment variables.
 */
export function getGcashConfig(): GcashConfig {
  const rawNumber = process.env.GCASH_ACCOUNT_NUMBER?.trim() || null;
  const rawName = process.env.GCASH_ACCOUNT_NAME?.trim() || null;

  // Destination is valid only when present, formatted, and free of placeholder tokens
  const isConfigured = Boolean(
    rawNumber &&
    rawNumber.length >= 10 &&
    !rawNumber.includes("09XX") &&
    !/^09X+$/i.test(rawNumber)
  );

  return {
    accountNumber: isConfigured ? rawNumber : null,
    accountName: isConfigured ? rawName : null,
    isConfigured,
  };
}
