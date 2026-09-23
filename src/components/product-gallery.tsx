"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string; alt: string; position: number; variantId: string | null };

export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [selected, setSelected] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const select = useCallback((index: number) => {
    setSelected(index);
    api?.scrollTo(index);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    update();
    api.on("select", update);
    return () => { api.off("select", update); };
  }, [api]);

  useEffect(() => {
    if (!viewerOpen) setZoom(1);
  }, [viewerOpen]);

  const current = images[selected];
  if (!current) return null;

  return (
    <div className="w-full min-w-0">
      {/* ── Mobile Carousel ──────────────────────────────────── */}
      <div className="lg:hidden">
        <Carousel setApi={setApi} opts={{ loop: images.length > 1 }} aria-label={`${productName} image gallery`}>
          <CarouselContent className="ml-0">
            {images.map((image, index) => (
              <CarouselItem key={image.id} className="pl-0">
                <button
                  type="button"
                  onClick={() => { setSelected(index); setViewerOpen(true); }}
                  className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl border border-border/80 bg-neutral-100 dark:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open image ${index + 1} of ${images.length} in full screen viewer`}
                >
                  <Image
                    src={image.url}
                    alt={image.alt || `${productName} view ${index + 1}`}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 1023px) calc(100vw - 2rem), 1px"
                    className="object-cover"
                  />
                  <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 font-mono text-xs font-semibold shadow-sm">
                    {index + 1} / {images.length}
                  </span>
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {images.length > 1 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Swipe to see all {images.length} images
          </p>
        )}
      </div>

      {/* ── Desktop Gallery ─────────────────────────────────── */}
      <div className="hidden lg:block space-y-3">
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl border border-border/80 bg-neutral-100 dark:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Open image ${selected + 1} of ${images.length} in full screen viewer`}
        >
          <Image
            src={current.url}
            alt={current.alt || `${productName} view ${selected + 1}`}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transform-none"
          />
          <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 font-mono text-xs font-semibold shadow-sm">
            <Maximize2 className="size-3.5" aria-hidden="true" />
            <span>{selected + 1} / {images.length}</span>
          </span>
        </button>

        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-3" role="tablist" aria-label="Choose product image">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                role="tab"
                aria-selected={selected === index}
                aria-label={`View image ${index + 1} of ${images.length}`}
                onClick={() => select(index)}
                className={cn(
                  "relative aspect-[4/5] min-h-[44px] overflow-hidden rounded-lg border bg-neutral-100 dark:bg-neutral-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected === index
                    ? "border-foreground ring-2 ring-foreground"
                    : "border-border hover:border-foreground/60 opacity-80 hover:opacity-100"
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="10vw"
                  className="object-cover"
                />
                <span className="sr-only">Image {index + 1}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Accessible Fullscreen Viewer Dialog ─────────────── */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") select((selected - 1 + images.length) % images.length);
            if (event.key === "ArrowRight") select((selected + 1) % images.length);
          }}
          className="h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-6xl overflow-hidden border-0 bg-neutral-950 p-0 text-white sm:max-w-6xl"
        >
          <DialogTitle className="sr-only">{productName} image viewer</DialogTitle>
          <DialogDescription className="sr-only">
            Image {selected + 1} of {images.length}. Use arrow keys or controls to move between images.
          </DialogDescription>
          <div className="relative flex h-full min-h-0 items-center justify-center overflow-auto p-4 pt-14 sm:p-10">
            <div className="relative h-full w-full transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
              <Image
                src={current.url}
                alt={current.alt || `${productName} view ${selected + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/75 p-2 shadow-lg backdrop-blur-xs">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => select((selected - 1 + images.length) % images.length)}
              aria-label="Previous image"
              className="size-11"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-14 text-center font-mono text-xs">{selected + 1} / {images.length}</span>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => select((selected + 1) % images.length)}
              aria-label="Next image"
              className="size-11"
            >
              <ChevronRight className="size-5" />
            </Button>
            <span className="mx-1 h-6 w-px bg-white/25" />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
              aria-label="Zoom out"
              className="size-11"
            >
              <Minus className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={zoom >= 3}
              onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
              aria-label="Zoom in"
              className="size-11"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
