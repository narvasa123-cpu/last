import { useMemo } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { queryKeys } from '../../lib/queryClient';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import type { Order } from '../../lib/types';
import { formatDateTime, formatPrice } from '../../lib/utils';

const DELIVERY_RATE = 50;

function isSameDay(value: string, date: Date) {
  const target = new Date(value);
  return target.toDateString() === date.toDateString();
}

function isWithinWeek(value: string, date: Date) {
  const target = new Date(value).getTime();
  const end = date.getTime();
  const start = end - 7 * 24 * 60 * 60 * 1000;
  return target >= start && target <= end;
}

function getDeliveryMinutes(order: Order) {
  const pickedUpAt = order.status_history?.find((entry) => entry.next_status === 'picked_up')?.created_at;
  const deliveredAt = order.status_history?.find((entry) => entry.next_status === 'delivered')?.created_at ?? order.updated_at;
  const start = new Date(pickedUpAt ?? order.created_at).getTime();
  const end = new Date(deliveredAt).getTime();
  return Math.max(1, Math.round((end - start) / 60000));
}

export function EarningsDashboard() {
  const { user } = useAuth();
  const ordersQuery = useOrdersForUserQuery(user?.id, 'rider');
  const orders = ordersQuery.data ?? [];
  const today = new Date();

  useRealtimeQueryInvalidation(
    user
      ? [
          {
            table: 'orders',
            queryKeys: [queryKeys.ordersForUser(user.id, 'rider')],
          },
        ]
      : [],
    true,
  );

  const completed = useMemo(
    () => orders.filter((order) => order.rider_id === user?.id && order.status === 'delivered'),
    [orders, user?.id],
  );
  const todayDrops = completed.filter((order) => isSameDay(order.updated_at, today));
  const weekDrops = completed.filter((order) => isWithinWeek(order.updated_at, today));
  const averageMinutes = completed.length
    ? Math.round(completed.reduce((sum, order) => sum + getDeliveryMinutes(order), 0) / completed.length)
    : 0;

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="rider" />
          <div className="section">
            <section className="kpi-grid">
              <Card className="stat-card">
                <p>Today</p>
                <h3>{formatPrice(todayDrops.length * DELIVERY_RATE)}</h3>
                <span className="success">{todayDrops.length} drop(s)</span>
              </Card>
              <Card className="stat-card">
                <p>Last 7 Days</p>
                <h3>{formatPrice(weekDrops.length * DELIVERY_RATE)}</h3>
                <span className="rose">{weekDrops.length} completed</span>
              </Card>
              <Card className="stat-card">
                <p>Avg Delivery Time</p>
                <h3>{averageMinutes ? `${averageMinutes}m` : 'TBD'}</h3>
                <span className="muted">Based on completed drops</span>
              </Card>
            </section>

            <Card className="summary-card">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Earnings</span>
                  <h2>Completed delivery payouts</h2>
                  <p>Mock payout rate: {formatPrice(DELIVERY_RATE)} per delivered order.</p>
                </div>
              </div>
              <div className="history-list">
                {ordersQuery.isLoading ? (
                  <>
                    <Skeleton style={{ minHeight: '7rem' }} />
                    <Skeleton style={{ minHeight: '7rem' }} />
                  </>
                ) : completed.length ? (
                  completed.map((order) => (
                    <Card className="delivery-card" key={order.id}>
                      <div className="summary-row">
                        <div className="section" style={{ gap: '0.2rem' }}>
                          <strong>Order #{order.id.slice(0, 8)}</strong>
                          <p>{order.delivery_address}</p>
                        </div>
                        <strong className="price">{formatPrice(DELIVERY_RATE)}</strong>
                      </div>
                      <div className="summary-row">
                        <span className="muted">Delivered {formatDateTime(order.updated_at)}</span>
                        <span>{getDeliveryMinutes(order)} min</span>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="delivery-card">No completed deliveries are ready for payout yet.</Card>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
