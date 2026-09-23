import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: {
  searchParams?: Promise<{ q?: string; category?: string; sort?: "newest" | "price_asc" | "price_desc" }>;
}) {
  const searchParams = await props.searchParams;
  const search = searchParams?.q || "";
  const categorySlug = searchParams?.category || "";
  const sort = searchParams?.sort || "newest";

  const categories = await getCategories();
  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined;

  const products = await getProducts({
    categoryId: activeCategory?.id,
    search: search || undefined,
    sort: sort,
  });

  // Build a category name lookup for card eyebrows
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <main id="main-content" className="store-container store-page min-h-screen">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <header className="mb-10">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Shop
        </p>
        <h1 className="mt-1.5 text-h1 text-foreground">
          {activeCategory ? activeCategory.name : "1968 Collection"}
        </h1>
      </header>

      <form method="GET" action="/products" className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] gap-2" role="search">
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
        <label htmlFor="catalog-search" className="sr-only">Search products</label>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="catalog-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search products…"
            enterKeyHint="search"
            autoComplete="off"
            className="h-11 rounded-full !pl-11 !pr-4"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 rounded-full px-5 font-mono text-[11px] uppercase tracking-widest">
          Search
        </Button>
      </form>

      {/* ── Category Pills ───────────────────────────────────────── */}
      <div
        className="mb-6 flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Category filters"
      >
        <Link
          href={`/products${sort !== "newest" ? `?sort=${sort}` : ""}`}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
            !categorySlug
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
          aria-current={!categorySlug ? "true" : undefined}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}${search ? `&q=${encodeURIComponent(search)}` : ""}${sort !== "newest" ? `&sort=${sort}` : ""}`}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
              categorySlug === cat.slug
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
            aria-current={categorySlug === cat.slug ? "true" : undefined}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* ── Count + Sort row ────────────────────────────────────── */}
      <div className="mb-8 flex flex-col items-stretch gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          {products.length} {products.length === 1 ? "product" : "products"}
        </span>

        <form method="GET" action="/products" className="grid w-full grid-cols-[1fr_auto] items-end gap-2 sm:flex sm:w-auto sm:items-center">
          {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
          {search && <input type="hidden" name="q" value={search} />}
          <label htmlFor="product-sort" className="col-span-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground sm:col-auto">Sort products</label>
          <Select name="sort" defaultValue={sort}>
            <SelectTrigger id="product-sort" className="w-full rounded-full font-mono text-[11px] uppercase tracking-widest text-foreground sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" className="rounded-full font-mono text-[11px] uppercase tracking-widest">Apply</Button>
        </form>
      </div>

      {/* ── Empty State ──────────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-sm text-muted-foreground mb-6">
            {search ? <>No products match “{search}”. Try another term or clear the filters.</> : <>No products match these filters.</>}
          </p>
          <Link
            href="/products"
            className="inline-block rounded-full border border-border px-6 py-2.5 font-mono text-[11px] uppercase tracking-widest text-foreground hover:border-foreground transition-colors"
          >
            View all
          </Link>
        </div>
      ) : (
        /* ── Product Grid ────────────────────────────────────────── */
        <section
          className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4"
          aria-label="Products"
        >
          {products.map((product, index) => {
            const imagePath = product.primary_image_path || "/images/1968%20CLOTHING%20V1.webp";
            const categoryName = product.category_id ? categoryMap[product.category_id] : null;

            return (
              <article key={product.id} className="group flex flex-col">
                {/* Product image — clickable for mouse users, aria-hidden for screen readers to avoid duplicate focus stop */}
                <Link
                  href={`/products/${product.slug}`}
                  className="relative block aspect-[4/5] w-full overflow-hidden rounded-md border border-border/70 bg-neutral-100 transition-[border-color,transform] hover:border-foreground/50 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-900 focus:outline-none"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <Image
                    src={imagePath}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, (min-width: 640px) 46vw, 100vw"
                    priority={index < 4}
                    className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </Link>

                {/* Card metadata */}
                <div className="mt-3.5 flex flex-col gap-0.5">
                  {categoryName && (
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {categoryName}
                    </p>
                  )}
                  <h2 className="text-body font-semibold leading-snug text-foreground">
                    <Link
                      href={`/products/${product.slug}`}
                      className="hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {product.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                    {formatMinorUnitsToPHP(product.min_price_minor)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {product.is_available ? "Available" : "Out of stock"}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
