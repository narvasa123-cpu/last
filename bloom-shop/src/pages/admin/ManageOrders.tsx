import { useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAdminOrdersQuery, useAdminUsersQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { ORDER_FLOW, STATUS_LABELS } from '../../lib/constants';
import { assignDeliveryRider, updateOrderStatus } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { Order } from '../../lib/types';
import { formatDateTime, formatPrice } from '../../lib/utils';

const RIDER_ASSIGNABLE_STATUSES: Order['status'][] = ['pending', 'confirmed', 'preparing'];

export function ManageOrders() {
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const adminOrdersQuery = useAdminOrdersQuery();
  const adminUsersQuery = useAdminUsersQuery();
  const [filter, setFilter] = useState<'all' | Order['status']>('all');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [riderSelections, setRiderSelections] = useState<Record<string, string>>({});
  const orders = adminOrdersQuery.data ?? [];
  const riders = (adminUsersQuery.data ?? []).filter((user) => user.role === 'rider' && user.is_active);
  const loading = adminOrdersQuery.isLoading || adminUsersQuery.isLoading;

  useRealtimeQueryInvalidation(
    [
      {
        table: 'orders',
        queryKeys: [queryKeys.adminOrders, queryKeys.adminAnalytics],
      },
      {
        table: 'users',
        queryKeys: [queryKeys.adminUsers],
      },
    ],
    true,
  );

  const filtered = useMemo(
    () => (filter === 'all' ? orders : orders.filter((order) => order.status === filter)),
    [filter, orders],
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
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Manage Orders</span>
                <h2>Fulfillment pipeline</h2>
                <p>Review status progression and nudge urgent deliveries forward.</p>
              </div>
              <div className="summary-row">
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
              </div>
            </div>
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Rider</th>
                    <th>Total</th>
                    <th>Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>Loading orders...</td>
                    </tr>
                  ) : filtered.length ? (
                    filtered.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id.slice(0, 8)}</td>
                        <td>{order.customer?.full_name}</td>
                        <td>
                          <Badge variant={order.status === 'delivered' ? 'success' : 'primary'}>
                            {STATUS_LABELS[order.status]}
                          </Badge>
                        </td>
                        <td>
                          <div className="section" style={{ gap: '0.65rem' }}>
                            <span>{order.rider?.full_name ?? 'Unassigned'}</span>
                            <div className="select-shell">
                              <select
                                value={riderSelections[order.id] ?? order.rider_id ?? ''}
                                onChange={(event) =>
                                  setRiderSelections((current) => ({
                                    ...current,
                                    [order.id]: event.target.value,
                                  }))
                                }
                                disabled={
                                  pendingOrderId === order.id ||
                                  !RIDER_ASSIGNABLE_STATUSES.includes(order.status) ||
                                  riders.length === 0
                                }
                              >
                                <option value="">{riders.length ? 'Choose rider' : 'No active riders'}</option>
                                {riders.map((rider) => (
                                  <option key={rider.id} value={rider.id}>
                                    {rider.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>
                        <td>{formatPrice(order.total_amount)}</td>
                        <td>{formatDateTime(order.updated_at)}</td>
                        <td>
                          <div className="action-row action-row-dual">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={
                                pendingOrderId === order.id ||
                                !RIDER_ASSIGNABLE_STATUSES.includes(order.status) ||
                                !riderSelections[order.id] ||
                                riderSelections[order.id] === (order.rider_id ?? '')
                              }
                              onClick={() => assignRider(order)}
                            >
                              Save Rider
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={
                                pendingOrderId === order.id ||
                                order.status === 'delivered' ||
                                order.status === 'cancelled'
                              }
                              onClick={() => advanceStatus(order)}
                            >
                              Advance
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>No orders matched that status.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
