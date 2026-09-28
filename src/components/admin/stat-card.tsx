import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTone = "neutral" | "warning" | "danger" | "success" | "info";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: StatTone;
  badge?: React.ReactNode;
  className?: string;
}

const toneStyles: Record<StatTone, { border: string; bg: string; icon: string }> = {
  neutral: {
    border: "border-border",
    bg: "bg-card",
    icon: "text-muted-foreground",
  },
  warning: {
    border: "border-amber-200 dark:border-amber-900/60",
    bg: "bg-amber-50/40 dark:bg-amber-950/20",
    icon: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    border: "border-rose-200 dark:border-rose-900/60",
    bg: "bg-rose-50/40 dark:bg-rose-950/20",
    icon: "text-rose-600 dark:text-rose-400",
  },
  success: {
    border: "border-emerald-200 dark:border-emerald-900/60",
    bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  info: {
    border: "border-sky-200 dark:border-sky-900/60",
    bg: "bg-sky-50/40 dark:bg-sky-950/20",
    icon: "text-sky-600 dark:text-sky-400",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  tone = "neutral",
  badge,
  className,
}: StatCardProps) {
  const styles = toneStyles[tone];

  const content = (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5 shadow-xs transition-all",
        styles.border,
        styles.bg,
        href && "hover:border-foreground/30 hover:shadow-sm cursor-pointer group",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {title}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {Icon && (
            <div className={cn("size-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0", styles.icon)}>
              <Icon className="size-4" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums group-hover:text-primary transition-colors">
        {value}
      </p>

      {subtitle && (
        <div className="mt-1.5 text-xs text-muted-foreground leading-normal">
          {subtitle}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
