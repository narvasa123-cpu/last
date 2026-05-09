import { MOCK_PRODUCTS, MOCK_REVIEWS } from './constants';
import { getOrdersForUser as getOrdersForUserFromStore } from './orders';
import { supabase, withFallback, isSupabaseConfigured } from './supabase';
import type { DeliveryAddress, Order, Product, Review, Role } from './types';

const wishlistStorageKey = 'bloom-shop-wishlist';
const addressBookStorageKey = 'bloom-shop-address-book';
const addressBookDisabledKey = 'bloom-shop:delivery-addresses-disabled';
let demoReviews: Review[] = [...MOCK_REVIEWS];
let demoProducts: Product[] = [...MOCK_PRODUCTS];
let hasDeliveryAddressesTable: boolean | null =
  typeof window !== 'undefined' && window.sessionStorage.getItem(addressBookDisabledKey) === 'true'
    ? false
    : null;
let deliveryAddressesCheckPromise: Promise<boolean> | null = null;

function getAddressStorageKey(userId: string) {
  return `${addressBookStorageKey}:${userId}`;
}

function readDemoAddresses(userId: string): DeliveryAddress[] {
  const raw = localStorage.getItem(getAddressStorageKey(userId));
  if (raw) {
    try {
      return JSON.parse(raw) as DeliveryAddress[];
    } catch {
      return [];
    }
  }
  return [];
}

function writeDemoAddresses(userId: string, addresses: DeliveryAddress[]) {
  localStorage.setItem(getAddressStorageKey(userId), JSON.stringify(addresses));
}

function isMissingDeliveryAddressesTable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; statusCode?: number };
  const message = candidate.message?.toLowerCase() ?? '';
  return (
    candidate.code === 'PGRST205' ||
    candidate.code === 'PGRST104' ||
    candidate.code === '42P01' ||
    candidate.statusCode === 404 ||
    message.includes("could not find the table 'public.delivery_addresses'") ||
    message.includes('delivery_addresses') ||
    message.includes('relation') ||
    message.includes('does not exist')
  );
}

function disableDeliveryAddressesTable() {
  hasDeliveryAddressesTable = false;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(addressBookDisabledKey, 'true');
  }
}

async function checkDeliveryAddressesTable(): Promise<boolean> {
  if (hasDeliveryAddressesTable !== null) return hasDeliveryAddressesTable;
  if (deliveryAddressesCheckPromise) return deliveryAddressesCheckPromise;

  deliveryAddressesCheckPromise = (async () => {
    const { error } = await supabase
      .from('delivery_addresses')
      .select('id', { head: true })
      .limit(1);

    if (isMissingDeliveryAddressesTable(error)) {
      disableDeliveryAddressesTable();
      return false;
    }
    hasDeliveryAddressesTable = true;
    return true;
  })();

  try {
    return await deliveryAddressesCheckPromise;
  } finally {
    deliveryAddressesCheckPromise = null;
  }
}

function saveDemoAddress(address: DeliveryAddress): DeliveryAddress {
  const current = readDemoAddresses(address.user_id);
  const normalized = address.is_default
    ? current.map((entry) => ({ ...entry, is_default: false, updated_at: address.updated_at }))
    : current;
  const next = [
    address,
    ...normalized.filter((entry) => entry.id !== address.id),
  ];
  writeDemoAddresses(address.user_id, next);
  return address;
}

function fallbackAddresses(userId: string, profile?: { full_name?: string; phone?: string; address?: string } | null) {
  const saved = readDemoAddresses(userId);
  if (saved.length) return saved;
  if (!profile?.address) return [];
  const now = new Date().toISOString();
  const seeded: DeliveryAddress[] = [
    {
      id: `address-${userId}-default`,
      user_id: userId,
      label: 'Home',
      recipient_name: profile.full_name ?? 'Bloom customer',
      phone: profile.phone ?? '',
      address: profile.address,
      delivery_notes: null,
      is_default: true,
      created_at: now,
      updated_at: now,
    },
  ];
  writeDemoAddresses(userId, seeded);
  return seeded;
}

export async function getProducts(): Promise<Product[]> {
  return withFallback(
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    demoProducts,
  );
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.is_featured);
}

export async function getProductById(id: string): Promise<Product | null> {
  const fallback = demoProducts.find((product) => product.id === id) ?? null;
  return withFallback(supabase.from('products').select('*').eq('id', id).maybeSingle(), fallback);
}

export async function getReviewsByProduct(productId: string): Promise<Review[]> {
  const fallback = demoReviews.filter((review) => review.product_id === productId);
  return withFallback(
    supabase
      .from('reviews')
      .select('*, users(full_name, avatar_url)')
      .eq('product_id', productId)
      .eq('is_hidden', false)
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
    const createdReview = {
      ...review,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    } satisfies Review;
    demoReviews = [createdReview, ...demoReviews];
    const visibleReviews = demoReviews.filter((entry) => entry.product_id === review.product_id && !entry.is_hidden);
    demoProducts = demoProducts.map((product) =>
      product.id === review.product_id
        ? {
            ...product,
            avg_rating:
              visibleReviews.reduce((sum, entry) => sum + entry.rating, 0) / Math.max(1, visibleReviews.length),
            review_count: visibleReviews.length,
          }
        : product,
    );
    return {
      data: createdReview,
      error: null,
    };
  }

  const { user, ...insertable } = review;
  const result = await supabase.from('reviews').insert(insertable).select().single();
  return result;
}

export async function getCustomerAddresses(
  userId: string,
  profile?: { full_name?: string; phone?: string; address?: string } | null,
): Promise<DeliveryAddress[]> {
  const fallback = fallbackAddresses(userId, profile);
  if (!isSupabaseConfigured) {
    return fallback;
  }

  const tableExists = await checkDeliveryAddressesTable();
  if (!tableExists) {
    return fallback;
  }

  const rows = await withFallback(
    supabase
      .from('delivery_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }),
    fallback,
  );
  return rows as DeliveryAddress[];
}

export async function saveCustomerAddress(
  address: Omit<DeliveryAddress, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string },
): Promise<{ data: DeliveryAddress | null; error: string | null }> {
  const now = new Date().toISOString();
  const nextAddress: DeliveryAddress = {
    ...address,
    created_at: address.created_at ?? now,
    updated_at: now,
  };

  if (!isSupabaseConfigured || hasDeliveryAddressesTable === false) {
    return { data: saveDemoAddress(nextAddress), error: null };
  }

  if (address.is_default) {
    const { error: clearDefaultError } = await supabase
      .from('delivery_addresses')
      .update({ is_default: false })
      .eq('user_id', address.user_id);

    if (isMissingDeliveryAddressesTable(clearDefaultError)) {
      disableDeliveryAddressesTable();
      return { data: saveDemoAddress(nextAddress), error: null };
    }
  }

  const { data, error } = await supabase
    .from('delivery_addresses')
    .upsert(nextAddress)
    .select()
    .maybeSingle();

  if (isMissingDeliveryAddressesTable(error)) {
    disableDeliveryAddressesTable();
    return { data: saveDemoAddress(nextAddress), error: null };
  }

  return {
    data: data as DeliveryAddress | null,
    error: error?.message ?? (data ? null : 'Unable to save the address.'),
  };
}

export async function deleteCustomerAddress(
  userId: string,
  addressId: string,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || hasDeliveryAddressesTable === false) {
    const next = readDemoAddresses(userId).filter((entry) => entry.id !== addressId);
    const hasDefault = next.some((entry) => entry.is_default);
    writeDemoAddresses(
      userId,
      hasDefault || !next.length
        ? next
        : next.map((entry, index) => ({ ...entry, is_default: index === 0 })),
    );
    return { error: null };
  }

  const { error } = await supabase
    .from('delivery_addresses')
    .delete()
    .eq('user_id', userId)
    .eq('id', addressId);

  if (isMissingDeliveryAddressesTable(error)) {
    disableDeliveryAddressesTable();
    const next = readDemoAddresses(userId).filter((entry) => entry.id !== addressId);
    const hasDefault = next.some((entry) => entry.is_default);
    writeDemoAddresses(
      userId,
      hasDefault || !next.length
        ? next
        : next.map((entry, index) => ({ ...entry, is_default: index === 0 })),
    );
    return { error: null };
  }

  return { error: error?.message ?? null };
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
