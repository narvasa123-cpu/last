export type Role = 'admin' | 'customer' | 'rider' | 'cashier';

export type Tier = 'Bronze' | 'Silver' | 'Gold';

export type ProductCategory = 'roses' | 'tulips' | 'mixed' | 'sunflowers' | 'orchids';

export type PaymentMethod = 'cod' | 'gcash' | 'card' | 'cash';

export type OrderPaymentStatus = 'unpaid' | 'pending' | 'verified' | 'failed' | 'paid' | 'refunded';

export type PaymentRecordStatus = 'pending' | 'verified' | 'failed';

export type FailedPaymentAction = 'retry' | 'contact_customer' | 'cancel_order';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export type DeliveryIssueReason = 'wrong_address' | 'customer_unreachable' | 'damaged_bouquet' | 'other';

export type NotificationType = 'order' | 'promo' | 'system';

export interface UserProfile {
  id: string;
  role_id?: number;
  role?: Role;
  full_name: string;
  phone: string;
  address: string;
  avatar_url: string;
  points: number;
  tier: Tier;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  image_url: string;
  stock: number;
  is_featured: boolean;
  avg_rating: number;
  review_count: number;
  created_at?: string;
  updated_at?: string;
  custom_bouquet?: CustomBouquetConfig;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  is_hidden?: boolean;
  created_at: string;
  user?: Pick<UserProfile, 'full_name' | 'avatar_url'>;
  product?: Pick<Product, 'id' | 'name'>;
}

export interface DeliveryAddress {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  delivery_notes?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface CustomBouquetFlower {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  color: string;
}

export interface CustomBouquetConfig {
  id: string;
  flowers: CustomBouquetFlower[];
  size: string;
  sizeLabel: string;
  sizeMultiplier: number;
  wrapper: string;
  wrapperLabel: string;
  ribbon: string;
  ribbonLabel: string;
  addOns: Array<{
    id: string;
    label: string;
    price: number;
  }>;
  message?: string;
  subtotal: number;
  addOnsCost: number;
  total: number;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  reference_no?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  status: PaymentRecordStatus;
  created_at?: string;
  updated_at?: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status?: OrderStatus | null;
  next_status: OrderStatus;
  changed_by?: string | null;
  note?: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  order_id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
  custom_bouquet?: CustomBouquetConfig | null;
}

export interface Order {
  id: string;
  customer_id: string | null;
  rider_id?: string | null;
  cashier_id?: string | null;
  is_walk_in?: boolean;
  status: OrderStatus;
  total_amount: number;
  delivery_fee: number;
  discount_amount: number;
  coupon_id?: string | null;
  payment_method: PaymentMethod;
  payment_status: OrderPaymentStatus;
  delivery_address: string;
  delivery_date: string;
  delivery_time: string;
  notes?: string;
  admin_internal_note?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  payments?: PaymentRecord[];
  status_history?: OrderStatusHistory[];
  delivery_photos?: DeliveryPhoto[];
  delivery_issues?: DeliveryIssue[];
  customer?: UserProfile;
  rider?: UserProfile;
  cashier?: UserProfile;
}

export interface RefundRecord {
  id: string;
  order_id: string;
  cashier_id: string;
  amount: number;
  reason: string;
  restore_stock: boolean;
  created_at: string;
  updated_at?: string;
  order?: Order;
  cashier?: UserProfile;
}

export interface DeliveryPhoto {
  id: string;
  order_id: string;
  rider_id: string;
  image_url: string;
  created_at: string;
  updated_at?: string;
}

export interface DeliveryIssue {
  id: string;
  order_id: string;
  rider_id: string;
  reason: DeliveryIssueReason;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface StockChangeLog {
  id: string;
  product_id: string;
  previous_stock: number;
  next_stock: number;
  delta: number;
  changed_by?: string | null;
  note?: string | null;
  created_at: string;
  product?: Pick<Product, 'id' | 'name'>;
}

export interface ActivityLog {
  id: string;
  user_id?: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user?: Pick<UserProfile, 'full_name'>;
}

export interface RewardLog {
  id: string;
  user_id: string;
  order_id?: string | null;
  points: number;
  description: string;
  created_at: string;
  updated_at?: string;
}

export interface DeliveryTrackingPoint {
  id: string;
  order_id: string;
  rider_id: string;
  status: OrderStatus | string;
  latitude?: number | null;
  longitude?: number | null;
  note?: string;
  created_at: string;
  updated_at?: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  trend: string;
  accent?: 'primary' | 'success' | 'neutral';
}

export interface Testimonial {
  id: string;
  name: string;
  avatar: string;
  quote: string;
  rating: number;
}

export interface CategoryTile {
  id: ProductCategory;
  emoji: string;
  name: string;
  image: string;
  description: string;
}

export interface NavLinkItem {
  label: string;
  to: string;
  roles?: Role[];
}
