/**
 * Authoritative Sizing System for 1968 Clothing.
 *
 * Source: public/images/size-chart-1968-clothing.png
 * (Official 1968 brand asset)
 *
 * NOTE: Numerical measurements are verified for T-Shirts & Tops (S–XXL).
 * Garment family cut is factual ("T-Shirt Measurements"); do NOT infer
 * terms like "Standard Fit", "oversized", or fabric weights without authoritative documentation.
 * Other garment families (hoodies, fleece, pants) REQUIRE OWNER INPUT before publication.
 */

export interface GarmentSizeMeasurement {
  size: "S" | "M" | "L" | "XL" | "XXL";
  label: string;
  lengthInches: number;
  widthInches: number;
}

export const T_SHIRT_MEASUREMENTS: readonly GarmentSizeMeasurement[] = [
  { size: "S", label: "Small", lengthInches: 28, widthInches: 20 },
  { size: "M", label: "Medium", lengthInches: 29, widthInches: 21 },
  { size: "L", label: "Large", lengthInches: 30, widthInches: 22 },
  { size: "XL", label: "XL", lengthInches: 31, widthInches: 23 },
  { size: "XXL", label: "XXL", lengthInches: 32, widthInches: 24 },
] as const;

export const AUTHORITATIVE_SIZING_NOTE =
  "At 1968 Clothing, we are committed to delivering consistency, quality, and accuracy across every garment we produce. Each piece is carefully measured and manufactured following a standardized sizing guide to ensure dependable fit and comfort. Our fabrics are pre-washed prior to production to help preserve structure, reduce shrinkage, and maintain the intended silhouette from first wear onward.";
