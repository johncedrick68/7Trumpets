export type CustomerFulfillmentStage =
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPING"
  | "ARRIVING"
  | "DELIVERED"
  | "CANCELLED"
  | "DELIVERY_FAILED"
  | "UNKNOWN";

export interface FulfillmentStageInfo {
  stage: CustomerFulfillmentStage;
  label: string;
  description: string;
  isTerminal: boolean;
  isException: boolean;
  stepIndex: number; // 1 to 5 for standard linear progression, -1 for exceptions
}

/**
 * Maps authoritative canonical order statuses to customer-facing progress stages.
 * This is strictly a presentation-tier mapping and never written to database as a duplicate status.
 *
 * Canonical statuses in 10-migration contract:
 * - CONFIRMED -> CONFIRMED (Step 1)
 * - PROCESSING, PACKING, READY_FOR_SHIPMENT -> PREPARING (Step 2)
 * - SHIPPED, IN_TRANSIT -> SHIPPING (Step 3)
 * - OUT_FOR_DELIVERY -> ARRIVING (Step 4)
 * - DELIVERED, COMPLETED -> DELIVERED (Step 5)
 * - CANCELLED -> CANCELLED (Exception)
 * - DELIVERY_FAILED -> DELIVERY_FAILED (Exception)
 */
export function deriveCustomerFulfillmentStage(status: string): FulfillmentStageInfo {
  const normalized = status.toUpperCase();

  switch (normalized) {
    case "CONFIRMED":
      return {
        stage: "CONFIRMED",
        label: "Order Confirmed",
        description: "Your order has been received and confirmed.",
        isTerminal: false,
        isException: false,
        stepIndex: 1,
      };

    case "PROCESSING":
    case "PACKING":
    case "READY_FOR_SHIPMENT":
      return {
        stage: "PREPARING",
        label: "Preparing Order",
        description: "We are carefully assembling and packaging your devotional items.",
        isTerminal: false,
        isException: false,
        stepIndex: 2,
      };

    case "SHIPPED":
    case "IN_TRANSIT":
      return {
        stage: "SHIPPING",
        label: "In Transit",
        description: "Your package is on its way to your destination hub.",
        isTerminal: false,
        isException: false,
        stepIndex: 3,
      };

    case "OUT_FOR_DELIVERY":
      return {
        stage: "ARRIVING",
        label: "Out for Delivery",
        description: "Your package is with the courier for doorstep delivery today.",
        isTerminal: false,
        isException: false,
        stepIndex: 4,
      };

    case "DELIVERED":
    case "COMPLETED":
      return {
        stage: "DELIVERED",
        label: "Delivered",
        description: "Your package has been successfully delivered.",
        isTerminal: true,
        isException: false,
        stepIndex: 5,
      };

    case "CANCELLED":
      return {
        stage: "CANCELLED",
        label: "Order Cancelled",
        description: "This order has been cancelled.",
        isTerminal: true,
        isException: true,
        stepIndex: -1,
      };

    case "DELIVERY_FAILED":
      return {
        stage: "DELIVERY_FAILED",
        label: "Delivery Failed",
        description: "The courier was unable to deliver your package. We will contact you.",
        isTerminal: true,
        isException: true,
        stepIndex: -1,
      };

    default:
      return {
        stage: "UNKNOWN",
        label: normalized,
        description: "Order status is currently being updated.",
        isTerminal: false,
        isException: false,
        stepIndex: 1,
      };
  }
}
