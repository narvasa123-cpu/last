import { Fragment, useMemo, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Flower2,
  MessageSquare,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAdminUsersQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { ORDER_FLOW, STATUS_LABELS } from '../../lib/constants';
import { assignDeliveryRider, getAdminOrdersPage, updateOrderInternalNote, updateOrderStatus } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { Order, OrderItem } from '../../lib/types';
import { formatDateTime, formatPrice } from '../../lib/utils';

const RIDER_ASSIGNABLE_STATUSES: Order['status'][] = ['pending', 'confirmed', 'preparing'];

function getOrderItemBouquet(item: OrderItem) {
  return item.custom_bouquet ?? item.product?.custom_bouquet ?? null;
}

function getOrderCustomBouquetCount(order: Order): number {
  return (order.items ?? []).filter((item) => Boolean(getOrderItemBouquet(item))).length;
}

function summarizeOrderItems(order: Order): string {
  const items = order.items ?? [];

  if (!items.length) {
    return 'No items';
  }

  return items
    .map((item) => {
      const bouquet = getOrderItemBouquet(item);
      if (bouquet) {
        return `${bouquet.sizeLabel} custom bouquet`;
      }
      return `${item.quantity}x ${item.product?.name ?? 'Product'}`;
    })
    .join(', ');
}

function OrderFulfillmentReview({ order }: { order: Order }) {
  const items = order.items ?? [];
  const customBouquetCount = getOrderCustomBouquetCount(order);

  return (
    <div className="admin-order-detail">
      <div className="fulfillment-grid">
        <div className="admin-detail-panel">
          <div className="summary-row">
            <div>
              <strong>Delivery brief</strong>
              <p>Florist and rider context for this order.</p>
            </div>
            <ClipboardList size={20} className="rose" />
          </div>
          <div className="summary-list">
            <div className="summary-row">
              <span>Address</span>
              <strong>{order.delivery_address || 'TBD'}</strong>
            </div>
            <div className="summary-row">
              <span>Schedule</span>
              <strong>
                {order.delivery_date || 'TBD'} / {order.delivery_time || 'TBD'}
              </strong>
            </div>
            <div className="summary-row">
              <span>Payment</span>
              <strong>{order.payment_method.toUpperCase()} - {order.payment_status}</strong>
            </div>
            <div className="summary-row">
              <span>Custom bouquets</span>
              <strong>{customBouquetCount}</strong>
            </div>
            {order.notes ? (
              <div className="admin-note">
                <MessageSquare size={16} />
                <span>{order.notes}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="admin-detail-panel">
          <div className="summary-row">
            <div>
              <strong>Florist recipe</strong>
              <p>Item-level build details for preparation.</p>
            </div>
            <Flower2 size={20} className="rose" />
          </div>
          <div className="order-recipe-list">
            {items.length ? (
              items.map((item) => {
                const bouquet = getOrderItemBouquet(item);

                if (!bouquet) {
                  return (
                    <div className="bouquet-spec-card" key={item.id}>
                      <div className="summary-row">
                        <strong>{item.product?.name ?? 'Product'}</strong>
                        <span>{formatPrice(item.subtotal)}</span>
                      </div>
                        <p>
                          Quantity {item.quantity} - Unit price {formatPrice(item.unit_price)}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="bouquet-spec-card bouquet-spec-card-custom" key={item.id}>
                    <div className="summary-row">
                      <div>
                        <strong>{bouquet.sizeLabel} Custom Bouquet</strong>
                        <p>
                          {bouquet.wrapperLabel} wrap - {bouquet.ribbonLabel} ribbon - {bouquet.sizeMultiplier}x size
                        </p>
                      </div>
                      <span className="price">{formatPrice(item.subtotal)}</span>
                    </div>
                    <div className="stem-chip-list">
                      {bouquet.flowers.map((flower) => (
                        <span className="stem-chip" key={flower.id}>
                          <span style={{ background: flower.color }} />
                          {flower.quantity}x {flower.name}
                        </span>
                      ))}
                    </div>
                    <div className="custom-summary-grid">
                      <div>
                        <span>Flowers</span>
                        <strong>{formatPrice(bouquet.subtotal)}</strong>
                      </div>
                      <div>
                        <span>Add-ons</span>
                        <strong>{formatPrice(bouquet.addOnsCost)}</strong>
                      </div>
                      <div>
                        <span>Total</span>
                        <strong>{formatPrice(bouquet.total)}</strong>
                      </div>
                    </div>
                    {bouquet.addOns.length ? (
                      <p>Add-ons: {bouquet.addOns.map((addOn) => addOn.label).join(', ')}</p>
                    ) : null}
                    {bouquet.message ? <div className="admin-note">{bouquet.message}</div> : null}
                  </div>
                );
              })
            ) : (
              <p>No order items are attached yet.</p>
            )}
          </div>
        </div>

        <div className="admin-detail-panel">
          <div className="summary-row">
            <div>
              <strong>Status audit trail</strong>
              <p>Every recorded lifecycle change for this order.</p>
            </div>
          </div>
          <div className="activity-list">
            {(order.status_history ?? []).length ? (
              (order.status_history ?? []).map((entry) => (
                <div className="activity-item" key={entry.id}>
                  <strong>{STATUS_LABELS[entry.next_status]}</strong>
                  <span>{formatDateTime(entry.created_at)}</span>
                  {entry.note ? <p>{entry.note}</p> : null}
                </div>
              ))
            ) : (
              <p>No status history is attached yet.</p>
            )}
          </div>
        </div>

        <div className="admin-detail-panel">
          <div className="summary-row">
            <div>
              <strong>Delivery proof</strong>
              <p>Rider-submitted doorstep confirmation photos.</p>
            </div>
          </div>
          <div className="order-recipe-list">
            {(order.delivery_photos ?? []).length ? (
              (order.delivery_photos ?? []).map((photo) => (
                <div className="bouquet-spec-card" key={photo.id}>
                  <img
                    src={photo.image_url}
                    alt={`Delivery proof for order ${order.id.slice(0, 8)}`}
                    style={{ borderRadius: '0.5rem', maxHeight: '16rem', objectFit: 'cover', width: '100%' }}
                  />
                  <p>Uploaded {formatDateTime(photo.created_at)}</p>
                </div>
              ))
            ) : (
              <p>No proof photo has been uploaded yet.</p>
            )}
          </div>
        </div>

        <div className="admin-detail-panel">
          <div className="summary-row">
            <div>
              <strong>Delivery issues</strong>
              <p>Exceptions reported by the rider during the route.</p>
            </div>
          </div>
          <div className="activity-list">
            {(order.delivery_issues ?? []).length ? (
              (order.delivery_issues ?? []).map((issue) => (
                <div className="activity-item" key={issue.id}>
                  <strong>{issue.reason.replace(/_/g, ' ')}</strong>
                  <span>{formatDateTime(issue.created_at)}</span>
                  {issue.notes ? <p>{issue.notes}</p> : null}
                </div>
              ))
            ) : (
              <p>No delivery issues reported.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManageOrders() {
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const adminUsersQuery = useAdminUsersQuery();
  const [filter, setFilter] = useState<'all' | Order['status']>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | Order['payment_status']>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [riderSelections, setRiderSelections] = useState<Record<string, string>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<{ order: Order; action: 'cancel' | 'refund' } | null>(null);
  const [reason, setReason] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const pageSize = 10;
  const adminOrdersQuery = useQuery({
    queryKey: [...queryKeys.adminOrders, { page, search, filter, paymentFilter }],
    queryFn: () =>
      getAdminOrdersPage({
        page,
        pageSize,
        search,
        status: filter,
        paymentStatus: paymentFilter,
      }),
    staleTime: 15 * 1000,
  });
  const orders = adminOrdersQuery.data?.data ?? [];
  const totalOrders = adminOrdersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const riders = (adminUsersQuery.data ?? []).filter((user) => user.role === 'rider' && user.is_active);
  const loading = adminOrdersQuery.isLoading || adminUsersQuery.isLoading;

  useRealtimeQueryInvalidation(
    [
      {
        table: 'orders',
        queryKeys: [queryKeys.adminOrders, queryKeys.adminAnalytics],
      },
      {
        table: 'delivery_photos',
        queryKeys: [queryKeys.adminOrders],
      },
      {
        table: 'delivery_issues',
        queryKeys: [queryKeys.adminOrders],
      },
      {
        table: 'users',
        queryKeys: [queryKeys.adminUsers],
      },
    ],
    true,
  );

  const adminStats = useMemo(
    () => ({
      visibleOrders: totalOrders,
      customBouquets: orders.reduce((sum, order) => sum + getOrderCustomBouquetCount(order), 0),
      unassigned: orders.filter(
        (order) => RIDER_ASSIGNABLE_STATUSES.includes(order.status) && !order.rider_id,
      ).length,
      revenue: orders.reduce((sum, order) => sum + order.total_amount, 0),
    }),
    [orders, totalOrders],
  );

  const advanceStatus = async (order: Order) => {
    const index = ORDER_FLOW.indexOf(order.status);
    if (index < 0) {
      return;
    }

    const nextStatus = ORDER_FLOW[Math.min(index + 1, ORDER_FLOW.length - 1)];

    if (nextStatus === order.status) {
      return;
    }

    setPendingOrderId(order.id);
    const { data, error } = await updateOrderStatus(order.id, nextStatus, {
      cashierId: order.cashier_id,
    });
    setPendingOrderId(null);

    if (error || !data) {
      showToast('Update failed', error ?? 'Unable to move the order forward.');
      return;
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.adminOrders,
      (current = []) => current.map((entry) => (entry.id === data.id ? data : entry)),
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminAnalytics });
    showToast('Order updated', `Order #${data.id.slice(0, 8)} is now ${STATUS_LABELS[data.status]}.`);
    void adminOrdersQuery.refetch();
  };

  const submitReasonTransition = async () => {
    if (!reasonTarget) return;
    if (!reason.trim()) {
      showToast('Reason required', 'Capture the reason before changing this order.');
      return;
    }

    const { order, action } = reasonTarget;
    setPendingOrderId(order.id);
    const result = await updateOrderStatus(order.id, action === 'cancel' ? 'cancelled' : order.status, {
      cashierId: order.cashier_id,
      paymentStatus: action === 'refund' ? 'refunded' : order.payment_status,
      note: `${action === 'cancel' ? 'Cancelled' : 'Refunded'}: ${reason.trim()}`,
    });
    setPendingOrderId(null);

    if (result.error || !result.data) {
      showToast(`${action === 'cancel' ? 'Cancel' : 'Refund'} failed`, result.error ?? 'Unable to update the order.');
      return;
    }

    setReasonTarget(null);
    setReason('');
    void adminOrdersQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminAnalytics });
    showToast('Order updated', `Reason captured for order #${order.id.slice(0, 8)}.`);
  };

  const saveInternalNote = async (order: Order) => {
    const note = noteDrafts[order.id] ?? order.admin_internal_note ?? '';
    setPendingOrderId(order.id);
    const { data, error } = await updateOrderInternalNote(order.id, note);
    setPendingOrderId(null);

    if (error || !data) {
      showToast('Note failed', error ?? 'Unable to save the internal note.');
      return;
    }

    void adminOrdersQuery.refetch();
    showToast('Internal note saved', `Order #${order.id.slice(0, 8)} was updated.`);
  };

  const assignRider = async (order: Order) => {
    const riderId = riderSelections[order.id] ?? '';

    if (!riderId) {
      showToast('Select a rider', 'Choose which rider should handle this delivery first.');
      return;
    }

    setPendingOrderId(order.id);
    const { data, error } = await assignDeliveryRider(order.id, riderId);
    setPendingOrderId(null);

    if (error || !data) {
      showToast('Assignment failed', error ?? 'Unable to assign the rider to this order.');
      return;
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.adminOrders,
      (current = []) => current.map((entry) => (entry.id === data.id ? data : entry)),
    );
    setRiderSelections((current) => ({ ...current, [data.id]: data.rider_id ?? '' }));
    void queryClient.invalidateQueries({ queryKey: queryKeys.availableDeliveries });
    if (data.rider_id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ordersForUser(data.rider_id, 'rider') });
    }
    showToast('Rider assigned', `${data.rider?.full_name ?? 'The selected rider'} will handle this delivery.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <Card className="summary-card admin-fulfillment-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Manage Orders</span>
                <h2>Fulfillment pipeline</h2>
                <p>Review status progression, rider assignments, and custom bouquet recipes before fulfillment.</p>
              </div>
              <div className="summary-row">
                <Input
                  label="Search orders"
                  icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
                <div className="select-shell">
                  <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                    <option value="all">All statuses</option>
                    {Object.keys(STATUS_LABELS).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="select-shell">
                  <select
                    value={paymentFilter}
                    onChange={(event) => {
                      setPaymentFilter(event.target.value as typeof paymentFilter);
                      setPage(1);
                    }}
                  >
                    <option value="all">All payments</option>
                    {(['unpaid', 'pending', 'verified', 'failed', 'paid', 'refunded'] as const).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="admin-order-insights">
              <div className="admin-insight-card">
                <span>Visible Orders</span>
                <strong>{adminStats.visibleOrders}</strong>
              </div>
              <div className="admin-insight-card">
                <span>Custom Bouquets</span>
                <strong className={adminStats.customBouquets === 0 ? 'muted-metric' : undefined}>
                  {adminStats.customBouquets}
                </strong>
              </div>
              <div className="admin-insight-card">
                <span>Unassigned</span>
                <strong className={adminStats.unassigned === 0 ? 'muted-metric' : undefined}>
                  {adminStats.unassigned}
                </strong>
              </div>
              <div className="admin-insight-card">
                <span>Visible Revenue</span>
                <strong className="tabular-nums">{formatPrice(adminStats.revenue)}</strong>
              </div>
            </div>
            <div className="table-shell">
              <table className="table admin-orders-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th className="align-left">Customer</th>
                    <th className="align-center">Status</th>
                    <th>Rider</th>
                    <th>Items</th>
                    <th className="align-right">Total</th>
                    <th className="align-right">Updated</th>
                    <th className="align-center">Actions</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9}>Loading orders...</td>
                    </tr>
                  ) : orders.length ? (
                    orders.map((order) => (
                      <Fragment key={order.id}>
                        <tr className="admin-order-row">
                          <td>#{order.id.slice(0, 8)}</td>
                          <td className="align-left">{order.customer?.full_name}</td>
                          <td className="align-center">
                            <Badge
                              variant={order.status === 'delivered' ? 'success' : 'neutral'}
                              className={`status-badge status-badge-${order.status}`}
                            >
                              {STATUS_LABELS[order.status]}
                            </Badge>
                          </td>
                          <td>
                            <div className="rider-cell">
                              <span className={order.rider ? 'rider-name' : 'rider-placeholder'}>
                                {order.rider?.full_name ?? 'Assign Rider'}
                              </span>
                              {RIDER_ASSIGNABLE_STATUSES.includes(order.status) ? (
                                <div className="select-shell rider-select-shell">
                                  <select
                                    aria-label={`Select rider for order ${order.id.slice(0, 8)}`}
                                    value={riderSelections[order.id] ?? order.rider_id ?? ''}
                                    onChange={(event) =>
                                      setRiderSelections((current) => ({
                                        ...current,
                                        [order.id]: event.target.value,
                                      }))
                                    }
                                    disabled={pendingOrderId === order.id || riders.length === 0}
                                  >
                                    <option value="">{riders.length ? 'Choose rider' : 'No active riders'}</option>
                                    {riders.map((rider) => (
                                      <option key={rider.id} value={rider.id}>
                                        {rider.full_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <span className="admin-item-summary">{summarizeOrderItems(order)}</span>
                          </td>
                          <td className="align-right tabular-nums">{formatPrice(order.total_amount)}</td>
                          <td className="align-right tabular-nums">{formatDateTime(order.updated_at)}</td>
                          <td className="align-center">
                            <div className="order-actions" aria-label={`Actions for order ${order.id.slice(0, 8)}`}>
                              <div className="order-action-group">
                                <button
                                  type="button"
                                  className="icon-button order-action-button"
                                  aria-label="Save rider"
                                  title="Save rider"
                                  disabled={
                                    pendingOrderId === order.id ||
                                    !RIDER_ASSIGNABLE_STATUSES.includes(order.status) ||
                                    !riderSelections[order.id] ||
                                    riderSelections[order.id] === (order.rider_id ?? '')
                                  }
                                  onClick={() => assignRider(order)}
                                >
                                  <Check size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button order-action-button"
                                  aria-label="Advance order"
                                  title="Advance order"
                                  disabled={
                                    pendingOrderId === order.id ||
                                    order.status === 'delivered' ||
                                    order.status === 'cancelled'
                                  }
                                  onClick={() => advanceStatus(order)}
                                >
                                  <ArrowRight size={15} />
                                </button>
                              </div>
                              <div className="order-action-group order-action-group-secondary">
                                <button
                                  type="button"
                                  className="icon-button order-action-button order-action-button-danger"
                                  aria-label="Cancel order"
                                  title="Cancel order"
                                  disabled={pendingOrderId === order.id || ['delivered', 'cancelled'].includes(order.status)}
                                  onClick={() => setReasonTarget({ order, action: 'cancel' })}
                                >
                                  <XCircle size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button order-action-button"
                                  aria-label="Refund order"
                                  title="Refund order"
                                  disabled={pendingOrderId === order.id || order.payment_status === 'refunded'}
                                  onClick={() => setReasonTarget({ order, action: 'refund' })}
                                >
                                  <RotateCcw size={15} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setExpandedOrderId((current) => (current === order.id ? null : order.id))
                              }
                            >
                              {expandedOrderId === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              Details
                            </Button>
                          </td>
                        </tr>
                        {expandedOrderId === order.id ? (
                          <tr>
                            <td colSpan={9}>
                              <div className="admin-detail-panel" style={{ marginBottom: '1rem' }}>
                                <strong>Admin-only internal note</strong>
                                <Textarea
                                  label="Internal note"
                                  value={noteDrafts[order.id] ?? order.admin_internal_note ?? ''}
                                  onChange={(event) =>
                                    setNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))
                                  }
                                />
                                <Button size="sm" disabled={pendingOrderId === order.id} onClick={() => saveInternalNote(order)}>
                                  Save Note
                                </Button>
                              </div>
                              <OrderFulfillmentReview order={order} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>No orders matched that status.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span>Page {page} of {totalPages} - {totalOrders} orders</span>
              <div className="summary-row">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <Modal
        open={Boolean(reasonTarget)}
        onClose={() => {
          setReasonTarget(null);
          setReason('');
        }}
        title={reasonTarget?.action === 'refund' ? 'Refund Order' : 'Cancel Order'}
        description="Capture an audit reason before applying this lifecycle change."
      >
        <div className="section">
          <Textarea label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="summary-row">
            <Button variant="secondary" onClick={() => setReasonTarget(null)}>Close</Button>
            <Button onClick={submitReasonTransition} disabled={Boolean(reasonTarget && pendingOrderId === reasonTarget.order.id)}>
              Save Change
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
