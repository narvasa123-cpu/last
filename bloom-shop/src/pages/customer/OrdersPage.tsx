import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { OrderCard } from '../../components/orders/OrderCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { queryKeys } from '../../lib/queryClient';

export function OrdersPage() {
  const { user, role } = useAuth();
  const { data: orders = [], isLoading } = useOrdersForUserQuery(user?.id, role);

  const realtimeConfigs = useMemo(
    () =>
      user
        ? [
            {
              table: 'orders',
              filter: `customer_id=eq.${user.id}`,
              queryKeys: [queryKeys.ordersForUser(user.id, role)],
            },
          ]
        : [],
    [role, user],
  );

  useRealtimeQueryInvalidation(realtimeConfigs, Boolean(user));

  const activeOrder = useMemo(
    () => orders.find((order) => !['delivered', 'cancelled'].includes(order.status)),
    [orders],
  );

  return (
    <PageWrapper>
      <div className="page-shell">
        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Orders</span>
              <h2>Track current and past deliveries.</h2>
              <p>Follow progress, see payment state, and revisit bouquet details for each order.</p>
            </div>
            {activeOrder ? (
              <Link to={`/customer/orders/${activeOrder.id}`}>
                <Button>
                  Track Active Order
                  <ArrowRight size={18} />
                </Button>
              </Link>
            ) : null}
          </div>
        </section>

        {activeOrder ? (
          <Card className="summary-card">
            <div className="summary-row">
              <div className="section" style={{ gap: '0.25rem' }}>
                <strong>Active Delivery</strong>
                <p>Order #{activeOrder.id.slice(0, 8)} is currently {activeOrder.status.replace(/_/g, ' ')}.</p>
              </div>
              <span className="badge badge-success">{activeOrder.status}</span>
            </div>
          </Card>
        ) : null}

        <div className="order-list">
          {isLoading ? (
            <Card className="summary-card">Loading orders...</Card>
          ) : (
            orders.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
