import { MOCK_PRODUCTS, MOCK_REVIEWS } from './constants';
import { getOrdersForUser as getOrdersForUserFromStore } from './orders';
import { supabase, withFallback, isSupabaseConfigured } from './supabase';
import type { Order, Product, Review, Role } from './types';

const wishlistStorageKey = 'bloom-shop-wishlist';

export async function getProducts(): Promise<Product[]> {
  return withFallback(
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    MOCK_PRODUCTS,
  );
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.is_featured);
}

export async function getProductById(id: string): Promise<Product | null> {
  const fallback = MOCK_PRODUCTS.find((product) => product.id === id) ?? null;
  return withFallback(supabase.from('products').select('*').eq('id', id).maybeSingle(), fallback);
}

export async function getReviewsByProduct(productId: string): Promise<Review[]> {
  const fallback = MOCK_REVIEWS.filter((review) => review.product_id === productId);
  return withFallback(
    supabase
      .from('reviews')
      .select('*, users(full_name, avatar_url)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false }),
    fallback,
  ).then((rows) =>
    rows.map((row: Review & { users?: { full_name: string; avatar_url: string } }) => ({
      ...row,
      user: row.user ?? row.users,
    })),
  );
}

export async function createReview(
  review: Pick<Review, 'product_id' | 'user_id' | 'rating' | 'comment'> & {
    user?: Review['user'];
  },
) {
  if (!isSupabaseConfigured) {
    return {
      data: {
        ...review,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      } satisfies Review,
      error: null,
    };
  }

  const { user, ...insertable } = review;
  const result = await supabase.from('reviews').insert(insertable).select().single();
  return result;
}

export async function getOrdersForUser(userId: string, role: string): Promise<Order[]> {
  return getOrdersForUserFromStore(userId, role as Role);
}

export function getWishlistIds(userId?: string | null): string[] {
  if (!userId) return [];
  const raw = localStorage.getItem(`${wishlistStorageKey}:${userId}`);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export function toggleWishlistId(userId: string, productId: string): string[] {
  const current = getWishlistIds(userId);
  const next = current.includes(productId)
    ? current.filter((item) => item !== productId)
    : [...current, productId];
  localStorage.setItem(`${wishlistStorageKey}:${userId}`, JSON.stringify(next));
  return next;
}

export async function getRecommendedProducts(excludeIds: string[] = []): Promise<Product[]> {
  const products = await getProducts();
  return [...products]
    .filter((product) => !excludeIds.includes(product.id))
    .sort((a, b) => b.review_count * b.avg_rating - a.review_count * a.avg_rating)
    .slice(0, 4);
}
