"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AdminFilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search records...",
  filters,
  activeFilterCount = 0,
  onResetFilters,
  actions,
  className,
}: AdminFilterBarProps) {
  const isFiltered = Boolean(searchValue) || activeFilterCount > 0;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4",
        className
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <div className="relative w-full sm:w-72 lg:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              type="text"
              value={searchValue || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 pl-9 pr-8 text-sm bg-background border-border"
              aria-label={searchPlaceholder}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                aria-label="Clear search"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}

        {isFiltered && onResetFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            aria-label="Reset all filters"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Reset filters</span>
            {activeFilterCount > 0 && (
              <span className="size-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
