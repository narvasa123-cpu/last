import { MOCK_ORDERS, MOCK_USERS, ORDER_FLOW } from './constants';
import { isSupabaseConfigured, supabase, withFallback } from './supabase';
import { BASE_TRACKING_ROUTE } from './trackingRoute';
import type {
  DeliveryTrackingPoint,
  Order,
  OrderStatus,
  OrderStatusHistory,
  PaymentRecord,
  PaymentRecordStatus,
  Role,
} from './types';

const ORDER_SELECT = `
  *,
  payments(*),
  order_items(*, product:products(*)),
  customer:users!orders_customer_id_fkey(*),
  rider:users!orders_rider_id_fkey(*),
  cashier:users!orders_cashier_id_fkey(*)
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
const ORDER_STATUS_HISTORY_DISABLED_KEY = 'bloom-shop:order-status-history-disabled';

let demoOrders = seedDemoOrders();
let demoTrackingByOrder = seedDemoTrackingMap();
let hasOrderStatusHistoryTable: boolean | null =
  typeof window !== 'undefined' && window.sessionStorage.getItem(ORDER_STATUS_HISTORY_DISABLED_KEY) === 'true'
    ? false
    : null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function buildOrdersQuery() {
  return supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false });
}

function getDemoOrders(): Order[] {
  return sortOrders(clone(demoOrders));
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
  return normalizeOrders(rows as OrderQueryRow[]);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const fallback = getDemoOrders().find((order) => order.id === orderId) ?? null;
  const row = await withFallback(buildOrdersQuery().eq('id', orderId).maybeSingle(), fallback);

  if (!row) {
    return null;
  }

  return normalizeOrder(row as OrderQueryRow);
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
  return normalizeOrders(rows as OrderQueryRow[]);
}

export async function getAvailableDeliveries(): Promise<Order[]> {
  const fallback = getDemoOrders().filter(
    (order) => !order.rider_id && ['confirmed', 'preparing'].includes(order.status),
  );

  const rows = await withFallback(
    buildOrdersQuery().is('rider_id', null).in('status', ['confirmed', 'preparing']),
    fallback,
  );

  return normalizeOrders(rows as OrderQueryRow[]);
}

export async function getPendingPaymentOrders(): Promise<Order[]> {
  const fallback = getDemoOrders().filter(isPendingPaymentQueueOrder);

  const rows = await withFallback(
    buildOrdersQuery().not('status', 'in', '(delivered,cancelled)'),
    fallback,
  );

  return normalizeOrders(rows as OrderQueryRow[]).filter(isPendingPaymentQueueOrder);
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
    data: data ? normalizeOrder(data as OrderQueryRow) : null,
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
    data: data ? normalizeOrder(data as OrderQueryRow) : null,
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
          options?.riderId ?? current.rider_id ?? current.customer_id,
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

  return {
    data: data ? normalizeOrder(data as OrderQueryRow) : null,
    error: error?.message ?? (data ? null : 'Unable to update the order status.'),
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
