import React from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";
export type StatusVariant = StatusBadgeVariant;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusBadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<StatusBadgeVariant, { container: string; dot: string }> = {
  success: {
    container: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  warning: {
    container: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  danger: {
    container: "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    dot: "bg-rose-500",
  },
  info: {
    container: "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800",
    dot: "bg-sky-500",
  },
  neutral: {
    container: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

export function StatusBadge({
  variant = "neutral",
  dot = true,
  children,
  className,
  ...props
}: StatusBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight whitespace-nowrap",
        styles.container,
        className
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", styles.dot)} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

/**
 * Standard mapper from domain status strings to TailAdmin badge variants
 */
export function mapStatusToVariant(status: string): StatusBadgeVariant {
  const s = status.toUpperCase();
  switch (s) {
    case "PAID":
    case "PUBLISHED":
    case "ACTIVE":
    case "DELIVERED":
    case "COMPLETED":
    case "OPEN":
    case "ACCEPTED":
    case "SUCCESS":
      return "success";

    case "PENDING":
    case "SUBMITTED":
    case "WAITING_FOR_STAFF":
    case "WAITING_FOR_CUSTOMER":
    case "READY_FOR_SHIPMENT":
    case "CONFIRMED":
    case "REQUESTED":
    case "LOW_STOCK":
      return "warning";

    case "FAILED":
    case "CANCELLED":
    case "REJECTED":
    case "DELIVERY_FAILED":
    case "OUT_OF_STOCK":
    case "REVOKED":
    case "EXPIRED":
      return "danger";

    case "PROCESSING":
    case "PACKING":
    case "SHIPPED":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "STAFF_HANDLING":
      return "info";

    case "DRAFT":
    case "ARCHIVED":
    case "CLOSED":
    case "UNPAID":
    default:
      return "neutral";
  }
}
