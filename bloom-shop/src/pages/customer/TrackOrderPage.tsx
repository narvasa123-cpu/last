import { Star, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { OrderTimeline } from '../../components/orders/OrderTimeline';
import { TrackingMap } from '../../components/orders/TrackingMap';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { useTrackOrderQueries } from '../../hooks/useAppQueries';
import { createReview } from '../../lib/data';
import { cancelCustomerOrder, estimateOrderEta } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { OrderItem, OrderStatus } from '../../lib/types';
import { formatDateTime, formatPrice } from '../../lib/utils';

interface ReviewDraft {
  rating: number;
  comment: string;
  submitted?: boolean;
}

function getReviewProductId(item: OrderItem) {
  return item.product_id ?? item.product?.id ?? null;
}

export function TrackOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const { showToast } = useNotifications();
  const { order, history, trackingPoints, isLoading } = useTrackOrderQueries(id);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [cancelling, setCancelling] = useState(false);

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

  const handleCancelOrder = async () => {
    if (!order || !user?.id) return;
    setCancelling(true);
    const result = await cancelCustomerOrder(order.id, user.id);
    setCancelling(false);

    if (result.error) {
      showToast('Unable to cancel', result.error);
      return;
    }

    showToast('Order cancelled', `Order #${order.id.slice(0, 8)} has been cancelled.`);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.ordersForUser(user.id, role) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.orderStatusHistory(order.id) }),
    ]);
  };

  const handleSubmitReview = async (item: OrderItem) => {
    const productId = getReviewProductId(item);
    const draft = productId ? reviewDrafts[productId] : null;
    if (!productId || !user?.id || !draft?.rating) {
      showToast('Rating required', 'Choose a star rating before submitting.');
      return;
    }

    const result = await createReview({
      product_id: productId,
      user_id: user.id,
      rating: draft.rating,
      comment: draft.comment.trim(),
      user: order?.customer
        ? { full_name: order.customer.full_name, avatar_url: order.customer.avatar_url }
        : undefined,
    });

    if (result.error) {
      showToast('Review not saved', result.error.message ?? 'Please try again.');
      return;
    }

    setReviewDrafts((current) => ({
      ...current,
      [productId]: { ...draft, submitted: true },
    }));
    showToast('Review posted', 'Thanks for helping other flower lovers choose.');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products }),
      queryClient.invalidateQueries({ queryKey: queryKeys.product(productId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.productReviews(productId) }),
    ]);
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="page-shell">
          <Skeleton style={{ minHeight: '12rem' }} />
          <div className="tracking-layout">
            <Skeleton style={{ minHeight: '20rem' }} />
            <Skeleton style={{ minHeight: '20rem' }} />
          </div>
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
            <div className="action-row">
              {['pending', 'confirmed'].includes(order.status) ? (
                <Button variant="secondary" onClick={handleCancelOrder} disabled={cancelling}>
                  <XCircle size={18} />
                  {cancelling ? 'Cancelling...' : 'Cancel Order'}
                </Button>
              ) : null}
              <span className="badge badge-success">ETA {eta}</span>
            </div>
          </div>
        </section>

        <section className="tracking-layout">
          <OrderTimeline currentStatus={order.status} timeline={timeline} />
          {order.status === 'on_the_way' || order.status === 'delivered' ? (
            <TrackingMap
              orderId={order.id}
              rider={order.rider}
              customer={order.customer}
              deliveryAddress={order.delivery_address}
              eta={eta}
              orderStatus={order.status}
              trackingPoints={trackingPoints}
            />
          ) : (
            <Card className="map-card">
              <strong>Live Tracking Map</strong>
              <p>The live rider map appears once your bouquet is on the way.</p>
            </Card>
          )}
        </section>

        <section className="cart-layout">
          <Card className="summary-card">
            <div className="section" style={{ gap: '0.35rem' }}>
              <span className="eyebrow">Order Details</span>
              <h2>Items and delivery</h2>
              <p>{order.delivery_address}</p>
            </div>
            <div className="section">
              {(order.items ?? []).map((item) => (
                <Card className="summary-card" style={{ padding: '1rem' }} key={item.id}>
                  <div className="summary-row">
                    <div className="section" style={{ gap: '0.2rem' }}>
                      <strong>{item.product?.name ?? 'Custom bouquet'}</strong>
                      <span className="muted">
                        {item.quantity} × {formatPrice(item.unit_price)}
                      </span>
                    </div>
                    <strong>{formatPrice(item.subtotal)}</strong>
                  </div>
                  {item.custom_bouquet ? (
                    <div className="glass-card">
                      <strong>Custom bouquet specs</strong>
                      <p>
                        {item.custom_bouquet.sizeLabel}, {item.custom_bouquet.wrapperLabel} wrap,
                        {' '}{item.custom_bouquet.ribbonLabel} ribbon
                      </p>
                      <p>
                        Flowers: {item.custom_bouquet.flowers
                          .map((flower) => `${flower.quantity} ${flower.color} ${flower.name}`)
                          .join(', ')}
                      </p>
                      {item.custom_bouquet.addOns.length ? (
                        <p>Add-ons: {item.custom_bouquet.addOns.map((addOn) => addOn.label).join(', ')}</p>
                      ) : null}
                      {item.custom_bouquet.message ? <p>Message: {item.custom_bouquet.message}</p> : null}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
            <div className="section">
              <div className="summary-row">
                <span>Delivery Fee</span>
                <strong>{formatPrice(order.delivery_fee)}</strong>
              </div>
              <div className="summary-row">
                <span>Discount</span>
                <strong>-{formatPrice(order.discount_amount)}</strong>
              </div>
              <div className="summary-row">
                <span>Total</span>
                <strong className="price">{formatPrice(order.total_amount)}</strong>
              </div>
            </div>
          </Card>

          {order.status === 'delivered' ? (
            <Card className="summary-card">
              <div className="section" style={{ gap: '0.35rem' }}>
                <span className="eyebrow">Reviews</span>
                <h2>Rate your flowers</h2>
                <p>Leave a star rating and review for each product in this delivery.</p>
              </div>
              <div className="section">
                {(order.items ?? []).filter(getReviewProductId).map((item) => {
                  const productId = getReviewProductId(item)!;
                  const draft = reviewDrafts[productId] ?? { rating: 0, comment: '' };
                  return (
                    <Card className="summary-card" style={{ padding: '1rem' }} key={`review-${item.id}`}>
                      <strong>{item.product?.name ?? 'Custom bouquet'}</strong>
                      <div className="action-row">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            className="icon-button"
                            key={rating}
                            type="button"
                            onClick={() =>
                              setReviewDrafts((current) => ({
                                ...current,
                                [productId]: { ...draft, rating },
                              }))
                            }
                            aria-label={`${rating} stars`}
                          >
                            <Star
                              size={18}
                              fill={rating <= draft.rating ? 'var(--bloom-rose)' : 'transparent'}
                              color="var(--bloom-rose)"
                            />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        label="Review"
                        value={draft.comment}
                        onChange={(event) =>
                          setReviewDrafts((current) => ({
                            ...current,
                            [productId]: { ...draft, comment: event.target.value },
                          }))
                        }
                      />
                      <Button onClick={() => handleSubmitReview(item)} disabled={draft.submitted}>
                        {draft.submitted ? 'Review Submitted' : 'Submit Review'}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </section>
      </div>
    </PageWrapper>
  );
}
