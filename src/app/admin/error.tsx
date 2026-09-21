"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-lg border-destructive/30 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Operational Data Unavailable</CardTitle>
              <CardDescription className="text-xs font-mono uppercase tracking-wider mt-0.5">
                Admin Error Boundary Caught
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The operational request failed safely. No corrupted or empty data state should be assumed.
          </p>
          {error.digest && (
            <div className="p-2.5 rounded bg-muted font-mono text-xs text-muted-foreground">
              Error Digest: {error.digest}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
          <Button
            onClick={reset}
            className="w-full sm:w-auto flex items-center gap-2"
          >
            <RefreshCw className="size-4" />
            <span>Retry Operation</span>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/admin" className="flex items-center gap-2">
              <LayoutDashboard className="size-4" />
              <span>Admin Overview</span>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

