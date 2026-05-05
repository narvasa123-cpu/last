import {
  ADMIN_METRICS,
  LOW_STOCK_PRODUCTS,
  MOCK_COUPONS,
  MOCK_PRODUCTS,
  MOCK_USERS,
  ROLE_ID_TO_NAME,
  ROLE_NAME_TO_ID,
  SALES_SERIES,
  TOP_PRODUCT_REVENUE,
} from './constants';
import { getAdminOrders } from './orders';
import { isSupabaseConfigured, supabase, withFallback } from './supabase';
import type { Coupon, DashboardMetric, Order, Product, ProductCategory, Role, UserProfile } from './types';
import { formatPrice, getTier } from './utils';

type AdminAnalyticsRange = '7d' | '30d' | '90d';
type AdminRealtimeTable = 'products' | 'coupons';

type UserRow = UserProfile & { roles?: { name?: Role } | null };

type CouponPayload = {
  code: string;
  discountType: Coupon['discount_type'];
  discountValue: number;
  minOrder: number;
  maxUses: number;
  expiresAt?: string | null;
  isActive?: boolean;
};

type ProductPayload = {
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  imageUrl: string;
  stock: number;
  isFeatured: boolean;
};

interface AdminAnalytics {
  metrics: DashboardMetric[];
  salesSeries: Record<AdminAnalyticsRange, number[]>;
  topProductRevenue: Array<{ label: string; value: number }>;
  lowStockProducts: Product[];
  recentOrders: Order[];
}

let demoUsers = clone(MOCK_USERS);
let demoCoupons = clone(MOCK_COUPONS);
let demoProducts = clone(MOCK_PRODUCTS);

export const PRODUCT_IMAGE_BUCKET = 'product-images';

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeUser(row: UserRow): UserProfile {
  const role = row.role ?? row.roles?.name ?? ROLE_ID_TO_NAME[row.role_id ?? 2] ?? 'customer';

  return {
    ...row,
    role,
    tier: row.tier ?? getTier(row.points ?? 0),
  };
}

function normalizeCoupon(coupon: Coupon): Coupon {
  return {
    ...coupon,
    expires_at: coupon.expires_at ?? null,
  };
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    description: product.description ?? '',
    image_url: product.image_url ?? '',
  };
}

function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isSameDay(left: string | undefined, right: string): boolean {
  return Boolean(left) && left?.slice(0, 10) === right;
}

function sanitizeStorageSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'bloom-shop';
}

function getImageExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();

  if (fromName) {
    return fromName;
  }

  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/svg+xml') return 'svg';

  return 'img';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to preview the selected image.'));
    });

    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Unable to read the selected image.'));
    });

    reader.readAsDataURL(file);
  });
}

export async function uploadAdminProductImage(
  file: File,
  productName: string,
): Promise<{ data: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { data: null, error: 'Select a valid image file.' };
  }

  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return { data: null, error: 'Image files must be 5 MB or smaller.' };
  }

  if (!isSupabaseConfigured) {
    try {
      const previewUrl = await fileToDataUrl(file);
      return { data: previewUrl, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unable to read the selected image.',
      };
    }
  }

  const extension = getImageExtension(file);
  const safeName = sanitizeStorageSegment(productName || file.name);
  const assetPath = `products/${safeName}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(assetPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(assetPath);
  return { data: data.publicUrl, error: null };
}

export function subscribeToAdminTable(table: AdminRealtimeTable, onChange: () => void): () => void {
  if (!isSupabaseConfigured) {
    return () => undefined;
  }

  const channel = supabase
    .channel(`admin-${table}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

function buildRangeSeries(orders: Order[], days: number): number[] {
  const buckets = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - (days - index - 1));
    buckets.set(getDayKey(current), 0);
  }

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const key = order.created_at.slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + order.total_amount);
    }
  }

  return Array.from(buckets.values());
}

function buildTopProductRevenue(orders: Order[]): Array<{ label: string; value: number }> {
  const totals = new Map<string, number>();

  for (const order of orders) {
    if (order.status === 'cancelled') continue;

    for (const item of order.items ?? []) {
      const label = item.product?.name ?? item.product_id;
      totals.set(label, (totals.get(label) ?? 0) + item.subtotal);
    }
  }

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
}

export async function getAdminUsers(): Promise<UserProfile[]> {
  const fallback = clone(demoUsers);
  const rows = await withFallback(
    supabase.from('users').select('*, roles(name)').order('created_at', { ascending: false }),
    fallback,
  );

  return (rows as UserRow[]).map(normalizeUser);
}

export async function updateAdminUser(
  userId: string,
  payload: { role?: Role; is_active?: boolean },
): Promise<{ data: UserProfile | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = demoUsers.find((entry) => entry.id === userId);

    if (!current) {
      return { data: null, error: 'User not found.' };
    }

    const nextUser = normalizeUser({
      ...current,
      role: payload.role ?? current.role,
      role_id: payload.role ? ROLE_NAME_TO_ID[payload.role] : current.role_id,
      is_active: payload.is_active ?? current.is_active,
    });

    demoUsers = demoUsers.map((entry) => (entry.id === userId ? nextUser : entry));
    return { data: nextUser, error: null };
  }

  const updatePayload: Partial<UserProfile> = {};

  if (payload.role) {
    updatePayload.role_id = ROLE_NAME_TO_ID[payload.role];
  }

  if (typeof payload.is_active === 'boolean') {
    updatePayload.is_active = payload.is_active;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', userId)
    .select('*, roles(name)')
    .maybeSingle();

  return {
    data: data ? normalizeUser(data as UserRow) : null,
    error: error?.message ?? (data ? null : 'Unable to update the user.'),
  };
}

export async function getAdminCoupons(): Promise<Coupon[]> {
  const fallback = clone(demoCoupons);
  const coupons = await withFallback(
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    fallback,
  );

  return (coupons as Coupon[]).map(normalizeCoupon);
}

export async function updateAdminCoupon(
  couponId: string,
  payload: CouponPayload & { isActive: boolean },
): Promise<{ data: Coupon | null; error: string | null }> {
  const formattedCode = payload.code.trim().toUpperCase();

  if (!formattedCode) {
    return { data: null, error: 'Coupon code is required.' };
  }

  if (payload.discountType === 'percent' && (payload.discountValue <= 0 || payload.discountValue > 100)) {
    return { data: null, error: 'Percent discounts must be between 1 and 100.' };
  }

  if (payload.discountType === 'fixed' && payload.discountValue <= 0) {
    return { data: null, error: 'Fixed discounts must be greater than zero.' };
  }

  if (payload.minOrder < 0) {
    return { data: null, error: 'Minimum order cannot be negative.' };
  }

  if (payload.maxUses < 1) {
    return { data: null, error: 'Max uses must be at least 1.' };
  }

  if (!isSupabaseConfigured) {
    const current = demoCoupons.find((entry) => entry.id === couponId);

    if (!current) {
      return { data: null, error: 'Coupon not found.' };
    }

    const nextCoupon = normalizeCoupon({
      ...current,
      code: formattedCode,
      discount_type: payload.discountType,
      discount_value: payload.discountValue,
      min_order: payload.minOrder,
      max_uses: payload.maxUses,
      expires_at: payload.expiresAt ?? null,
      is_active: payload.isActive,
      updated_at: new Date().toISOString(),
    });

    demoCoupons = demoCoupons.map((entry) => (entry.id === couponId ? nextCoupon : entry));
    return { data: nextCoupon, error: null };
  }

  const { data, error } = await supabase
    .from('coupons')
    .update({
      code: formattedCode,
      discount_type: payload.discountType,
      discount_value: payload.discountValue,
      min_order: payload.minOrder,
      max_uses: payload.maxUses,
      expires_at: payload.expiresAt ?? null,
      is_active: payload.isActive,
    })
    .eq('id', couponId)
    .select()
    .maybeSingle();

  return {
    data: data ? normalizeCoupon(data as Coupon) : null,
    error: error?.message ?? (data ? null : 'Unable to update the coupon.'),
  };
}

export async function createAdminCoupon(
  payload: CouponPayload,
): Promise<{ data: Coupon | null; error: string | null }> {
  const formattedCode = payload.code.trim().toUpperCase();

  if (!formattedCode) {
    return { data: null, error: 'Coupon code is required.' };
  }

  if (payload.discountType === 'percent' && (payload.discountValue <= 0 || payload.discountValue > 100)) {
    return { data: null, error: 'Percent discounts must be between 1 and 100.' };
  }

  if (payload.discountType === 'fixed' && payload.discountValue <= 0) {
    return { data: null, error: 'Fixed discounts must be greater than zero.' };
  }

  if (payload.minOrder < 0) {
    return { data: null, error: 'Minimum order cannot be negative.' };
  }

  if (payload.maxUses < 1) {
    return { data: null, error: 'Max uses must be at least 1.' };
  }

  if (!isSupabaseConfigured) {
    const nextCoupon = normalizeCoupon({
      id: crypto.randomUUID(),
      code: formattedCode,
      discount_type: payload.discountType,
      discount_value: payload.discountValue,
      min_order: payload.minOrder,
      max_uses: payload.maxUses,
      used_count: 0,
      expires_at: payload.expiresAt ?? null,
      is_active: payload.isActive ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    demoCoupons = [nextCoupon, ...demoCoupons];
    return { data: nextCoupon, error: null };
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      code: formattedCode,
      discount_type: payload.discountType,
      discount_value: payload.discountValue,
      min_order: payload.minOrder,
      max_uses: payload.maxUses,
      used_count: 0,
      expires_at: payload.expiresAt ?? null,
      is_active: payload.isActive ?? true,
    })
    .select()
    .maybeSingle();

  return {
    data: data ? normalizeCoupon(data as Coupon) : null,
    error: error?.message ?? (data ? null : 'Unable to create the coupon.'),
  };
}

export async function deleteAdminCoupon(couponId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    demoCoupons = demoCoupons.filter((entry) => entry.id !== couponId);
    return { error: null };
  }

  const { error } = await supabase.from('coupons').delete().eq('id', couponId);
  return { error: error?.message ?? null };
}

export async function updateCouponState(
  couponId: string,
  isActive: boolean,
): Promise<{ data: Coupon | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = demoCoupons.find((entry) => entry.id === couponId);

    if (!current) {
      return { data: null, error: 'Coupon not found.' };
    }

    const nextCoupon = normalizeCoupon({
      ...current,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    });

    demoCoupons = demoCoupons.map((entry) => (entry.id === couponId ? nextCoupon : entry));
    return { data: nextCoupon, error: null };
  }

  const { data, error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', couponId)
    .select()
    .maybeSingle();

  return {
    data: data ? normalizeCoupon(data as Coupon) : null,
    error: error?.message ?? (data ? null : 'Unable to update the coupon.'),
  };
}

export async function getAdminProducts(): Promise<Product[]> {
  const fallback = clone(demoProducts);
  const rows = await withFallback(
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    fallback,
  );

  return (rows as Product[]).map(normalizeProduct);
}

export async function createAdminProduct(
  payload: ProductPayload,
): Promise<{ data: Product | null; error: string | null }> {
  if (!payload.name.trim()) {
    return { data: null, error: 'Product name is required.' };
  }

  if (payload.price <= 0) {
    return { data: null, error: 'Product price must be greater than zero.' };
  }

  if (payload.stock < 0) {
    return { data: null, error: 'Product stock cannot be negative.' };
  }

  if (!isSupabaseConfigured) {
    const nextProduct = normalizeProduct({
      id: crypto.randomUUID(),
      name: payload.name.trim(),
      description: payload.description.trim(),
      category: payload.category,
      price: payload.price,
      image_url: payload.imageUrl.trim(),
      stock: payload.stock,
      is_featured: payload.isFeatured,
      avg_rating: 0,
      review_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    demoProducts = [nextProduct, ...demoProducts];
    return { data: nextProduct, error: null };
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: payload.name.trim(),
      description: payload.description.trim(),
      category: payload.category,
      price: payload.price,
      image_url: payload.imageUrl.trim(),
      stock: payload.stock,
      is_featured: payload.isFeatured,
    })
    .select()
    .maybeSingle();

  return {
    data: data ? normalizeProduct(data as Product) : null,
    error: error?.message ?? (data ? null : 'Unable to create the product.'),
  };
}

export async function updateAdminProduct(
  productId: string,
  payload: ProductPayload,
): Promise<{ data: Product | null; error: string | null }> {
  if (!payload.name.trim()) {
    return { data: null, error: 'Product name is required.' };
  }

  if (payload.price <= 0) {
    return { data: null, error: 'Product price must be greater than zero.' };
  }

  if (payload.stock < 0) {
    return { data: null, error: 'Product stock cannot be negative.' };
  }

  if (!isSupabaseConfigured) {
    const current = demoProducts.find((entry) => entry.id === productId);

    if (!current) {
      return { data: null, error: 'Product not found.' };
    }

    const nextProduct = normalizeProduct({
      ...current,
      name: payload.name.trim(),
      description: payload.description.trim(),
      category: payload.category,
      price: payload.price,
      image_url: payload.imageUrl.trim(),
      stock: payload.stock,
      is_featured: payload.isFeatured,
      updated_at: new Date().toISOString(),
    });

    demoProducts = demoProducts.map((entry) => (entry.id === productId ? nextProduct : entry));
    return { data: nextProduct, error: null };
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      name: payload.name.trim(),
      description: payload.description.trim(),
      category: payload.category,
      price: payload.price,
      image_url: payload.imageUrl.trim(),
      stock: payload.stock,
      is_featured: payload.isFeatured,
    })
    .eq('id', productId)
    .select()
    .maybeSingle();

  return {
    data: data ? normalizeProduct(data as Product) : null,
    error: error?.message ?? (data ? null : 'Unable to update the product.'),
  };
}

export async function deleteAdminProduct(productId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    demoProducts = demoProducts.filter((entry) => entry.id !== productId);
    return { error: null };
  }

  const { error } = await supabase.from('products').delete().eq('id', productId);
  return { error: error?.message ?? null };
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  if (!isSupabaseConfigured) {
    return {
      metrics: ADMIN_METRICS,
      salesSeries: SALES_SERIES,
      topProductRevenue: TOP_PRODUCT_REVENUE,
      lowStockProducts: LOW_STOCK_PRODUCTS,
      recentOrders: (await getAdminOrders()).slice(0, 5),
    };
  }

  const [orders, products, users] = await Promise.all([getAdminOrders(), getAdminProducts(), getAdminUsers()]);
  const todayKey = getDayKey(new Date());
  const activeOrders = orders.filter((order) => order.status !== 'cancelled');
  const todayOrders = activeOrders.filter((order) => isSameDay(order.created_at, todayKey));
  const todayUsers = users.filter((user) => isSameDay(user.created_at, todayKey) && user.role === 'customer');
  const pendingDeliveries = activeOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status));

  return {
    metrics: [
      {
        label: 'Total Sales Today',
        value: formatPrice(todayOrders.reduce((sum, order) => sum + order.total_amount, 0)),
        trend: `${todayOrders.length} orders`,
        accent: 'primary',
      },
      {
        label: 'Orders Today',
        value: `${todayOrders.length}`,
        trend: `${activeOrders.length} active total`,
        accent: 'neutral',
      },
      {
        label: 'New Customers',
        value: `${todayUsers.length}`,
        trend: 'Registered today',
        accent: 'success',
      },
      {
        label: 'Pending Deliveries',
        value: `${pendingDeliveries.length}`,
        trend: `${pendingDeliveries.filter((order) => !order.rider_id).length} unassigned`,
        accent: 'primary',
      },
    ],
    salesSeries: {
      '7d': buildRangeSeries(activeOrders, 7),
      '30d': buildRangeSeries(activeOrders, 30),
      '90d': buildRangeSeries(activeOrders, 90),
    },
    topProductRevenue: buildTopProductRevenue(activeOrders),
    lowStockProducts: [...products].filter((product) => product.stock <= 12).sort((left, right) => left.stock - right.stock),
    recentOrders: activeOrders.slice(0, 5),
  };
}
