"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type SearchFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  onClear?: () => void;
};

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, value, onClear, ...props }, ref) => (
    <div className="relative w-full">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        ref={ref}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        className={cn("h-11 bg-background !pl-11 !pr-11", className)}
      />
      {onClear && String(value ?? "").length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear search"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  ),
);
SearchField.displayName = "SearchField";
