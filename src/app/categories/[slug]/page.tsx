import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatMinorUnitsToPHP, getCategories, getCategoryBySlug, getProducts } from "@/lib/catalog/queries";
import { ArrowRightIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([
    getCategoryBySlug(slug),
    getCategories(),
  ]);

  if (!category) {
    notFound();
  }

  const products = await getProducts({ categoryId: category.id });

  return (
    <main className="min-h-screen px-4 py-8 md:py-12 max-w-7xl mx-auto">
      <div>
        <header className="mb-8">
          <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
            1968 Archive
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-1 mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
              {category.description}
            </p>
          )}
        </header>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8" aria-label="Product categories">
            <Button variant="outline" asChild className="rounded-full">
              <Link href="/products">
                All
              </Link>
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={cat.id === category.id ? "default" : "outline"}
                asChild
                className="rounded-full"
              >
                <Link href={`/categories/${cat.slug}`}>
                  {cat.name}
                </Link>
              </Button>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-16 px-4 bg-muted/30 rounded-xl border border-border border-dashed">
            <p className="text-muted-foreground font-mono text-sm mb-4">
              No products found in this category.
            </p>
            <Button variant="outline" asChild>
              <Link href="/products">
                Explore All Drops &rarr;
              </Link>
            </Button>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" aria-label={`Products in ${category.name}`}>
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
