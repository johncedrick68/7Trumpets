export function normalizeSearchTerm(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function scoreCatalogSearch(
  searchable: { name: string; category: string; skus: string[] },
  rawQuery: string,
) {
  const query = normalizeSearchTerm(rawQuery);
  if (!query) return Number.POSITIVE_INFINITY;

  const name = normalizeSearchTerm(searchable.name);
  const category = normalizeSearchTerm(searchable.category);
  const skus = searchable.skus.map(normalizeSearchTerm);

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (skus.some((sku) => sku === query)) return 3;
  if (skus.some((sku) => sku.startsWith(query))) return 4;
  if (category.startsWith(query)) return 5;
  if (category.includes(query)) return 6;
  return Number.POSITIVE_INFINITY;
}
