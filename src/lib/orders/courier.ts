/**
 * Provider-neutral courier and fulfillment abstraction.
 * Initial provider is MANUAL; allows tracking reference formatting and provider resolution
 * without requiring external paid APIs or introducing secondary status authority.
 */

export type CourierProvider = "MANUAL" | "LBC" | "JNT" | "GOGO" | "OTHER";

export interface CourierInfo {
  provider: CourierProvider;
  name: string;
  trackingUrlTemplate?: (reference: string) => string;
}

export const SUPPORTED_COURIERS: Record<CourierProvider, CourierInfo> = {
  MANUAL: {
    provider: "MANUAL",
    name: "Standard / In-House",
  },
  LBC: {
    provider: "LBC",
    name: "LBC Express",
    trackingUrlTemplate: () => "https://www.lbcexpress.com/ph/track",
  },
  JNT: {
    provider: "JNT",
    name: "J&T Express",
    trackingUrlTemplate: (ref) => `https://www.jtexpress.ph/track-and-trace?waybillNo=${encodeURIComponent(ref)}`,
  },
  GOGO: {
    provider: "GOGO",
    name: "GoGo Xpress",
    trackingUrlTemplate: (ref) => `https://app.gogoxpress.com/track/${encodeURIComponent(ref)}`,
  },
  OTHER: {
    provider: "OTHER",
    name: "Other Courier",
  },
};

export function normalizeCourierProvider(provider: string | undefined | null): CourierProvider {
  const normalized = (provider || "MANUAL").trim().toUpperCase();
  const compact = normalized.replace(/[^A-Z0-9]/g, "");

  if (compact === "JT" || compact === "JNT") return "JNT";
  if (normalized === "LBC") return "LBC";
  if (normalized === "GOGO") return "GOGO";
  if (normalized === "MANUAL") return "MANUAL";
  return "OTHER";
}

export function getCourierDisplayName(provider: string | undefined | null): string {
  return SUPPORTED_COURIERS[normalizeCourierProvider(provider)].name;
}

/**
 * Derives a tracking URL for a given provider and tracking reference number.
 */
export function getCourierTrackingUrl(
  provider: string | undefined | null,
  trackingReference: string | undefined | null,
): string | null {
  if (!trackingReference || !trackingReference.trim()) {
    return null;
  }
  const cleanRef = trackingReference.trim();
  const normalizedProvider = normalizeCourierProvider(provider);
  const courier = SUPPORTED_COURIERS[normalizedProvider];
  if (courier && courier.trackingUrlTemplate) {
    return courier.trackingUrlTemplate(cleanRef);
  }
  return null;
}
