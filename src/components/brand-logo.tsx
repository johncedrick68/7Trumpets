import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoVariant = "header-sm" | "header" | "footer" | "admin";

const sizes: Record<BrandLogoVariant, { width: number; height: number }> = {
  "header-sm": { width: 100, height: 42 },
  header: { width: 116, height: 49 },
  footer: { width: 110, height: 46 },
  admin: { width: 112, height: 47 },
};

export function BrandLogo({ variant = "header", className, priority = false }: { variant?: BrandLogoVariant; className?: string; priority?: boolean }) {
  const size = sizes[variant];
  return (
    <Image
      src="/images/1968-logo-cropped.webp"
      alt="1968 Clothing"
      width={size.width}
      height={size.height}
      priority={priority}
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
      className={cn("object-contain invert dark:invert-0", className)}
    />
  );
}
