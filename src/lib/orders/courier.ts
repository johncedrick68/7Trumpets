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
    name: "Standard Direct / In-House Delivery",
  },
  LBC: {
    provider: "LBC",
    name: "LBC Express",
    trackingUrlTemplate: (ref) => `https://www.lbcexpress.com/track/?tracking_no=${encodeURIComponent(ref)}`,
  },
  JNT: {
    provider: "JNT",
    name: "J&T Express",
    trackingUrlTemplate: (ref) => `https://www.jtexpress.ph/index/query/gzquery.html?bills=${encodeURIComponent(ref)}`,
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
  const normalizedProvider = (provider || "MANUAL").toUpperCase() as CourierProvider;
  const courier = SUPPORTED_COURIERS[normalizedProvider];
  if (courier && courier.trackingUrlTemplate) {
    return courier.trackingUrlTemplate(cleanRef);
  }
  return null;
}
