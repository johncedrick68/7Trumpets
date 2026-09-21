"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="store-container page-section min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md text-center py-12 px-6">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-8 stroke-[1.5]" />
        </div>

        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          System Error
        </p>

        <h1 className="mt-3 text-h2 text-foreground">
          Something Went Wrong
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-sm mx-auto">
          We encountered an unexpected issue while processing your request. Please try again or return to the storefront.
        </p>

        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
            Ref: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            size="lg"
            className="h-12 px-6 font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="size-4" />
            <span>Try Again</span>
          </Button>

          <Button asChild variant="outline" size="lg" className="h-12 px-6 font-semibold">
            <Link href="/">
              Return Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

