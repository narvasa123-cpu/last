import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useAdminOrdersQuery, useAdminUsersQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { STATUS_LABELS } from '../../lib/constants';
import { assignDeliveryRider } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { Order } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

const RIDER_ASSIGNABLE_STATUSES: Order['status'][] = ['pending', 'confirmed', 'preparing'];

export function AssignRider() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const adminOrdersQuery = useAdminOrdersQuery();
  const adminUsersQuery = useAdminUsersQuery();
  const [riderSelections, setRiderSelections] = useState<Record<string, string>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);

  const orders = (adminOrdersQuery.data ?? []).filter(
    (order) => !order.rider_id && RIDER_ASSIGNABLE_STATUSES.includes(order.status),
  );
  const riders = (adminUsersQuery.data ?? []).filter((entry) => entry.role === 'rider' && entry.is_active);
  const loading = adminOrdersQuery.isLoading || adminUsersQuery.isLoading;
  const ordersError = adminOrdersQuery.error instanceof Error ? adminOrdersQuery.error.message : null;
  const ridersError = adminUsersQuery.error instanceof Error ? adminUsersQuery.error.message : null;

  useRealtimeQueryInvalidation(
    [
      {
        table: 'orders',
        queryKeys: [queryKeys.adminOrders, queryKeys.availableDeliveries],
      },
      {
        table: 'users',
        queryKeys: [queryKeys.adminUsers],
      },
    ],
    true,
  );

  const handleAssignRider = async (order: Order) => {
    const riderId = riderSelections[order.id] ?? '';

    if (!riderId) {
      showToast('Select a rider', 'Choose which rider should handle this delivery first.');
      return;
    }

    if (!user?.id) return;

    setSubmittingOrderId(order.id);
    const { data, error } = await assignDeliveryRider(order.id, riderId, {
      cashierId: user.id,
    });
    setSubmittingOrderId(null);

    if (error || !data) {
      showToast('Assignment failed', error ?? 'Unable to assign the rider to this order.');
      return;
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.adminOrders,
      (current = []) => current.filter((entry) => entry.id !== data.id),
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.availableDeliveries });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminOrders });
    if (data.rider_id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ordersForUser(data.rider_id, 'rider') });
    }

    setRiderSelections((current) => {
      const next = { ...current };
      delete next[data.id];
      return next;
    });

    showToast(
      'Rider assigned',
      `Order #${data.id.slice(0, 8)} is assigned to ${data.rider?.full_name ?? 'the selected rider'}.`,
    );
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="cashier" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Assign Rider</span>
                <h2>Unassigned Delivery Orders</h2>
                <p>Assign an active rider to orders that are ready for delivery assignment.</p>
              </div>
            </div>
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Delivery Address</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Rider</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>Loading orders...</td>
                    </tr>
                  ) : ordersError ? (
                    <tr>
                      <td colSpan={7}>Unable to load orders: {ordersError}</td>
                    </tr>
                  ) : ridersError ? (
                    <tr>
                      <td colSpan={7}>Unable to load riders: {ridersError}</td>
                    </tr>
                  ) : orders.length ? (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id.slice(0, 8)}</td>
                        <td>{order.customer?.full_name ?? 'Guest'}</td>
                        <td>{order.delivery_address || 'TBD'}</td>
                        <td>{formatPrice(order.total_amount)}</td>
                        <td>{STATUS_LABELS[order.status]}</td>
                        <td>
                          <div className="select-shell">
                            <select
                              aria-label={`Select rider for order ${order.id.slice(0, 8)}`}
                              value={riderSelections[order.id] ?? ''}
                              onChange={(event) =>
                                setRiderSelections((current) => ({
                                  ...current,
                                  [order.id]: event.target.value,
                                }))
                              }
                              disabled={submittingOrderId === order.id || riders.length === 0}
                            >
                              <option value="">{riders.length ? 'Choose rider' : 'No active riders'}</option>
                              {riders.map((rider) => (
                                <option key={rider.id} value={rider.id}>
                                  {rider.full_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            onClick={() => handleAssignRider(order)}
                            disabled={submittingOrderId === order.id || !riderSelections[order.id]}
                          >
                            {submittingOrderId === order.id ? 'Assigning...' : 'Assign Rider'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>No unassigned orders in a rider-assignable status.</td>
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
