export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string; // e.g. "Size M"
  price_minor: number; // in centavos, e.g. 49900 = ₱499.00
  compare_at_price_minor?: number | null;
  status: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string;
  position: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  category?: Category;
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string; // size
  priceMinor: number;
  image: string;
  quantity: number;
}
