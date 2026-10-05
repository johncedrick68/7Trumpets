import { createClient } from '@/lib/supabase/server';
import { Product, Category } from '@/types';
import { StorefrontShowcase } from '@/components/storefront-showcase';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch categories
  const { data: categoriesData } = await supabase
    .from('categories')
    .select('*')
    .order('position', { ascending: true });

  const categories: Category[] = categoriesData || [
    { id: 'c1', name: 'Current Drops', slug: 'drops', position: 1 },
    { id: 'c2', name: 'San Roque Collection', slug: 'san-roque', position: 2 },
    { id: 'c3', name: '1968 Classics', slug: 'classics', position: 3 },
  ];

  // Fetch products with variants and images
  const { data: productsData } = await supabase
    .from('products')
    .select(`
      id,
      category_id,
      name,
      slug,
      description,
      status,
      category:categories(*),
      variants:product_variants(*),
      images:product_images(*)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: true });

  // Map products
  const products: Product[] = (productsData as unknown as Product[]) || [];

  return (
    <StorefrontShowcase initialProducts={products} categories={categories} />
  );
}
