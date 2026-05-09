import { MOCK_ORDERS, MOCK_USERS, ORDER_FLOW } from './constants';
import { isSupabaseConfigured, supabase, withFallback } from './supabase';
import { BASE_TRACKING_ROUTE } from './trackingRoute';
import type {
  CartLine,
  DeliveryIssue,
  DeliveryIssueReason,
  DeliveryPhoto,
  DeliveryTrackingPoint,
  FailedPaymentAction,
  Order,
  OrderStatus,
  OrderStatusHistory,
  PaymentRecord,
  PaymentRecordStatus,
  RefundRecord,
  Role,
  UserProfile,
} from './types';

const ORDER_SELECT = `
  *,
  payments(*),
  order_items(*, product:products(*)),
  customer:users!orders_customer_id_fkey(*),
  rider:users!orders_rider_id_fkey(*),
  cashier:users!orders_cashier_id_fkey(*)
`;

const REFUND_SELECT = `
  *,
  order:orders(${ORDER_SELECT}),
  cashier:users!refunds_cashier_id_fkey(*)
`;

type OrderQueryRow = Order & {
  order_items?: Order['items'];
  payments?: PaymentRecord[];
};

type DeliveryTrackingQueryRow = Omit<DeliveryTrackingPoint, 'latitude' | 'longitude'> & {
  latitude?: number | string | null;
  longitude?: number | string | null;
};

const DEMO_TRACKING_ROUTE = BASE_TRACKING_ROUTE;
const DELIVERY_PHOTO_BUCKET = 'delivery-photos';
const MAX_DELIVERY_PHOTO_BYTES = 5 * 1024 * 1024;
const ORDER_STATUS_HISTORY_DISABLED_KEY = 'bloom-shop:order-status-history-disabled';
const DELIVERY_PHOTOS_DISABLED_KEY = 'bloom-shop:delivery-photos-disabled';
const DELIVERY_ISSUES_DISABLED_KEY = 'bloom-shop:delivery-issues-disabled';

let demoOrders = seedDemoOrders();
let demoTrackingByOrder = seedDemoTrackingMap();
let demoDeliveryPhotos: DeliveryPhoto[] = [];
let demoDeliveryIssues: DeliveryIssue[] = [];
let demoRefunds: RefundRecord[] = [];
let hasOrderStatusHistoryTable: boolean | null =
  typeof window !== 'undefined' && window.sessionStorage.getItem(ORDER_STATUS_HISTORY_DISABLED_KEY) === 'true'
    ? false
    : null;
let hasDeliveryPhotosTable: boolean | null =
  typeof window !== 'undefined' && window.sessionStorage.getItem(DELIVERY_PHOTOS_DISABLED_KEY) === 'true'
    ? false
    : null;
let hasDeliveryIssuesTable: boolean | null =
  typeof window !== 'undefined' && window.sessionStorage.getItem(DELIVERY_ISSUES_DISABLED_KEY) === 'true'
    ? false
    : null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeStorageSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'delivery-proof';
}

function getImageExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/svg+xml') return 'svg';
  return 'jpg';
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

function getDemoPaymentStatus(status: Order['payment_status']): PaymentRecordStatus {
  if (status === 'verified' || status === 'paid') {
    return 'verified';
  }

  if (status === 'failed' || status === 'refunded') {
    return 'failed';
  }

  return 'pending';
}

function getOrderRouteOffset(orderId: string) {
  const seed = Array.from(orderId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const latOffset = ((seed % 7) - 3) * 0.00022;
  const lngOffset = (((seed >> 1) % 7) - 3) * 0.00024;

  return { latOffset, lngOffset };
}

function getDemoTrackingRoute(orderId: string) {
  const { latOffset, lngOffset } = getOrderRouteOffset(orderId);

  return DEMO_TRACKING_ROUTE.map((point) => ({
    latitude: Number((point.latitude + latOffset).toFixed(6)),
    longitude: Number((point.longitude + lngOffset).toFixed(6)),
  }));
}

function getTrackedPointCount(status: OrderStatus): number {
  if (status === 'delivered') return 5;
  if (status === 'on_the_way') return 4;
  if (status === 'picked_up') return 3;
  if (status === 'preparing' || status === 'confirmed') return 2;
  return 0;
}

function buildDemoStatusHistory(order: Order): OrderStatusHistory[] {
  const finalIndex = ORDER_FLOW.indexOf(order.status);
  const statuses = finalIndex >= 0 ? ORDER_FLOW.slice(0, finalIndex + 1) : [order.status];
  const baseTime = new Date(order.created_at).getTime();

  return statuses.map((status, index) => ({
    id: `history-${order.id}-${status}`,
    order_id: order.id,
    previous_status: index === 0 ? null : statuses[index - 1],
    next_status: status,
    changed_by: order.rider_id ?? order.cashier_id ?? order.customer_id,
    created_at: new Date(baseTime + index * 45 * 60 * 1000).toISOString(),
  }));
}

function seedDemoTracking(order: Order): DeliveryTrackingPoint[] {
  if (!order.rider_id) {
    return [];
  }

  const route = getDemoTrackingRoute(order.id);
  const pointCount = Math.min(getTrackedPointCount(order.status), route.length);

  if (!pointCount) {
    return [];
  }

  const baseTime = new Date(order.created_at).getTime();

  return route.slice(0, pointCount).map((point, index) => ({
    id: `tracking-${order.id}-${index + 1}`,
    order_id: order.id,
    rider_id: order.rider_id ?? 'demo-rider',
    status:
      index === pointCount - 1
        ? order.status
        : index < 2
          ? 'picked_up'
          : 'on_the_way',
    latitude: point.latitude,
    longitude: point.longitude,
    note: index === pointCount - 1 ? `Rider update: ${order.status.replace(/_/g, ' ')}` : 'Rider waypoint update',
    created_at: new Date(baseTime + (index + 1) * 12 * 60 * 1000).toISOString(),
    updated_at: new Date(baseTime + (index + 1) * 12 * 60 * 1000).toISOString(),
  }));
}

function seedDemoTrackingMap() {
  return Object.fromEntries(
    demoOrders.map((order) => [order.id, seedDemoTracking(order)]),
  ) as Record<string, DeliveryTrackingPoint[]>;
}

function seedDemoOrders(): Order[] {
  return clone(MOCK_ORDERS).map((order) => ({
    ...order,
    payments: [
      {
        id: `payment-${order.id}`,
        order_id: order.id,
        amount: order.total_amount,
        method: order.payment_method,
        reference_no: order.payment_method === 'gcash' ? `GCASH-${order.id.slice(0, 6).toUpperCase()}` : null,
        status: getDemoPaymentStatus(order.payment_status),
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    ],
    status_history: buildDemoStatusHistory(order),
  }));
}

function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function isPendingPaymentQueueOrder(order: Order): boolean {
  if (['delivered', 'cancelled'].includes(order.status)) {
    return false;
  }

  const payments = order.payments ?? [];

  if (payments.some((payment) => payment.status === 'pending')) {
    return true;
  }

  if (!payments.length && ['pending', 'unpaid'].includes(order.payment_status)) {
    return true;
  }

  return false;
}

function normalizeOrder(row: OrderQueryRow): Order {
  return {
    ...row,
    items: row.items ?? row.order_items ?? [],
    payments: row.payments ?? [],
    delivery_photos: row.delivery_photos
      ? [...row.delivery_photos].sort((left, right) => right.created_at.localeCompare(left.created_at))
      : row.delivery_photos,
    delivery_issues: row.delivery_issues
      ? [...row.delivery_issues].sort((left, right) => right.created_at.localeCompare(left.created_at))
      : row.delivery_issues,
    status_history: row.status_history
      ? [...row.status_history].sort((left, right) => left.created_at.localeCompare(right.created_at))
      : row.status_history,
  };
}

function normalizeTrackingPoint(row: DeliveryTrackingQueryRow): DeliveryTrackingPoint {
  return {
    ...row,
    latitude:
      row.latitude === null || row.latitude === undefined || row.latitude === ''
        ? null
        : Number(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined || row.longitude === ''
        ? null
        : Number(row.longitude),
  };
}

function sortTrackingPoints(points: DeliveryTrackingPoint[]): DeliveryTrackingPoint[] {
  return [...points].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function normalizeOrders(rows: OrderQueryRow[]): Order[] {
  return rows.map(normalizeOrder);
}

async function getStatusHistoryByOrderIds(orderIds: string[]): Promise<Map<string, OrderStatusHistory[]>> {
  const uniqueOrderIds = Array.from(new Set(orderIds.filter(Boolean)));

  if (!uniqueOrderIds.length || !isSupabaseConfigured || hasOrderStatusHistoryTable === false) {
    return new Map();
  }

  const { data, error, status } = await supabase
    .from('order_status_history')
    .select('*')
    .in('order_id', uniqueOrderIds)
    .order('created_at', { ascending: true });

  if (error || !data) {
    if (status === 404 || error?.code === 'PGRST205') {
      hasOrderStatusHistoryTable = false;
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ORDER_STATUS_HISTORY_DISABLED_KEY, 'true');
      }
    }

    return new Map();
  }

  hasOrderStatusHistoryTable = true;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ORDER_STATUS_HISTORY_DISABLED_KEY);
  }

  return data.reduce<Map<string, OrderStatusHistory[]>>((historyByOrder, entry) => {
    const orderHistory = historyByOrder.get(entry.order_id) ?? [];
    orderHistory.push(entry as OrderStatusHistory);
    historyByOrder.set(entry.order_id, orderHistory);
    return historyByOrder;
  }, new Map());
}

async function getDeliveryPhotosByOrderIds(orderIds: string[]): Promise<Map<string, DeliveryPhoto[]>> {
  const uniqueOrderIds = Array.from(new Set(orderIds.filter(Boolean)));

  if (!uniqueOrderIds.length || !isSupabaseConfigured || hasDeliveryPhotosTable === false) {
    return new Map();
  }

  const { data, error, status } = await supabase
    .from('delivery_photos')
    .select('*')
    .in('order_id', uniqueOrderIds)
    .order('created_at', { ascending: false });

  if (error || !data) {
    if (status === 404 || error?.code === 'PGRST205') {
      hasDeliveryPhotosTable = false;
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(DELIVERY_PHOTOS_DISABLED_KEY, 'true');
      }
    }

    return new Map();
  }

  hasDeliveryPhotosTable = true;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(DELIVERY_PHOTOS_DISABLED_KEY);
  }

  return data.reduce<Map<string, DeliveryPhoto[]>>((photosByOrder, photo) => {
    const orderPhotos = photosByOrder.get(photo.order_id) ?? [];
    orderPhotos.push(photo as DeliveryPhoto);
    photosByOrder.set(photo.order_id, orderPhotos);
    return photosByOrder;
  }, new Map());
}

async function getDeliveryIssuesByOrderIds(orderIds: string[]): Promise<Map<string, DeliveryIssue[]>> {
  const uniqueOrderIds = Array.from(new Set(orderIds.filter(Boolean)));

  if (!uniqueOrderIds.length || !isSupabaseConfigured || hasDeliveryIssuesTable === false) {
    return new Map();
  }

  const { data, error, status } = await supabase
    .from('delivery_issues')
    .select('*')
    .in('order_id', uniqueOrderIds)
    .order('created_at', { ascending: false });

  if (error || !data) {
    if (status === 404 || error?.code === 'PGRST205') {
      hasDeliveryIssuesTable = false;
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(DELIVERY_ISSUES_DISABLED_KEY, 'true');
      }
    }

    return new Map();
  }

  hasDeliveryIssuesTable = true;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(DELIVERY_ISSUES_DISABLED_KEY);
  }

  return data.reduce<Map<string, DeliveryIssue[]>>((issuesByOrder, issue) => {
    const orderIssues = issuesByOrder.get(issue.order_id) ?? [];
    orderIssues.push(issue as DeliveryIssue);
    issuesByOrder.set(issue.order_id, orderIssues);
    return issuesByOrder;
  }, new Map());
}

async function normalizeOrdersWithHistory(rows: OrderQueryRow[]): Promise<Order[]> {
  const orders = normalizeOrders(rows);
  const orderIds = orders.map((order) => order.id);
  const [historyByOrder, photosByOrder, issuesByOrder] = await Promise.all([
    getStatusHistoryByOrderIds(orderIds),
    getDeliveryPhotosByOrderIds(orderIds),
    getDeliveryIssuesByOrderIds(orderIds),
  ]);

  return orders.map((order) => ({
    ...order,
    status_history: historyByOrder.get(order.id) ?? order.status_history,
    delivery_photos: photosByOrder.get(order.id) ?? order.delivery_photos,
    delivery_issues: issuesByOrder.get(order.id) ?? order.delivery_issues,
  }));
}

async function normalizeOrderWithHistory(row: OrderQueryRow): Promise<Order> {
  const [order] = await normalizeOrdersWithHistory([row]);
  return order;
}

function buildOrdersQuery() {
  return supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false });
}

function getDemoOrders(): Order[] {
  return sortOrders(
    clone(demoOrders).map((order) => ({
      ...order,
      delivery_photos: demoDeliveryPhotos.filter((photo) => photo.order_id === order.id),
      delivery_issues: demoDeliveryIssues.filter((issue) => issue.order_id === order.id),
    })),
  );
}

function getDemoUser(userId?: string | null) {
  if (!userId) {
    return undefined;
  }

  const user = MOCK_USERS.find((entry) => entry.id === userId);
  return user ? clone(user) : undefined;
}

function saveDemoOrder(nextOrder: Order): Order {
  const existingIndex = demoOrders.findIndex((entry) => entry.id === nextOrder.id);

  if (existingIndex >= 0) {
    demoOrders = demoOrders.map((entry, index) => (index === existingIndex ? nextOrder : entry));
  } else {
    demoOrders = [nextOrder, ...demoOrders];
  }

  return clone(nextOrder);
}

function getLocalDayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function isToday(dateValue?: string) {
  if (!dateValue) return false;
  const { start, end } = getLocalDayRange();
  return dateValue >= start && dateValue < end;
}

export function createDemoOrderFromCart(payload: {
  id: string;
  customer: UserProfile;
  items: CartLine[];
  totalAmount: number;
  deliveryFee: number;
  discountAmount: number;
  couponId?: string | null;
  paymentMethod: Order['payment_method'];
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTime: string;
  notes?: string;
  gcashReference?: string | null;
}): Order {
  const now = new Date().toISOString();
  const status: OrderStatus = payload.paymentMethod === 'cod' ? 'pending' : 'confirmed';
  const paymentStatus: Order['payment_status'] = payload.paymentMethod === 'cod' ? 'unpaid' : 'pending';

  const order: Order = {
    id: payload.id,
    customer_id: payload.customer.id,
    rider_id: null,
    cashier_id: null,
    status,
    total_amount: payload.totalAmount,
    delivery_fee: payload.deliveryFee,
    discount_amount: payload.discountAmount,
    coupon_id: payload.couponId ?? null,
    payment_method: payload.paymentMethod,
    payment_status: paymentStatus,
    delivery_address: payload.deliveryAddress,
    delivery_date: payload.deliveryDate,
    delivery_time: payload.deliveryTime,
    notes: payload.notes,
    created_at: now,
    updated_at: now,
    customer: payload.customer,
    items: payload.items.map((line, index) => ({
      id: `demo-order-item-${payload.id}-${index + 1}`,
      order_id: payload.id,
      product_id: line.product.custom_bouquet ? null : line.product.id,
      quantity: line.quantity,
      unit_price: line.product.price,
      subtotal: line.product.price * line.quantity,
      product: line.product,
      custom_bouquet: line.product.custom_bouquet ?? null,
    })),
    payments: [
      {
        id: `payment-${payload.id}`,
        order_id: payload.id,
        amount: payload.totalAmount,
        method: payload.paymentMethod,
        reference_no: payload.paymentMethod === 'gcash' ? payload.gcashReference ?? null : null,
        status: 'pending',
        created_at: now,
        updated_at: now,
      },
    ],
  };

  order.status_history = buildDemoStatusHistory(order);
  return saveDemoOrder(order);
}

export async function createWalkInOrder(payload: {
  cashier: UserProfile;
  items: CartLine[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  couponId?: string | null;
  notes?: string;
}): Promise<{ data: Order | null; error: string | null }> {
  if (!payload.items.length) {
    return { data: null, error: 'Add at least one product before completing the sale.' };
  }

  const insufficient = payload.items.find((line) => line.quantity > line.product.stock);
  if (insufficient) {
    return {
      data: null,
      error: `${insufficient.product.name} only has ${insufficient.product.stock} in stock.`,
    };
  }

  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();

  if (!isSupabaseConfigured) {
    const order: Order = {
      id: orderId,
      customer_id: null,
      rider_id: null,
      cashier_id: payload.cashier.id,
      is_walk_in: true,
      status: 'delivered',
      total_amount: payload.totalAmount,
      delivery_fee: 0,
      discount_amount: payload.discountAmount,
      coupon_id: payload.couponId ?? null,
      payment_method: 'cash',
      payment_status: 'paid',
      delivery_address: 'Walk-in counter',
      delivery_date: now.slice(0, 10),
      delivery_time: 'Walk-in',
      notes: payload.notes,
      created_at: now,
      updated_at: now,
      cashier: payload.cashier,
      items: payload.items.map((line, index) => ({
        id: `demo-walk-in-item-${orderId}-${index + 1}`,
        order_id: orderId,
        product_id: line.product.id,
        quantity: line.quantity,
        unit_price: line.product.price,
        subtotal: line.product.price * line.quantity,
        product: {
          ...line.product,
          stock: Math.max(0, line.product.stock - line.quantity),
        },
      })),
      payments: [
        {
          id: `payment-${orderId}`,
          order_id: orderId,
          amount: payload.totalAmount,
          method: 'cash',
          status: 'verified',
          verified_by: payload.cashier.id,
          verified_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    };
    order.status_history = buildDemoStatusHistory(order);
    return { data: saveDemoOrder(order), error: null };
  }

  try {
    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        customer_id: null,
        cashier_id: payload.cashier.id,
        is_walk_in: true,
        status: 'delivered',
        total_amount: payload.totalAmount,
        delivery_fee: 0,
        discount_amount: payload.discountAmount,
        coupon_id: payload.couponId ?? null,
        payment_method: 'cash',
        payment_status: 'paid',
        delivery_address: 'Walk-in counter',
        delivery_date: now.slice(0, 10),
        delivery_time: 'Walk-in',
        notes: payload.notes ?? null,
      })
      .select(ORDER_SELECT)
      .single();

    if (orderError || !insertedOrder) throw orderError ?? new Error('Unable to create the walk-in order.');

    const { error: itemError } = await supabase.from('order_items').insert(
      payload.items.map((line) => ({
        order_id: insertedOrder.id,
        product_id: line.product.id,
        quantity: line.quantity,
        unit_price: line.product.price,
        subtotal: line.product.price * line.quantity,
      })),
    );

    if (itemError) throw itemError;

    const { error: paymentError } = await supabase.from('payments').insert({
      order_id: insertedOrder.id,
      amount: payload.totalAmount,
      method: 'cash',
      status: 'verified',
      verified_by: payload.cashier.id,
      verified_at: now,
    });

    if (paymentError) throw paymentError;

    await Promise.all(
      payload.items.map((line) =>
        supabase
          .from('products')
          .update({ stock: Math.max(0, line.product.stock - line.quantity) })
          .eq('id', line.product.id),
      ),
    );

    if (payload.couponId) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('used_count')
        .eq('id', payload.couponId)
        .maybeSingle();

      if (coupon) {
        await supabase
          .from('coupons')
          .update({ used_count: Number(coupon.used_count ?? 0) + 1 })
          .eq('id', payload.couponId);
      }
    }

    const fresh = await getOrderById(insertedOrder.id);
    return { data: fresh, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unable to complete the sale.',
    };
  }
}

export async function getCashierTodayOrders(cashierId: string): Promise<Order[]> {
  const fallback = getDemoOrders().filter((order) => order.cashier_id === cashierId && isToday(order.created_at));
  const { start, end } = getLocalDayRange();

  const rows = await withFallback(
    buildOrdersQuery().eq('cashier_id', cashierId).gte('created_at', start).lt('created_at', end),
    fallback,
  );

  return normalizeOrdersWithHistory(rows as OrderQueryRow[]);
}

function isFailedPaymentOrder(order: Order): boolean {
  return (
    order.payment_status === 'failed' ||
    (order.payments ?? []).some((payment) => payment.status === 'failed')
  );
}

export async function getFailedPaymentOrders(): Promise<Order[]> {
  const fallback = getDemoOrders().filter(isFailedPaymentOrder);
  const rows = await withFallback(buildOrdersQuery().not('status', 'eq', 'cancelled'), fallback);
  return (await normalizeOrdersWithHistory(rows as OrderQueryRow[])).filter(isFailedPaymentOrder);
}

export async function updateFailedPaymentOrder(
  orderId: string,
  action: FailedPaymentAction,
  cashierId: string,
): Promise<{ data: Order | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = getDemoOrders().find((order) => order.id === orderId);
    if (!current) return { data: null, error: 'Order not found.' };

    const nextPayments =
      current.payments?.map((payment) => ({
        ...payment,
        status: action === 'retry' ? ('pending' as const) : payment.status,
        updated_at: new Date().toISOString(),
      })) ?? [];

    const nextOrder = saveDemoOrder({
      ...current,
      cashier_id: cashierId,
      cashier: getDemoUser(cashierId),
      status: action === 'cancel_order' ? 'cancelled' : current.status,
      payment_status: action === 'retry' ? 'pending' : current.payment_status,
      notes:
        action === 'contact_customer'
          ? [current.notes, 'Cashier marked payment for customer contact.'].filter(Boolean).join('\n')
          : current.notes,
      updated_at: new Date().toISOString(),
      payments: nextPayments,
    });

    return { data: nextOrder, error: null };
  }

  if (action === 'retry') {
    const { error: paymentError } = await supabase
      .from('payments')
      .update({ status: 'pending' })
      .eq('order_id', orderId);
    if (paymentError) return { data: null, error: paymentError.message };

    return updateOrderStatus(orderId, 'confirmed', { cashierId, paymentStatus: 'pending', note: 'Payment retry queued' });
  }

  if (action === 'cancel_order') {
    return updateOrderStatus(orderId, 'cancelled', {
      cashierId,
      paymentStatus: 'failed',
      note: 'Cancelled after failed payment',
    });
  }

  const current = await getOrderById(orderId);
  const notes = [current?.notes, 'Cashier marked payment for customer contact.'].filter(Boolean).join('\n');

  const { data, error } = await supabase
    .from('orders')
    .update({ cashier_id: cashierId, notes })
    .eq('id', orderId)
    .select(ORDER_SELECT)
    .maybeSingle();

  return {
    data: data ? await normalizeOrderWithHistory(data as OrderQueryRow) : null,
    error: error?.message ?? (data ? null : 'Unable to update the failed payment.'),
  };
}

export async function getRefundableOrders(): Promise<Order[]> {
  const fallback = getDemoOrders().filter(
    (order) => order.status === 'delivered' && order.payment_status !== 'refunded',
  );

  const rows = await withFallback(
    buildOrdersQuery().eq('status', 'delivered').not('payment_status', 'eq', 'refunded').limit(40),
    fallback,
  );

  return normalizeOrdersWithHistory(rows as OrderQueryRow[]);
}

export async function processOrderRefund(payload: {
  orderId: string;
  cashierId: string;
  reason: string;
  restoreStock: boolean;
}): Promise<{ data: Order | null; error: string | null }> {
  const reason = payload.reason.trim();
  if (!reason) {
    return { data: null, error: 'Refund reason is required.' };
  }

  const current = await getOrderById(payload.orderId);
  if (!current) return { data: null, error: 'Order not found.' };
  if (current.payment_status === 'refunded') return { data: null, error: 'This order is already refunded.' };

  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    demoRefunds = [
      {
        id: `refund-${payload.orderId}-${Date.now()}`,
        order_id: payload.orderId,
        cashier_id: payload.cashierId,
        amount: current.total_amount,
        reason,
        restore_stock: payload.restoreStock,
        created_at: now,
        updated_at: now,
        order: current,
      },
      ...demoRefunds,
    ];

    const nextOrder = saveDemoOrder({
      ...current,
      cashier_id: payload.cashierId,
      cashier: getDemoUser(payload.cashierId),
      payment_status: 'refunded',
      updated_at: now,
      status_history: appendDemoStatusHistory(current, current.status, payload.cashierId, `Refunded: ${reason}`),
    });

    return { data: nextOrder, error: null };
  }

  const { error: refundError } = await supabase.from('refunds').insert({
    order_id: payload.orderId,
    cashier_id: payload.cashierId,
    amount: current.total_amount,
    reason,
    restore_stock: payload.restoreStock,
  });

  if (refundError) return { data: null, error: refundError.message };

  if (payload.restoreStock) {
    await Promise.all(
      (current.items ?? [])
        .filter((item) => item.product_id && item.product)
        .map((item) =>
          supabase
            .from('products')
            .update({ stock: (item.product?.stock ?? 0) + item.quantity })
            .eq('id', item.product_id),
        ),
    );
  }

  const { error: paymentError } = await supabase
    .from('payments')
    .update({ status: 'failed' })
    .eq('order_id', payload.orderId);

  if (paymentError) return { data: null, error: paymentError.message };

  const { data, error } = await supabase
    .from('orders')
    .update({ payment_status: 'refunded', cashier_id: payload.cashierId })
    .eq('id', payload.orderId)
    .select(ORDER_SELECT)
    .maybeSingle();

  return {
    data: data ? await normalizeOrderWithHistory(data as OrderQueryRow) : null,
    error: error?.message ?? (data ? null : 'Unable to mark the order as refunded.'),
  };
}

function saveDemoTrackingPoint(nextPoint: DeliveryTrackingPoint): DeliveryTrackingPoint {
  const current = demoTrackingByOrder[nextPoint.order_id] ?? [];

  demoTrackingByOrder = {
    ...demoTrackingByOrder,
    [nextPoint.order_id]: sortTrackingPoints([
      ...current.filter((entry) => entry.id !== nextPoint.id),
      nextPoint,
    ]),
  };

  return clone(nextPoint);
}

function buildDemoTrackingPoint(
  orderId: string,
  riderId: string,
  status: OrderStatus,
  existingPoints: DeliveryTrackingPoint[],
  note?: string,
): DeliveryTrackingPoint {
  const route = getDemoTrackingRoute(orderId);
  const nextIndex = Math.min(existingPoints.length, route.length - 1);
  const nextPoint = route[nextIndex];
  const timestamp = new Date().toISOString();

  return {
    id: `tracking-${orderId}-${Date.now()}-${existingPoints.length + 1}`,
    order_id: orderId,
    rider_id: riderId,
    status,
    latitude: nextPoint.latitude,
    longitude: nextPoint.longitude,
    note,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function appendDemoStatusHistory(
  order: Order,
  nextStatus: OrderStatus,
  actorId?: string | null,
  note?: string,
): OrderStatusHistory[] {
  if (order.status === nextStatus) {
    return order.status_history ?? buildDemoStatusHistory(order);
  }

  const history = order.status_history ?? buildDemoStatusHistory(order);

  return [
    ...history,
    {
      id: `history-${order.id}-${nextStatus}-${history.length + 1}`,
      order_id: order.id,
      previous_status: order.status,
      next_status: nextStatus,
      changed_by: actorId ?? order.rider_id ?? order.cashier_id ?? order.customer_id,
      note,
      created_at: new Date().toISOString(),
    },
  ];
}

export async function getOrdersForUser(userId: string, role: Role): Promise<Order[]> {
  const fallback =
    role === 'customer'
      ? getDemoOrders().filter((order) => order.customer_id === userId)
      : role === 'rider'
        ? getDemoOrders().filter((order) => order.rider_id === userId)
        : role === 'cashier'
          ? getDemoOrders().filter((order) => order.cashier_id === userId)
          : getDemoOrders();

  const query =
    role === 'customer'
      ? buildOrdersQuery().eq('customer_id', userId)
      : role === 'rider'
        ? buildOrdersQuery().eq('rider_id', userId)
        : role === 'cashier'
          ? buildOrdersQuery().eq('cashier_id', userId)
          : buildOrdersQuery();

  const rows = await withFallback(query, fallback);
  return normalizeOrdersWithHistory(rows as OrderQueryRow[]);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const fallback = getDemoOrders().find((order) => order.id === orderId) ?? null;
  const row = await withFallback(buildOrdersQuery().eq('id', orderId).maybeSingle(), fallback);

  if (!row) {
    return null;
  }

  return normalizeOrderWithHistory(row as OrderQueryRow);
}

export async function getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
  const fallback = getDemoOrders().find((order) => order.id === orderId)?.status_history ?? [];

  if (!isSupabaseConfigured || hasOrderStatusHistoryTable === false) {
    return [...fallback].sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  const { data, error, status } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    if (status === 404 || error?.code === 'PGRST205') {
      hasOrderStatusHistoryTable = false;
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ORDER_STATUS_HISTORY_DISABLED_KEY, 'true');
      }
    }

    return [...fallback].sort((left, right) => left.created_at.localeCompare(right.created_at));
  }

  hasOrderStatusHistoryTable = true;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(ORDER_STATUS_HISTORY_DISABLED_KEY);
  }
  return [...data].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export async function getOrderTrackingPoints(orderId: string): Promise<DeliveryTrackingPoint[]> {
  const fallback = clone(demoTrackingByOrder[orderId] ?? []);

  const rows = await withFallback(
    supabase
      .from('delivery_tracking')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    fallback,
  );

  return sortTrackingPoints((rows as DeliveryTrackingQueryRow[]).map(normalizeTrackingPoint));
}

export async function getAdminOrders(): Promise<Order[]> {
  const rows = await withFallback(buildOrdersQuery(), getDemoOrders());
  return normalizeOrdersWithHistory(rows as OrderQueryRow[]);
}

export async function getAdminOrdersPage(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OrderStatus | 'all';
  paymentStatus?: Order['payment_status'] | 'all';
} = {}): Promise<{ data: Order[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 10);
  const offset = (page - 1) * pageSize;
  const search = params.search?.trim().toLowerCase() ?? '';
  const status = params.status ?? 'all';
  const paymentStatus = params.paymentStatus ?? 'all';
  const fallbackRows = getDemoOrders()
    .filter((order) => status === 'all' || order.status === status)
    .filter((order) => paymentStatus === 'all' || order.payment_status === paymentStatus)
    .filter((order) => {
      if (!search) return true;
      return [
        order.id,
        order.customer?.full_name,
        order.delivery_address,
        order.payment_method,
        order.payment_status,
        order.status,
      ].some((value) => String(value ?? '').toLowerCase().includes(search));
    });

  if (!isSupabaseConfigured) {
    return { data: fallbackRows.slice(offset, offset + pageSize), total: fallbackRows.length, page, pageSize };
  }

  let query = supabase
    .from('orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (status !== 'all') query = query.eq('status', status);
  if (paymentStatus !== 'all') query = query.eq('payment_status', paymentStatus);
  if (search) {
    query = query.or(
      `id.ilike.%${search}%,delivery_address.ilike.%${search}%,payment_method.ilike.%${search}%,payment_status.ilike.%${search}%`,
    );
  }

  const { data, count, error } = await query;
  if (error || !data) {
    return { data: fallbackRows.slice(offset, offset + pageSize), total: fallbackRows.length, page, pageSize };
  }

  return { data: await normalizeOrdersWithHistory(data as OrderQueryRow[]), total: count ?? 0, page, pageSize };
}

export async function getAvailableDeliveries(): Promise<Order[]> {
  const fallback = getDemoOrders().filter(
    (order) => !order.rider_id && ['confirmed', 'preparing'].includes(order.status),
  );

  const rows = await withFallback(
    buildOrdersQuery().is('rider_id', null).in('status', ['confirmed', 'preparing']),
    fallback,
  );

  return normalizeOrdersWithHistory(rows as OrderQueryRow[]);
}

export async function getPendingPaymentOrders(): Promise<Order[]> {
  const fallback = getDemoOrders().filter(isPendingPaymentQueueOrder);

  const rows = await withFallback(
    buildOrdersQuery().in('status', ['pending', 'confirmed', 'preparing', 'picked_up', 'on_the_way']),
    fallback,
  );

  return (await normalizeOrdersWithHistory(rows as OrderQueryRow[])).filter(isPendingPaymentQueueOrder);
}

export async function assignOrderToRider(orderId: string, riderId: string): Promise<{ data: Order | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = getDemoOrders().find((order) => order.id === orderId);

    if (!current || current.rider_id) {
      return { data: null, error: 'That delivery is no longer available.' };
    }

    const nextOrder = saveDemoOrder({
      ...current,
      rider_id: riderId,
      rider: getDemoUser(riderId),
      updated_at: new Date().toISOString(),
    });

    return { data: nextOrder, error: null };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({
      rider_id: riderId,
    })
    .eq('id', orderId)
    .is('rider_id', null)
    .in('status', ['confirmed', 'preparing'])
    .select(ORDER_SELECT)
    .maybeSingle();

  return {
    data: data ? await normalizeOrderWithHistory(data as OrderQueryRow) : null,
    error: error?.message ?? (data ? null : 'That delivery is no longer available.'),
  };
}

export async function assignDeliveryRider(
  orderId: string,
  riderId: string,
  options?: {
    cashierId?: string | null;
  },
): Promise<{ data: Order | null; error: string | null }> {
  if (!riderId) {
    return { data: null, error: 'Select a rider first.' };
  }

  const assignableStatuses: OrderStatus[] = ['pending', 'confirmed', 'preparing'];

  if (!isSupabaseConfigured) {
    const current = getDemoOrders().find((order) => order.id === orderId);

    if (!current) {
      return { data: null, error: 'Order not found.' };
    }

    if (!assignableStatuses.includes(current.status)) {
      return {
        data: null,
        error: 'Riders can only be assigned before pickup or cancellation.',
      };
    }

    const nextOrder = saveDemoOrder({
      ...current,
      rider_id: riderId,
      rider: getDemoUser(riderId),
      cashier_id: options?.cashierId ?? current.cashier_id,
      cashier: options?.cashierId ? getDemoUser(options.cashierId) : current.cashier,
      updated_at: new Date().toISOString(),
    });

    return { data: nextOrder, error: null };
  }

  const payload: Partial<Order> = {
    rider_id: riderId,
  };

  if (options?.cashierId) {
    payload.cashier_id = options.cashierId;
  }

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .in('status', assignableStatuses)
    .select(ORDER_SELECT)
    .maybeSingle();

  return {
    data: data ? await normalizeOrderWithHistory(data as OrderQueryRow) : null,
    error:
      error?.message ??
      (data ? null : 'Riders can only be assigned before pickup or cancellation.'),
  };
}

export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  options?: {
    riderId?: string | null;
    cashierId?: string | null;
    paymentStatus?: Order['payment_status'];
    note?: string;
  },
): Promise<{ data: Order | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = getDemoOrders().find((order) => order.id === orderId);

    if (!current) {
      return { data: null, error: 'Order not found.' };
    }

    const nextOrder = saveDemoOrder({
      ...current,
      status: nextStatus,
      rider_id: options?.riderId ?? current.rider_id,
      rider: options?.riderId ? getDemoUser(options.riderId) : current.rider,
      cashier_id: options?.cashierId ?? current.cashier_id,
      cashier: options?.cashierId ? getDemoUser(options.cashierId) : current.cashier,
      payment_status: options?.paymentStatus ?? current.payment_status,
      updated_at: new Date().toISOString(),
      status_history: appendDemoStatusHistory(
        current,
        nextStatus,
        options?.cashierId ?? options?.riderId ?? current.rider_id ?? current.cashier_id,
        options?.note,
      ),
    });

    if (nextStatus === 'picked_up' || nextStatus === 'on_the_way' || nextStatus === 'delivered') {
      const existingPoints = demoTrackingByOrder[orderId] ?? [];
      saveDemoTrackingPoint(
        buildDemoTrackingPoint(
          orderId,
          options?.riderId ?? current.rider_id ?? current.customer_id ?? current.cashier_id ?? 'demo-actor',
          nextStatus,
          existingPoints,
          options?.note,
        ),
      );
    }

    return { data: nextOrder, error: null };
  }

  const payload: Partial<Order> = { status: nextStatus };

  if (options?.riderId) {
    payload.rider_id = options.riderId;
  }

  if (options?.cashierId) {
    payload.cashier_id = options.cashierId;
  }

  if (options?.paymentStatus) {
    payload.payment_status = options.paymentStatus;
  }

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select(ORDER_SELECT)
    .maybeSingle();

  if (data && options?.note) {
    const history = await supabase
      .from('order_status_history')
      .select('id')
      .eq('order_id', orderId)
      .eq('next_status', nextStatus)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (history.data?.id) {
      await supabase.from('order_status_history').update({ note: options.note }).eq('id', history.data.id);
    }
  }

  return {
    data: data ? await normalizeOrderWithHistory(data as OrderQueryRow) : null,
    error: error?.message ?? (data ? null : 'Unable to update the order status.'),
  };
}

export async function cancelCustomerOrder(
  orderId: string,
  customerId: string,
): Promise<{ data: Order | null; error: string | null }> {
  const current = await getOrderById(orderId);

  if (!current || current.customer_id !== customerId) {
    return { data: null, error: 'Order not found in your account.' };
  }

  if (!['pending', 'confirmed'].includes(current.status)) {
    return { data: null, error: 'Orders can only be cancelled before preparation starts.' };
  }

  return updateOrderStatus(orderId, 'cancelled', {
    note: 'Cancelled by customer',
  });
}

export async function uploadDeliveryProofImage(
  file: File,
  orderId: string,
): Promise<{ data: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { data: null, error: 'Select a valid proof photo.' };
  }

  if (file.size > MAX_DELIVERY_PHOTO_BYTES) {
    return { data: null, error: 'Proof photos must be 5 MB or smaller.' };
  }

  if (!isSupabaseConfigured) {
    try {
      return { data: await fileToDataUrl(file), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unable to read the proof photo.',
      };
    }
  }

  const extension = getImageExtension(file);
  const assetPath = `orders/${sanitizeStorageSegment(orderId)}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(DELIVERY_PHOTO_BUCKET).upload(assetPath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(DELIVERY_PHOTO_BUCKET).getPublicUrl(assetPath);
  return { data: data.publicUrl, error: null };
}

export async function createDeliveryPhoto(payload: {
  orderId: string;
  riderId: string;
  imageUrl: string;
}): Promise<{ data: DeliveryPhoto | null; error: string | null }> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const photo: DeliveryPhoto = {
      id: `delivery-photo-${payload.orderId}-${Date.now()}`,
      order_id: payload.orderId,
      rider_id: payload.riderId,
      image_url: payload.imageUrl,
      created_at: now,
      updated_at: now,
    };
    demoDeliveryPhotos = [photo, ...demoDeliveryPhotos.filter((entry) => entry.id !== photo.id)];
    return { data: clone(photo), error: null };
  }

  const { data, error } = await supabase
    .from('delivery_photos')
    .insert({
      order_id: payload.orderId,
      rider_id: payload.riderId,
      image_url: payload.imageUrl,
    })
    .select()
    .maybeSingle();

  return {
    data: data as DeliveryPhoto | null,
    error: error?.message ?? (data ? null : 'Unable to save the proof photo.'),
  };
}

export async function reportDeliveryIssue(payload: {
  orderId: string;
  riderId: string;
  reason: DeliveryIssueReason;
  notes?: string;
}): Promise<{ data: DeliveryIssue | null; error: string | null }> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured) {
    const issue: DeliveryIssue = {
      id: `delivery-issue-${payload.orderId}-${Date.now()}`,
      order_id: payload.orderId,
      rider_id: payload.riderId,
      reason: payload.reason,
      notes: payload.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    };
    demoDeliveryIssues = [issue, ...demoDeliveryIssues];
    return { data: clone(issue), error: null };
  }

  const { data, error } = await supabase
    .from('delivery_issues')
    .insert({
      order_id: payload.orderId,
      rider_id: payload.riderId,
      reason: payload.reason,
      notes: payload.notes?.trim() || null,
    })
    .select()
    .maybeSingle();

  return {
    data: data as DeliveryIssue | null,
    error: error?.message ?? (data ? null : 'Unable to report the delivery issue.'),
  };
}

export async function updateOrderInternalNote(
  orderId: string,
  note: string,
): Promise<{ data: Order | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = getDemoOrders().find((order) => order.id === orderId);
    if (!current) return { data: null, error: 'Order not found.' };
    const nextOrder = saveDemoOrder({
      ...current,
      admin_internal_note: note,
      updated_at: new Date().toISOString(),
    });
    return { data: nextOrder, error: null };
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ admin_internal_note: note })
    .eq('id', orderId)
    .select(ORDER_SELECT)
    .maybeSingle();

  return {
    data: data ? await normalizeOrderWithHistory(data as OrderQueryRow) : null,
    error: error?.message ?? (data ? null : 'Unable to save the internal note.'),
  };
}

export async function verifyOrderPayment(
  orderId: string,
  cashierId: string,
): Promise<{ data: Order | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const current = getDemoOrders().find((order) => order.id === orderId);

    if (!current) {
      return { data: null, error: 'Order not found.' };
    }

    const nextPayments =
      current.payments?.map((payment) => ({
        ...payment,
        status: 'verified' as const,
        verified_by: cashierId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) ?? [];

    const nextOrder = saveDemoOrder({
      ...current,
      cashier_id: cashierId,
      cashier: getDemoUser(cashierId),
      status: 'preparing',
      payment_status: 'verified',
      updated_at: new Date().toISOString(),
      payments: nextPayments,
      status_history: appendDemoStatusHistory(current, 'preparing', cashierId, 'Payment verified'),
    });

    return { data: nextOrder, error: null };
  }

  const now = new Date().toISOString();

  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'verified',
      verified_by: cashierId,
      verified_at: now,
    })
    .eq('order_id', orderId);

  if (paymentError) {
    return { data: null, error: paymentError.message };
  }

  return updateOrderStatus(orderId, 'preparing', { cashierId, paymentStatus: 'verified' });
}

export async function createDeliveryTrackingPoint(payload: {
  orderId: string;
  riderId: string;
  status: OrderStatus;
  latitude?: number | null;
  longitude?: number | null;
  note?: string;
}): Promise<{ data: DeliveryTrackingPoint | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const currentPoints = demoTrackingByOrder[payload.orderId] ?? [];
    const nextPoint =
      payload.latitude !== undefined && payload.longitude !== undefined
        ? {
            id: `tracking-${payload.orderId}-${Date.now()}-${currentPoints.length + 1}`,
            order_id: payload.orderId,
            rider_id: payload.riderId,
            status: payload.status,
            latitude: payload.latitude ?? null,
            longitude: payload.longitude ?? null,
            note: payload.note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : buildDemoTrackingPoint(payload.orderId, payload.riderId, payload.status, currentPoints, payload.note);

    return {
      data: saveDemoTrackingPoint(nextPoint),
      error: null,
    };
  }

  const { data, error } = await supabase
    .from('delivery_tracking')
    .insert({
      order_id: payload.orderId,
      rider_id: payload.riderId,
      status: payload.status,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      note: payload.note ?? null,
    })
    .select()
    .maybeSingle();

  return {
    data: data ? normalizeTrackingPoint(data as DeliveryTrackingQueryRow) : null,
    error: error?.message ?? (data ? null : 'Unable to save the tracking update.'),
  };
}

export function estimateOrderEta(order: Order, trackingPoints: DeliveryTrackingPoint[] = []): string {
  if (order.status === 'delivered') return 'Arrived';
  if (order.status === 'cancelled') return 'Cancelled';
  if (!order.rider_id && ['pending', 'confirmed', 'preparing'].includes(order.status)) {
    return 'Assigning rider';
  }

  if (order.status === 'pending') return '45 min';
  if (order.status === 'confirmed') return '36 min';
  if (order.status === 'preparing') return '30 min';
  if (order.status === 'picked_up') return '24 min';

  if (order.status === 'on_the_way') {
    const livePoints = trackingPoints.filter(
      (point) => typeof point.latitude === 'number' && typeof point.longitude === 'number',
    );
    const etaMinutes = Math.max(8, 24 - Math.max(0, livePoints.length - 1) * 5);
    return `${etaMinutes} min`;
  }

  return '24 min';
}
