import { useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useAvailableDeliveriesQuery, useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { STATUS_LABELS } from '../../lib/constants';
import { assignOrderToRider } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { Order } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';

export function RiderDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const availableDeliveriesQuery = useAvailableDeliveriesQuery();
  const assignedOrdersQuery = useOrdersForUserQuery(user?.id, 'rider');
  const availableDeliveries = availableDeliveriesQuery.data ?? ([] as Order[]);
  const assignedOrders = assignedOrdersQuery.data ?? ([] as Order[]);
  const loading = availableDeliveriesQuery.isLoading || assignedOrdersQuery.isLoading;
  const activeAssignedOrders = useMemo(
    () => assignedOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)),
    [assignedOrders],
  );

  useRealtimeQueryInvalidation(
    user
      ? [
          {
            table: 'orders',
            queryKeys: [queryKeys.availableDeliveries, queryKeys.ordersForUser(user.id, 'rider')],
          },
        ]
      : [],
    true,
  );

  const stats = useMemo(
    () => [
      { label: 'Available Routes', value: `${availableDeliveries.length}`, trend: 'Live queue', accent: 'primary' as const },
      {
        label: 'Active Drops',
        value: `${activeAssignedOrders.length}`,
        trend: 'Assigned to you',
        accent: 'success' as const,
      },
      {
        label: 'Completed',
        value: `${assignedOrders.filter((order) => order.status === 'delivered').length}`,
        trend: 'Finished routes',
        accent: 'neutral' as const,
      },
    ],
    [activeAssignedOrders.length, assignedOrders, availableDeliveries.length],
  );

  const acceptDelivery = async (orderId: string) => {
    if (!user?.id) return;

    const { data, error } = await assignOrderToRider(orderId, user.id);

    if (error || !data) {
      showToast('Claim failed', error ?? 'Unable to claim that delivery.');
      return;
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.availableDeliveries,
      (current = []) => current.filter((order) => order.id !== orderId),
    );
    queryClient.setQueryData<Order[]>(
      queryKeys.ordersForUser(user.id, 'rider'),
      (current = []) => [data, ...current.filter((order) => order.id !== data.id)],
    );
    showToast('Delivery assigned', `Order #${data.id.slice(0, 8)} is now on your rider board.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="rider" />
          <div className="section">
            <section className="kpi-grid">
              {stats.map((metric) => (
                <Card className="stat-card" key={metric.label}>
                  <p>{metric.label}</p>
                  <h3>{metric.value}</h3>
                  <span className={metric.accent === 'success' ? 'success' : metric.accent === 'primary' ? 'rose' : 'muted'}>
                    {metric.trend}
                  </span>
                </Card>
              ))}
            </section>

            <Card className="summary-card">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Assigned Deliveries</span>
                  <h2>Your rider board</h2>
                  <p>These are the orders already assigned to you by admin, cashier, or self-claim.</p>
                </div>
              </div>
              <div className="history-list">
                {loading ? (
                  <Card className="delivery-card">Loading assigned deliveries...</Card>
                ) : activeAssignedOrders.length ? (
                  activeAssignedOrders.map((order) => (
                    <Card className="delivery-card" key={order.id}>
                      <div className="summary-row">
                        <div className="section" style={{ gap: '0.2rem' }}>
                          <strong>Order #{order.id.slice(0, 8)}</strong>
                          <p>{order.delivery_address}</p>
                        </div>
                        <span className="badge badge-success">{STATUS_LABELS[order.status]}</span>
                      </div>
                      <div className="section" style={{ gap: '0.25rem' }}>
                        <span>{order.customer?.full_name ?? 'Bloom customer'}</span>
                        <span className="muted">Updated {formatDateTime(order.updated_at)}</span>
                        {order.status === 'pending' ? (
                          <span className="muted">Waiting for cashier/admin release before pickup.</span>
                        ) : null}
                      </div>
                      <div className="summary-row">
                        <span>{order.items?.length ?? 0} item(s)</span>
                        <Link to="/rider/active">
                          <Button size="sm" variant={order.status === 'pending' ? 'secondary' : 'primary'}>
                            {order.status === 'pending' ? 'View Assignment' : 'Open Route'}
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="delivery-card">No deliveries have been assigned to you yet.</Card>
                )}
              </div>
            </Card>

            <Card className="summary-card">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Available Deliveries</span>
                  <h2>Nearby bouquet drops</h2>
                  <p>Accept the next route based on proximity and item count.</p>
                </div>
              </div>
              <div className="history-list">
                {loading ? (
                  <Card className="delivery-card">Loading deliveries...</Card>
                ) : availableDeliveries.length ? (
                  availableDeliveries.map((order, index) => (
                    <Card className="delivery-card" key={order.id}>
                      <div className="summary-row">
                        <div className="section" style={{ gap: '0.2rem' }}>
                          <strong>Order #{order.id.slice(0, 8)}</strong>
                          <p>{order.delivery_address}</p>
                        </div>
                        <span className="badge badge-primary">{1.8 + index * 0.9} km away</span>
                      </div>
                      <div className="summary-row">
                        <span>{order.items?.length ?? 0} item(s)</span>
                        <div className="summary-row">
                          <Button size="sm" onClick={() => acceptDelivery(order.id)}>
                            Accept
                          </Button>
                          <Button size="sm" variant="secondary" disabled>
                            Decline
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="delivery-card">No available deliveries right now.</Card>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
