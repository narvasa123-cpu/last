import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { OrderCard } from '../../components/orders/OrderCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { queryKeys } from '../../lib/queryClient';
import type { Order, OrderItem, Product } from '../../lib/types';

type HistoryFilter = 'all' | 'active' | 'delivered' | 'cancelled';

function productFromOrderItem(item: OrderItem): Product | null {
  if (item.product) return item.product;
  if (!item.custom_bouquet) return null;
  return {
    id: item.custom_bouquet.id,
    name: item.custom_bouquet.sizeLabel
      ? `Custom ${item.custom_bouquet.sizeLabel} Bouquet`
      : 'Custom Bouquet',
    description: 'Your saved custom bouquet arrangement.',
    category: 'mixed',
    price: item.unit_price,
    image_url: item.custom_bouquet.flowers[0]?.image_url ?? '/petals/petal-1.svg',
    stock: 999,
    is_featured: false,
    avg_rating: 5,
    review_count: 0,
    custom_bouquet: item.custom_bouquet,
  };
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { addItem, toggleDrawer } = useCart();
  const { showToast } = useNotifications();
  const { data: orders = [], isLoading } = useOrdersForUserQuery(user?.id, role);
  const [search, setSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const realtimeConfigs = useMemo(
    () =>
      user
        ? [
            {
              table: 'orders',
              filter: `customer_id=eq.${user.id}`,
              queryKeys: [queryKeys.ordersForUser(user.id, role)],
            },
            {
              table: 'delivery_photos',
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

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (historyFilter === 'active') return !['delivered', 'cancelled'].includes(order.status);
        if (historyFilter === 'delivered') return order.status === 'delivered';
        if (historyFilter === 'cancelled') return order.status === 'cancelled';
        return true;
      })
      .filter((order) => {
        if (!needle) return true;
        return order.id.toLowerCase().includes(needle) || `#${order.id.slice(0, 8)}`.toLowerCase().includes(needle);
      });
  }, [historyFilter, orders, search]);

  const handleReorder = (order: Order) => {
    const lines = order.items ?? [];
    const added = lines.reduce((count, item) => {
      const product = productFromOrderItem(item);
      if (!product) return count;
      addItem(product, item.quantity);
      return count + item.quantity;
    }, 0);

    if (!added) {
      showToast('Re-order unavailable', 'This order has no cart-ready items.');
      return;
    }

    showToast('Re-order added', `${added} item(s) copied into your cart.`);
    toggleDrawer(true);
    navigate('/customer/cart');
  };

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

        <Card className="summary-card">
          <div className="search-row">
            <Input
              aria-label="Search order ID"
              placeholder="Search by order ID"
              icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="time-slot-grid">
              {(['all', 'active', 'delivered', 'cancelled'] as HistoryFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={historyFilter === filter ? 'payment-card active' : 'payment-card'}
                  onClick={() => setHistoryFilter(filter)}
                >
                  {filter[0].toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="order-list">
          {isLoading ? (
            <>
              <Skeleton style={{ minHeight: '8rem' }} />
              <Skeleton style={{ minHeight: '8rem' }} />
              <Skeleton style={{ minHeight: '8rem' }} />
            </>
          ) : (
            filteredOrders.map((order) => (
              <div className="section" key={order.id}>
                <OrderCard order={order} />
                <Button variant="secondary" onClick={() => handleReorder(order)}>
                  <RotateCcw size={18} />
                  Re-order
                </Button>
              </div>
            ))
          )}
          {!isLoading && !filteredOrders.length ? (
            <Card className="empty-state">
              <h3>No orders found</h3>
              <p>Try another order ID or status filter.</p>
            </Card>
          ) : null}
        </div>
      </div>
    </PageWrapper>
  );
}
