import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ColumnAlign = "left" | "right" | "center";

interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function AdminTableContainer({ children, className, ...props }: TableContainerProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        className
      )}
      {...props}
    >
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  );
}

export function AdminTable({
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full caption-bottom text-sm border-collapse", className)}
      {...props}
    >
      {children}
    </table>
  );
}

export function AdminTableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-border bg-muted/40 text-muted-foreground", className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export function AdminTableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-border bg-card", className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function AdminTableRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

interface AdminTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: ColumnAlign;
}

export function AdminTableHead({
  className,
  align = "left",
  children,
  ...props
}: AdminTableHeadProps) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
      ? "text-center"
      : "text-left";

  return (
    <th
      scope="col"
      className={cn(
        "h-11 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
        alignClass,
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

interface AdminTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: ColumnAlign;
}

export function AdminTableCell({
  className,
  align = "left",
  children,
  ...props
}: AdminTableCellProps) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
      ? "text-center"
      : "text-left";

  return (
    <td
      className={cn(
        "px-4 py-3.5 text-sm font-medium text-foreground align-middle",
        alignClass,
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function AdminTableEmpty({
  colSpan = 5,
  title = "No records found",
  description = "No items match your filter criteria or have been created yet.",
  action,
}: {
  colSpan?: number;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 px-4 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Inbox className="size-6" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </td>
    </tr>
  );
}

export function AdminTableError({
  colSpan = 5,
  title = "Failed to load data",
  description = "A database or network error occurred while querying records.",
  onRetry,
}: {
  colSpan?: number;
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 px-4 text-center">
        <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
          <div className="size-12 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          {onRetry && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry query
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function AdminTableLoading({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-border last:border-0">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="px-4 py-4">
              <div className="h-4 bg-muted animate-pulse rounded-md w-full max-w-[80%]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminTablePagination({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  pageSize = 20,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 bg-muted/20">
      <div className="text-xs text-muted-foreground">
        {totalItems !== undefined ? (
          <span>
            Showing <strong className="font-semibold text-foreground">{startItem}</strong> to{" "}
            <strong className="font-semibold text-foreground">{endItem}</strong> of{" "}
            <strong className="font-semibold text-foreground">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-foreground">{currentPage}</strong> of{" "}
            <strong className="font-semibold text-foreground">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange?.(currentPage - 1)}
          className="h-8 gap-1 px-2.5 text-xs font-medium"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          <span>Previous</span>
        </Button>
        <span className="px-2 text-xs font-medium text-muted-foreground">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange?.(currentPage + 1)}
          className="h-8 gap-1 px-2.5 text-xs font-medium"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title = "No records found",
  description = "No items match your filter criteria or have been created yet.",
  action,
  icon: Icon = Inbox,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border bg-card",
        className
      )}
    >
      <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
        <Icon className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AdminErrorState({
  title = "Failed to load records",
  description = "An unexpected error occurred while communicating with the database.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/10",
        className
      )}
    >
      <div className="size-12 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400 flex items-center justify-center mb-3">
        <AlertCircle className="size-6" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">{description}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry query
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminLoadingState({
  message = "Loading records...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-3", className)}>
      <div className="size-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
      <p className="text-xs font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

