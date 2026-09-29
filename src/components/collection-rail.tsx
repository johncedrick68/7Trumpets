import Link from "next/link";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

interface CollectionRailProps {
  categories: CategoryItem[];
  activeSlug?: string;
  baseUrl?: string;
  preserveParams?: {
    sort?: string;
    q?: string;
    availability?: string;
  };
}

export function CollectionRail({
  categories,
  activeSlug,
  baseUrl = "/products",
  preserveParams,
}: CollectionRailProps) {
  function buildHref(catSlug?: string) {
    const sp = new URLSearchParams();
    if (catSlug) sp.set("category", catSlug);
    if (preserveParams?.q) sp.set("q", preserveParams.q);
    if (preserveParams?.sort && preserveParams.sort !== "newest") sp.set("sort", preserveParams.sort);
    if (preserveParams?.availability && preserveParams.availability !== "all") {
      sp.set("availability", preserveParams.availability);
    }
    const qs = sp.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  const isAllActive = !activeSlug;

  return (
    <nav aria-label="Collections" className="catalog-rail w-full overflow-x-auto scrollbar-none mb-6">
      <div
        className="flex items-center gap-0 w-full flex-nowrap"
        role="group"
        aria-label="Category collection rail"
      >
        <Link
          href={buildHref()}
          className={`catalog-rail-link ${isAllActive ? "is-active font-bold" : ""}`}
          aria-current={isAllActive ? "page" : undefined}
        >
          All
        </Link>
        {categories.map((category) => {
          const isActive = activeSlug === category.slug;
          return (
            <Link
              key={category.id}
              href={buildHref(category.slug)}
              className={`catalog-rail-link ${isActive ? "is-active font-bold" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {category.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
