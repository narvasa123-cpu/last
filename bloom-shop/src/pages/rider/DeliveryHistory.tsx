import { useMemo } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { STATUS_LABELS } from '../../lib/constants';
import { queryKeys } from '../../lib/queryClient';
import { formatDateTime } from '../../lib/utils';

export function DeliveryHistory() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useOrdersForUserQuery(user?.id, 'rider');

  useRealtimeQueryInvalidation(
    user
      ? [
          {
            table: 'orders',
            queryKeys: [queryKeys.ordersForUser(user.id, 'rider')],
          },
        ]
      : [],
    Boolean(user),
  );

  const history = useMemo(
    () => orders.filter((order) => order.rider_id === user?.id && ['delivered', 'cancelled'].includes(order.status)),
    [orders, user?.id],
  );

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="rider" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Delivery History</span>
                <h2>Completed and archived routes</h2>
                <p>Review where you delivered and how each route concluded.</p>
              </div>
            </div>
            <div className="history-list">
              {isLoading ? (
                <>
                  <Skeleton style={{ minHeight: '6rem' }} />
                  <Skeleton style={{ minHeight: '6rem' }} />
                  <Skeleton style={{ minHeight: '6rem' }} />
                </>
              ) : history.length ? (
                history.map((order) => (
                  <Card className="history-card" key={order.id}>
                    <div className="summary-row">
                      <strong>Order #{order.id.slice(0, 8)}</strong>
                      <span className="badge badge-success">{STATUS_LABELS[order.status]}</span>
                    </div>
                    <p>{order.delivery_address}</p>
                    <p>{formatDateTime(order.updated_at)}</p>
                  </Card>
                ))
              ) : (
                <Card className="history-card">No completed rider routes yet.</Card>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
