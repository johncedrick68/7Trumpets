import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="store-container page-section min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md text-center py-12 px-6">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted text-foreground">
          <Compass className="size-8 stroke-[1.5]" />
        </div>

        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          404 — Page Not Found
        </p>

        <h1 className="mt-3 text-h1 text-foreground">
          Off the Map
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-sm mx-auto">
          The archival release or page you are looking for has been moved, retired, or does not exist.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="h-12 px-6 font-semibold bg-primary text-primary-foreground">
            <Link href="/products" className="flex items-center justify-center gap-2">
              <span>Explore Collection</span>
              <ArrowRight className="size-4" />
            </Link>
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

