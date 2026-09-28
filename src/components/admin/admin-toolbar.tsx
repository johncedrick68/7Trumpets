import * as React from "react";
import { cn } from "@/lib/utils";

interface AdminToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * TailAdmin canonical operational toolbar.
 * Standardizes spacing and flex-wrap alignment above data tables and lists.
 */
export function AdminToolbar({ children, className, ...props }: AdminToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
