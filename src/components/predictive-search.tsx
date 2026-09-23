"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  category: string;
  image: string | null;
  priceMinor: number;
  available: boolean;
};

function formatPHP(minorUnits: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function PredictiveSearch({
  inputRef,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"initial" | "loading" | "ready" | "error">("initial");
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized) {
      setResults([]);
      setState("initial");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setResults([]);
      setState("loading");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = (await response.json()) as { results?: SearchResult[] };
        setResults(payload.results ?? []);
        setState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setState("error");
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().replace(/\s+/g, " ");
    onClose();
    router.push(normalized ? `/products?q=${encodeURIComponent(normalized)}` : "/products");
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      resultRefs.current[0]?.focus();
    }
  }

  function onResultKeyDown(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      resultRefs.current[Math.min(index + 1, results.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else resultRefs.current[index - 1]?.focus();
    }
  }

  const status = state === "loading"
    ? "Searching products"
    : state === "error"
      ? "Search is temporarily unavailable"
      : state === "ready"
        ? `${results.length} ${results.length === 1 ? "result" : "results"} found`
        : "Type to search products";

  return (
    <div className="header-search-inner">
      <form method="GET" action="/products" className="header-search-form" role="search" onSubmit={submit}>
        <SearchIcon size={18} className="header-search-icon" aria-hidden="true" />
        <label htmlFor="header-search-input" className="sr-only">Search products</label>
        <input
          ref={inputRef}
          id="header-search-input"
          type="search"
          name="q"
          placeholder="Search products, collections…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          enterKeyHint="search"
          className="header-search-input"
          aria-controls="predictive-search-results"
        />
        <button type="submit" className="header-search-submit">View all results</button>
        <button type="button" onClick={onClose} className="header-search-close" aria-label="Close search">
          <span aria-hidden="true">✕</span>
        </button>
      </form>

      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      <div id="predictive-search-results" className="predictive-search-results">
        {state === "loading" ? <p className="predictive-search-message">Searching…</p> : null}
        {state === "error" ? <p className="predictive-search-message">Search is temporarily unavailable. Press Enter to view catalog results.</p> : null}
        {state === "ready" && results.length === 0 ? (
          <div className="predictive-search-message">
            <p>No pieces found for “{query.trim()}”.</p>
            <Link href="/products" onClick={onClose}>Browse all pieces</Link>
          </div>
        ) : null}
        {results.length > 0 ? (
          <ul aria-label="Product suggestions" className="predictive-search-list">
            {results.map((result, index) => (
              <li key={result.id}>
                <Link
                  ref={(node) => { resultRefs.current[index] = node; }}
                  href={`/products/${result.slug}`}
                  onClick={onClose}
                  onKeyDown={(event) => onResultKeyDown(event, index)}
                  className="predictive-search-result"
                >
                  <span className="predictive-search-thumb">
                    <Image src={result.image || "/images/1968%20CLOTHING%20V1.webp"} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                  <span className="predictive-search-copy">
                    <span className="predictive-search-name">{result.name}</span>
                    <span>{result.category}</span>
                  </span>
                  <span className="predictive-search-price">
                    {formatPHP(result.priceMinor)}
                    {!result.available ? <span>Out of stock</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
