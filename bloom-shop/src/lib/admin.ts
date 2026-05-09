import {
  ADMIN_METRICS,
  LOW_STOCK_PRODUCTS,
  MOCK_COUPONS,
  MOCK_PRODUCTS,
  MOCK_REVIEWS,
  MOCK_USERS,
  ROLE_ID_TO_NAME,
  ROLE_NAME_TO_ID,
  SALES_SERIES,
  TOP_PRODUCT_REVENUE,
} from './constants';
import { getAdminOrders } from './orders';
import { isSupabaseConfigured, supabase, withFallback } from './supabase';
import type {
  ActivityLog,
  AdminListParams,
  Coupon,
  DashboardMetric,
  Order,
  OrderItem,
  PaginatedResult,
  Product,
  ProductCategory,
  Review,
  Role,
  StockChangeLog,
  Tier,
  UserProfile,
} from './types';
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
let demoReviews = clone(MOCK_REVIEWS).map((review) => ({ ...review, is_hidden: false }));
let demoStockHistory: StockChangeLog[] = [];
let demoActivityLogs: ActivityLog[] = [];

export const PRODUCT_IMAGE_BUCKET = 'product-images';
export const AVATAR_IMAGE_BUCKET = 'avatars';

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_IMAGE_BYTES = 2 * 1024 * 1024;

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

function paginateLocal<T>(rows: T[], page = 1, pageSize = 10): PaginatedResult<T> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;

  return {
    data: rows.slice(offset, offset + safePageSize),
    total: rows.length,
    page: safePage,
    pageSize: safePageSize,
  };
}

function getRange(params: AdminListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

async function writeActivity(action: string, details: Record<string, unknown>, userId?: string | null) {
  const log: ActivityLog = {
    id: crypto.randomUUID(),
    user_id: userId ?? null,
    action,
    details,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    demoActivityLogs = [log, ...demoActivityLogs];
    return;
  }

  await supabase.from('activity_logs').insert({
    user_id: userId ?? null,
    action,
    details,
  });
}

function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(left: string | undefined, right: string): boolean {
  return left ? getDayKey(new Date(left)) === right : false;
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

export async function uploadAvatarImage(
  file: File,
  userId: string,
): Promise<{ data: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { data: null, error: 'Select a valid image file.' };
  }

  if (file.size > MAX_AVATAR_IMAGE_BYTES) {
    return { data: null, error: 'Avatar images must be 2 MB or smaller.' };
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
  const assetPath = `avatars/${userId}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_IMAGE_BUCKET).upload(assetPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(AVATAR_IMAGE_BUCKET).getPublicUrl(assetPath);
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
    const key = getDayKey(new Date(order.created_at));
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
      const bouquet = getOrderItemBouquet(item);
      const label = bouquet ? `${bouquet.sizeLabel} Custom Bouquet` : item.product?.name ?? item.product_id ?? 'Custom item';
      totals.set(label, (totals.get(label) ?? 0) + item.subtotal);
    }
  }

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
}

function getOrderItemBouquet(item: OrderItem) {
  return item.custom_bouquet ?? item.product?.custom_bouquet ?? null;
}

function countCustomBouquetItems(orders: Order[]): number {
  return orders.reduce(
    (sum, order) => sum + (order.items ?? []).filter((item) => Boolean(getOrderItemBouquet(item))).length,
    0,
  );
}

function getCustomBouquetRevenue(orders: Order[]): number {
  return orders.reduce(
    (sum, order) =>
      sum +
      (order.items ?? []).reduce(
        (orderSum, item) => orderSum + (getOrderItemBouquet(item) ? item.subtotal : 0),
        0,
      ),
    0,
  );
}

export async function getAdminUsers(): Promise<UserProfile[]> {
  const fallback = clone(demoUsers);
  const rows = await withFallback(
    supabase.from('users').select('*, roles(name)').order('created_at', { ascending: false }),
    fallback,
  );

  return (rows as UserRow[]).map(normalizeUser);
}

export async function getAdminUsersPage(
  params: AdminListParams & { role?: Role | 'all'; tier?: Tier | 'all' } = {},
): Promise<PaginatedResult<UserProfile>> {
  const search = params.search?.trim().toLowerCase() ?? '';
  const role = params.role ?? 'all';
  const tier = params.tier ?? 'all';
  const fallbackRows = clone(demoUsers)
    .map(normalizeUser)
    .filter((user) => role === 'all' || user.role === role)
    .filter((user) => tier === 'all' || user.tier === tier)
    .filter((user) => {
      if (!search) return true;
      return [user.full_name, user.phone, user.address, user.role, user.tier].some((value) =>
        String(value ?? '').toLowerCase().includes(search),
      );
    });

  if (!isSupabaseConfigured) {
    return paginateLocal(fallbackRows, params.page, params.pageSize);
  }

  const { page, pageSize, from, to } = getRange(params);
  let query = supabase
    .from('users')
    .select('*, roles(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (role !== 'all') {
    query = query.eq('role_id', ROLE_NAME_TO_ID[role]);
  }

  if (tier !== 'all') {
    query = query.eq('tier', tier);
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error || !data) return paginateLocal(fallbackRows, page, pageSize);

  return {
    data: (data as UserRow[]).map(normalizeUser),
    total: count ?? 0,
    page,
    pageSize,
  };
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

export async function getAdminCouponsPage(
  params: AdminListParams & { active?: 'all' | 'active' | 'inactive'; discountType?: 'all' | Coupon['discount_type'] } = {},
): Promise<PaginatedResult<Coupon>> {
  const search = params.search?.trim().toLowerCase() ?? '';
  const active = params.active ?? 'all';
  const discountType = params.discountType ?? 'all';
  const fallbackRows = clone(demoCoupons)
    .map(normalizeCoupon)
    .filter((coupon) => active === 'all' || coupon.is_active === (active === 'active'))
    .filter((coupon) => discountType === 'all' || coupon.discount_type === discountType)
    .filter((coupon) => !search || coupon.code.toLowerCase().includes(search));

  if (!isSupabaseConfigured) {
    return paginateLocal(fallbackRows, params.page, params.pageSize);
  }

  const { page, pageSize, from, to } = getRange(params);
  let query = supabase
    .from('coupons')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (active !== 'all') query = query.eq('is_active', active === 'active');
  if (discountType !== 'all') query = query.eq('discount_type', discountType);
  if (search) query = query.ilike('code', `%${search}%`);

  const { data, count, error } = await query;
  if (error || !data) return paginateLocal(fallbackRows, page, pageSize);

  return {
    data: (data as Coupon[]).map(normalizeCoupon),
    total: count ?? 0,
    page,
    pageSize,
  };
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

export async function getAdminProductsPage(
  params: AdminListParams & {
    category?: ProductCategory | 'all';
    featured?: 'all' | 'featured' | 'standard';
    stock?: 'all' | 'low' | 'out';
  } = {},
): Promise<PaginatedResult<Product>> {
  const search = params.search?.trim().toLowerCase() ?? '';
  const category = params.category ?? 'all';
  const featured = params.featured ?? 'all';
  const stock = params.stock ?? 'all';
  const fallbackRows = clone(demoProducts)
    .map(normalizeProduct)
    .filter((product) => category === 'all' || product.category === category)
    .filter((product) => featured === 'all' || product.is_featured === (featured === 'featured'))
    .filter((product) => stock === 'all' || (stock === 'low' ? product.stock > 0 && product.stock <= 12 : product.stock === 0))
    .filter((product) => {
      if (!search) return true;
      return [product.name, product.category, product.description].some((value) =>
        String(value ?? '').toLowerCase().includes(search),
      );
    });

  if (!isSupabaseConfigured) {
    return paginateLocal(fallbackRows, params.page, params.pageSize);
  }

  const { page, pageSize, from, to } = getRange(params);
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (category !== 'all') query = query.eq('category', category);
  if (featured !== 'all') query = query.eq('is_featured', featured === 'featured');
  if (stock === 'low') query = query.gt('stock', 0).lte('stock', 12);
  if (stock === 'out') query = query.eq('stock', 0);
  if (search) query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error || !data) return paginateLocal(fallbackRows, page, pageSize);

  return {
    data: (data as Product[]).map(normalizeProduct),
    total: count ?? 0,
    page,
    pageSize,
  };
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
    if (current.stock !== nextProduct.stock) {
      demoStockHistory = [
        {
          id: crypto.randomUUID(),
          product_id: productId,
          previous_stock: current.stock,
          next_stock: nextProduct.stock,
          delta: nextProduct.stock - current.stock,
          note: 'Product edit',
          created_at: new Date().toISOString(),
          product: { id: nextProduct.id, name: nextProduct.name },
        },
        ...demoStockHistory,
      ];
    }
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

export async function updateProductFeatured(
  productId: string,
  isFeatured: boolean,
): Promise<{ data: Product | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = demoProducts.find((entry) => entry.id === productId);
    if (!current) return { data: null, error: 'Product not found.' };
    const nextProduct = normalizeProduct({ ...current, is_featured: isFeatured, updated_at: new Date().toISOString() });
    demoProducts = demoProducts.map((entry) => (entry.id === productId ? nextProduct : entry));
    void writeActivity('product.featured_updated', { product_id: productId, is_featured: isFeatured });
    return { data: nextProduct, error: null };
  }

  const { data, error } = await supabase
    .from('products')
    .update({ is_featured: isFeatured })
    .eq('id', productId)
    .select()
    .maybeSingle();

  if (data) void writeActivity('product.featured_updated', { product_id: productId, is_featured: isFeatured });

  return {
    data: data ? normalizeProduct(data as Product) : null,
    error: error?.message ?? (data ? null : 'Unable to update the product.'),
  };
}

export async function bulkAdjustProductStock(
  productIds: string[],
  delta: number,
  note?: string,
): Promise<{ data: Product[]; error: string | null }> {
  if (!Number.isInteger(delta) || delta === 0) {
    return { data: [], error: 'Enter a whole-number stock adjustment.' };
  }

  if (!productIds.length) {
    return { data: [], error: 'Select at least one product.' };
  }

  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const updated: Product[] = [];

    demoProducts = demoProducts.map((product) => {
      if (!productIds.includes(product.id)) return product;
      const nextStock = Math.max(0, product.stock + delta);
      const nextProduct = normalizeProduct({ ...product, stock: nextStock, updated_at: timestamp });
      demoStockHistory = [
        {
          id: crypto.randomUUID(),
          product_id: product.id,
          previous_stock: product.stock,
          next_stock: nextStock,
          delta: nextStock - product.stock,
          note: note ?? 'Bulk stock adjustment',
          created_at: timestamp,
          product: { id: product.id, name: product.name },
        },
        ...demoStockHistory,
      ];
      updated.push(nextProduct);
      return nextProduct;
    });
    void writeActivity('product.stock_bulk_adjusted', { product_ids: productIds, delta, note });
    return { data: updated, error: null };
  }

  const { data: currentRows, error: currentError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (currentError || !currentRows) {
    return { data: [], error: currentError?.message ?? 'Unable to load selected products.' };
  }

  const updated: Product[] = [];
  for (const product of currentRows as Product[]) {
    const nextStock = Math.max(0, product.stock + delta);
    const { data, error } = await supabase
      .from('products')
      .update({ stock: nextStock })
      .eq('id', product.id)
      .select()
      .maybeSingle();

    if (error || !data) {
      return { data: updated, error: error?.message ?? `Unable to update ${product.name}.` };
    }

    await supabase.from('stock_change_logs').insert({
      product_id: product.id,
      previous_stock: product.stock,
      next_stock: nextStock,
      delta: nextStock - product.stock,
      note: note ?? 'Bulk stock adjustment',
    });
    updated.push(normalizeProduct(data as Product));
  }

  void writeActivity('product.stock_bulk_adjusted', { product_ids: productIds, delta, note });
  return { data: updated, error: null };
}

export async function getStockChangeLogs(params: AdminListParams = {}): Promise<PaginatedResult<StockChangeLog>> {
  const fallbackRows = clone(demoStockHistory);
  if (!isSupabaseConfigured) return paginateLocal(fallbackRows, params.page, params.pageSize);

  const { page, pageSize, from, to } = getRange(params);
  const { data, count, error } = await supabase
    .from('stock_change_logs')
    .select('*, product:products(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error || !data) return paginateLocal(fallbackRows, page, pageSize);
  return { data: data as StockChangeLog[], total: count ?? 0, page, pageSize };
}

export async function updateAdminOrderNote(
  orderId: string,
  note: string,
): Promise<{ data: Order | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Order notes are updated from the orders module in demo mode.' };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ admin_internal_note: note })
    .eq('id', orderId)
    .select()
    .maybeSingle();

  if (data) void writeActivity('order.internal_note_updated', { order_id: orderId });

  return {
    data: data as Order | null,
    error: error?.message ?? (data ? null : 'Unable to save the internal note.'),
  };
}

export async function getAdminReviewsPage(
  params: AdminListParams & { rating?: 'all' | '1' | '2' | '3' | '4' | '5'; visibility?: 'all' | 'visible' | 'hidden' } = {},
): Promise<PaginatedResult<Review>> {
  const search = params.search?.trim().toLowerCase() ?? '';
  const rating = params.rating ?? 'all';
  const visibility = params.visibility ?? 'all';
  const fallbackRows = clone(demoReviews)
    .filter((review) => rating === 'all' || review.rating === Number(rating))
    .filter((review) => visibility === 'all' || Boolean(review.is_hidden) === (visibility === 'hidden'))
    .filter((review) => !search || review.comment.toLowerCase().includes(search));

  if (!isSupabaseConfigured) return paginateLocal(fallbackRows, params.page, params.pageSize);

  const { page, pageSize, from, to } = getRange(params);
  let query = supabase
    .from('reviews')
    .select('*, user:users(full_name, avatar_url), product:products(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (rating !== 'all') query = query.eq('rating', Number(rating));
  if (visibility !== 'all') query = query.eq('is_hidden', visibility === 'hidden');
  if (search) query = query.ilike('comment', `%${search}%`);

  const { data, count, error } = await query;
  if (error || !data) return paginateLocal(fallbackRows, page, pageSize);
  return { data: data as Review[], total: count ?? 0, page, pageSize };
}

export async function updateReviewVisibility(
  reviewId: string,
  isHidden: boolean,
): Promise<{ data: Review | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = demoReviews.find((review) => review.id === reviewId);
    if (!current) return { data: null, error: 'Review not found.' };
    const nextReview = { ...current, is_hidden: isHidden };
    demoReviews = demoReviews.map((review) => (review.id === reviewId ? nextReview : review));
    void writeActivity('review.visibility_updated', { review_id: reviewId, is_hidden: isHidden });
    return { data: nextReview, error: null };
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ is_hidden: isHidden })
    .eq('id', reviewId)
    .select('*, user:users(full_name, avatar_url), product:products(id, name)')
    .maybeSingle();

  if (data) void writeActivity('review.visibility_updated', { review_id: reviewId, is_hidden: isHidden });
  return { data: data as Review | null, error: error?.message ?? (data ? null : 'Unable to update the review.') };
}

export async function getActivityLogsPage(params: AdminListParams = {}): Promise<PaginatedResult<ActivityLog>> {
  const search = params.search?.trim().toLowerCase() ?? '';
  const fallbackRows = clone(demoActivityLogs).filter(
    (log) => !search || log.action.toLowerCase().includes(search) || JSON.stringify(log.details).toLowerCase().includes(search),
  );

  if (!isSupabaseConfigured) return paginateLocal(fallbackRows, params.page, params.pageSize);

  const { page, pageSize, from, to } = getRange(params);
  let query = supabase
    .from('activity_logs')
    .select('*, user:users(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) query = query.or(`action.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error || !data) return paginateLocal(fallbackRows, page, pageSize);
  return { data: data as ActivityLog[], total: count ?? 0, page, pageSize };
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
    const orders = await getAdminOrders();
    const activeOrders = orders.filter((order) => order.status !== 'cancelled');
    const customBouquetCount = countCustomBouquetItems(activeOrders);

    return {
      metrics: [
        ...ADMIN_METRICS,
        {
          label: 'Custom Bouquets',
          value: `${customBouquetCount}`,
          trend: `${formatPrice(getCustomBouquetRevenue(activeOrders))} bespoke revenue`,
          accent: customBouquetCount ? 'success' : 'neutral',
        },
      ],
      salesSeries: SALES_SERIES,
      topProductRevenue: buildTopProductRevenue(activeOrders).length
        ? buildTopProductRevenue(activeOrders)
        : TOP_PRODUCT_REVENUE,
      lowStockProducts: LOW_STOCK_PRODUCTS,
      recentOrders: activeOrders.slice(0, 5),
    };
  }

  const [orders, products, users] = await Promise.all([getAdminOrders(), getAdminProducts(), getAdminUsers()]);
  const todayKey = getDayKey(new Date());
  const activeOrders = orders.filter((order) => order.status !== 'cancelled');
  const todayOrders = activeOrders.filter((order) => isSameDay(order.created_at, todayKey));
  const todayUsers = users.filter((user) => isSameDay(user.created_at, todayKey) && user.role === 'customer');
  const pendingDeliveries = activeOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const customBouquetCount = countCustomBouquetItems(activeOrders);

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
      {
        label: 'Custom Bouquets',
        value: `${customBouquetCount}`,
        trend: `${formatPrice(getCustomBouquetRevenue(activeOrders))} bespoke revenue`,
        accent: customBouquetCount ? 'success' : 'neutral',
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
