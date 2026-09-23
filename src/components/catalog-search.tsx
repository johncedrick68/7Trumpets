"use client";

import { type FormEvent, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function CatalogSearch({
  query,
  category,
  sort,
  availability,
}: {
  query: string;
  category: string;
  sort: string;
  availability: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setValue(query), [query]);

  const urlFor = useCallback((nextQuery: string) => {
    const params = new URLSearchParams();
    const normalized = nextQuery.trim().replace(/\s+/g, " ");
    if (normalized) params.set("q", normalized);
    if (category) params.set("category", category);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (availability && availability !== "all") params.set("availability", availability);
    const search = params.toString();
    return search ? `/products?${search}` : "/products";
  }, [availability, category, sort]);

  useEffect(() => {
    if (value.trim().replace(/\s+/g, " ") === query) return;
    const timeout = window.setTimeout(() => {
      startTransition(() => router.replace(urlFor(value), { scroll: false }));
    }, 225);
    return () => window.clearTimeout(timeout);
    // Filter values are intentionally dependencies so search never discards them.
  }, [query, router, urlFor, value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => router.push(urlFor(value), { scroll: false }));
  }

  return (
    <form method="GET" action="/products" className="catalog-search" role="search" onSubmit={submit}>
      {category ? <input type="hidden" name="category" value={category} /> : null}
      {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
      {availability !== "all" ? <input type="hidden" name="availability" value={availability} /> : null}
      <label htmlFor="catalog-search" className="sr-only">Search products</label>
      <Search className="catalog-search-icon" aria-hidden="true" />
      <Input
        id="catalog-search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products, collections…"
        enterKeyHint="search"
        autoComplete="off"
        className="h-11 rounded-none !pl-11 !pr-24 font-mono text-xs"
      />
      <span className="catalog-search-state" aria-live="polite">{isPending ? "Updating…" : "Live results"}</span>
    </form>
  );
}
