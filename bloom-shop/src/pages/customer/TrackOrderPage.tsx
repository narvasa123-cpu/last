import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { OrderTimeline } from '../../components/orders/OrderTimeline';
import { TrackingMap } from '../../components/orders/TrackingMap';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { useTrackOrderQueries } from '../../hooks/useAppQueries';
import { estimateOrderEta } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { OrderStatus } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';

export function TrackOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { order, history, trackingPoints, isLoading } = useTrackOrderQueries(id);

  const realtimeConfigs = useMemo(
    () =>
      id
        ? [
            {
              table: 'orders',
              filter: `id=eq.${id}`,
              queryKeys: [queryKeys.order(id)],
            },
            {
              table: 'order_status_history',
              filter: `order_id=eq.${id}`,
              queryKeys: [queryKeys.orderStatusHistory(id)],
            },
            {
              table: 'delivery_tracking',
              filter: `order_id=eq.${id}`,
              queryKeys: [queryKeys.orderTracking(id)],
            },
          ]
        : [],
    [id],
  );

  useRealtimeQueryInvalidation(realtimeConfigs, Boolean(id && user));

  const timeline = useMemo(() => {
    if (!order) return [];
    if (history.length) return history;

    const base = new Date(order.created_at).getTime();
    const statuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered'];
    const currentIndex = statuses.indexOf(order.status);
    return statuses
      .slice(0, currentIndex + 1)
      .map((status, index) => ({
        status,
        timestamp: new Date(base + index * 45 * 60 * 1000).toISOString(),
      }));
  }, [history, order]);

  const eta = useMemo(() => {
    if (!order) {
      return '24 min';
    }

    return estimateOrderEta(order, trackingPoints);
  }, [order, trackingPoints]);

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="page-shell">
          <Card className="summary-card">Loading order tracking...</Card>
        </div>
      </PageWrapper>
    );
  }

  if (!order || (role === 'customer' && order.customer_id !== user?.id)) {
    return (
      <PageWrapper>
        <div className="page-shell">
          <Card className="empty-state">
            <h3>Order not found</h3>
            <p>The requested order may no longer be available in your account.</p>
            <Button onClick={() => navigate('/customer/orders')}>Back to Orders</Button>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="page-shell">
        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Track Order</span>
              <h2>Order #{order.id.slice(0, 8)}</h2>
              <p>Latest update: {formatDateTime(order.updated_at)}.</p>
            </div>
            <span className="badge badge-success">ETA {eta}</span>
          </div>
        </section>

        <section className="tracking-layout">
          <OrderTimeline currentStatus={order.status} timeline={timeline} />
          <TrackingMap
            orderId={order.id}
            rider={order.rider}
            customer={order.customer}
            deliveryAddress={order.delivery_address}
            eta={eta}
            orderStatus={order.status}
            trackingPoints={trackingPoints}
          />
        </section>
      </div>
    </PageWrapper>
  );
}
