import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getCategories, getProducts } from "@/lib/catalog/queries";
import { SearchIcon, ArrowRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

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

  return (
    <main className="w-full min-h-screen px-4 py-8 md:py-12 max-w-7xl mx-auto">
      <div>
        <header className="mb-8">
          <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
            1968 Archive
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-1 mb-2">
            {activeCategory ? activeCategory.name : "All Streetwear Pieces"}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
            {activeCategory?.description || "Independent Filipino streetwear. Limited archival releases, made to be worn."}
          </p>
        </header>

        {/* Collection Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Category filters">
            <Button
              variant={!categorySlug ? "default" : "outline"}
              asChild
              className="rounded-full"
            >
              <Link href="/products">
                All ({products.length})
              </Link>
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={categorySlug === cat.slug ? "default" : "outline"}
                asChild
                className="rounded-full"
              >
                <Link href={`/products?category=${cat.slug}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>
                  {cat.name}
                </Link>
              </Button>
            ))}
          </div>

          <form method="GET" action="/products" className="w-full md:w-auto relative">
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            <div className="relative flex items-center">
              <SearchIcon size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Search pieces..."
                aria-label="Search products"
                className="pl-9 w-full md:w-64 rounded-full"
              />
            </div>
          </form>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-xl border border-border border-dashed">
            <p className="text-muted-foreground font-mono text-sm mb-4">
              No pieces found matching your criteria.
            </p>
            <Button variant="outline" asChild>
              <Link href="/products">
                Reset Filters
              </Link>
            </Button>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-label="Products">
            {products.map((product) => {
              const imagePath = product.primary_image_path || "/images/1968%20CLOTHING%20V1.webp";

              return (
                <Card key={product.id} className="overflow-hidden flex flex-col group border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative aspect-square bg-muted">
                    <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden="true" className="block w-full h-full">
                      <Image
                        src={imagePath}
                        alt={product.name}
                        width={400}
                        height={400}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>
                    <Badge className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-widest pointer-events-none">
                      New
                    </Badge>
                  </div>

                  <CardContent className="flex flex-col flex-1 p-5 gap-2">
                    <h2 className="font-bold text-lg leading-tight">
                      <Link href={`/products/${product.slug}`} className="hover:underline decoration-2 underline-offset-4">
                        {product.name}
                      </Link>
                    </h2>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    <div className="mt-auto pt-4 font-mono font-bold text-lg">
                      {formatMinorUnitsToPHP(product.min_price_minor)}
                    </div>
                  </CardContent>

                  <CardFooter className="p-5 pt-0 mt-auto">
                    <Button variant="secondary" className="w-full flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors" asChild>
                      <Link href={`/products/${product.slug}`}>
                        <span>Select Size</span>
                        <ArrowRightIcon size={12} className="opacity-70 group-hover:opacity-100" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
