"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSubmitButton({ children, pendingText, variant = "default", className }: { children: React.ReactNode; pendingText: string; variant?: "default" | "outline"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} disabled={pending} aria-disabled={pending} className={cn("h-12 w-full text-sm font-semibold", className)}>
      {pending ? pendingText : children}
    </Button>
  );
}
