import {
  DEFAULT_DELIVERY_FEE,
  DELIVERY_FEE_THRESHOLD,
  POINTS_PER_SPEND,
  ROLE_ID_TO_NAME,
  TIER_THRESHOLDS,
} from './constants';
import type { CartLine, Coupon, Product, Role, Tier, UserProfile } from './types';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'TBD';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'TBD';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function calcPoints(orderTotal: number): number {
  return Math.floor(orderTotal / POINTS_PER_SPEND);
}

export function getTier(points: number): Tier {
  if (points >= TIER_THRESHOLDS.Gold.min) return 'Gold';
  if (points >= TIER_THRESHOLDS.Silver.min) return 'Silver';
  return 'Bronze';
}

export function getTierProgress(points: number): { current: Tier; next: Tier | null; progress: number } {
  const current = getTier(points);
  if (current === 'Gold') {
    return { current, next: null, progress: 100 };
  }
  const next = current === 'Bronze' ? 'Silver' : 'Gold';
  const currentThreshold = TIER_THRESHOLDS[current].min;
  const nextThreshold = TIER_THRESHOLDS[next].min;
  const progress = ((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  return { current, next, progress: Math.max(0, Math.min(100, progress)) };
}

export function getDeliveryFee(subtotal: number): number {
  return subtotal >= DELIVERY_FEE_THRESHOLD ? 0 : DEFAULT_DELIVERY_FEE;
}

export function calculateSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
}

export function applyCouponDiscount(subtotal: number, coupon?: Coupon | null): number {
  if (!coupon || !coupon.is_active || subtotal < coupon.min_order) return 0;
  return coupon.discount_type === 'percent'
    ? Math.round((subtotal * coupon.discount_value) / 100)
    : Math.min(subtotal, coupon.discount_value);
}

export function getRoleFromProfile(profile?: Partial<UserProfile> | null): Role {
  if (profile?.role) {
    return profile.role;
  }
  return ROLE_ID_TO_NAME[profile?.role_id ?? 2] ?? 'customer';
}

export function getProductRecommendations(products: Product[], excludeIds: string[], limit = 4): Product[] {
  return [...products]
    .filter((product) => !excludeIds.includes(product.id))
    .sort((a, b) => b.review_count * b.avg_rating - a.review_count * a.avg_rating)
    .slice(0, limit);
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function createEmptyFlowerSvg(label = 'Bloom'): string {
  const safeLabel = encodeURIComponent(label);
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" fill="none">
      <rect width="180" height="180" rx="40" fill="#fff5f7"/>
      <path d="M90 132c-4-22-24-34-24-52 0-14 11-25 24-25s24 11 24 25c0 18-20 30-24 52Z" fill="#f8c8dc"/>
      <circle cx="90" cy="71" r="16" fill="#e91e63"/>
      <path d="M58 76c10-14 21-21 32-21-3 14-11 24-24 31-3-4-5-7-8-10Z" fill="#f29cb8"/>
      <path d="M122 76c-10-14-21-21-32-21 3 14 11 24 24 31 3-4 5-7 8-10Z" fill="#f29cb8"/>
      <path d="M90 87v43" stroke="#4caf7d" stroke-width="6" stroke-linecap="round"/>
      <text x="90" y="160" font-family="Inter, sans-serif" font-size="14" text-anchor="middle" fill="#9e7d8a">${safeLabel}</text>
    </svg>`,
  )}`;
}

export function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
