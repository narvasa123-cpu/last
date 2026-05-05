export type Role = 'admin' | 'customer' | 'rider' | 'cashier';

export type Tier = 'Bronze' | 'Silver' | 'Gold';

export type ProductCategory = 'roses' | 'tulips' | 'mixed' | 'sunflowers' | 'orchids';

export type PaymentMethod = 'cod' | 'gcash' | 'card';

export type OrderPaymentStatus = 'unpaid' | 'pending' | 'verified' | 'failed' | 'paid' | 'refunded';

export type PaymentRecordStatus = 'pending' | 'verified' | 'failed';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

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
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  user?: Pick<UserProfile, 'full_name' | 'avatar_url'>;
}

export interface CartLine {
  product: Product;
  quantity: number;
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
  product_id: string;
  order_id?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface Order {
  id: string;
  customer_id: string;
  rider_id?: string | null;
  cashier_id?: string | null;
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
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  payments?: PaymentRecord[];
  status_history?: OrderStatusHistory[];
  customer?: UserProfile;
  rider?: UserProfile;
  cashier?: UserProfile;
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
