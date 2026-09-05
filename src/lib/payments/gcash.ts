export interface GcashConfig {
  accountNumber: string | null;
  accountName: string | null;
  isConfigured: boolean;
}

/**
 * Validates and normalizes Philippine GCash mobile numbers.
 * Supported logical formats:
 * - 09XXXXXXXXX (11 digits)
 * - +639XXXXXXXXX (13 chars)
 * - 639XXXXXXXXX (12 digits)
 *
 * Normalizes valid numbers to canonical '09XXXXXXXXX' format.
 * Rejects whitespace-only, placeholder tokens (e.g. 09XX, 09xx),
 * alphabetic, mixed alphanumeric, wrong length, and invalid prefixes.
 * Never logs or exposes raw input.
 */
export function validateAndNormalizeGcashNumber(
  rawNumber: string | null | undefined
): string | null {
  if (!rawNumber || typeof rawNumber !== "string") {
    return null;
  }

  const trimmed = rawNumber.trim();
  if (!trimmed) {
    return null;
  }

  // Reject explicit placeholder patterns (case-insensitive)
  if (/09[xX]/i.test(trimmed) || /[xX]/.test(trimmed)) {
    return null;
  }

  // Strip supported formatting characters: spaces and hyphens
  const stripped = trimmed.replace(/[\s-]/g, "");

  // Must contain only digits, optionally prefixed by '+'
  if (!/^\+?\d+$/.test(stripped)) {
    return null;
  }

  // Format 1: 09XXXXXXXXX (11 digits, starts with 09)
  if (/^09\d{9}$/.test(stripped)) {
    return stripped;
  }

  // Format 2: +639XXXXXXXXX (+63 followed by 9 and 9 digits)
  if (/^\+639\d{9}$/.test(stripped)) {
    return `09${stripped.slice(4)}`;
  }

  // Format 3: 639XXXXXXXXX (63 followed by 9 and 9 digits)
  if (/^639\d{9}$/.test(stripped)) {
    return `09${stripped.slice(3)}`;
  }

  return null;
}

/**
 * Parses raw environment configuration into a validated GcashConfig.
 * Never logs account numbers or credentials.
 */
export function parseGcashConfig(
  rawNumber: string | null | undefined,
  rawName: string | null | undefined
): GcashConfig {
  const normalizedNumber = validateAndNormalizeGcashNumber(rawNumber);
  const normalizedName = rawName?.trim() || null;
  const isConfigured = Boolean(normalizedNumber);

  return {
    accountNumber: normalizedNumber,
    accountName: isConfigured ? normalizedName : null,
    isConfigured,
  };
}
