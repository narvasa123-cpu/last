import { useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TrackingMap } from '../../components/orders/TrackingMap';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useOrderTrackingQuery, useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { STATUS_LABELS } from '../../lib/constants';
import { createDeliveryTrackingPoint, estimateOrderEta, updateOrderStatus } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import { BASE_TRACKING_ROUTE } from '../../lib/trackingRoute';
import type { DeliveryTrackingPoint, Order } from '../../lib/types';
import { cn, formatDateTime } from '../../lib/utils';

const previewRoute = BASE_TRACKING_ROUTE;
type RiderWorkflowStep = {
  key: string;
  title: string;
  description: string;
  actionStatus?: Order['status'];
};

const riderWorkflowSteps: RiderWorkflowStep[] = [
  {
    key: 'assigned',
    title: 'Assigned',
    description: 'Order is on your rider board and waiting for the next dispatch milestone.',
  },
  {
    key: 'picked_up',
    title: 'Picked Up',
    description: 'Confirm when the bouquet is already with you and leaving the shop.',
    actionStatus: 'picked_up',
  },
  {
    key: 'on_the_way',
    title: 'On The Way',
    description: 'Tell the customer the delivery is already moving to the drop-off address.',
    actionStatus: 'on_the_way',
  },
  {
    key: 'delivered',
    title: 'Delivered',
    description: 'Close the route after the customer receives the order successfully.',
    actionStatus: 'delivered',
  },
];

function getWorkflowStage(status: Order['status']) {
  if (status === 'picked_up') return 1;
  if (status === 'on_the_way') return 2;
  if (status === 'delivered') return 3;
  return 0;
}

function getOrderRouteOffset(orderId: string) {
  const seed = Array.from(orderId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const latOffset = ((seed % 7) - 3) * 0.00022;
  const lngOffset = (((seed >> 1) % 7) - 3) * 0.00024;

  return { latOffset, lngOffset };
}

function getPreviewCoordinate(orderId: string, currentPointCount: number) {
  const { latOffset, lngOffset } = getOrderRouteOffset(orderId);
  const nextPoint = previewRoute[Math.min(currentPointCount, previewRoute.length - 1)];

  return {
    latitude: Number((nextPoint.latitude + latOffset).toFixed(6)),
    longitude: Number((nextPoint.longitude + lngOffset).toFixed(6)),
  };
}

function requestCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    window.navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

export function ActiveDelivery() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const [sharingLocation, setSharingLocation] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);
  const riderOrdersQuery = useOrdersForUserQuery(user?.id, 'rider');
  const orders = riderOrdersQuery.data ?? ([] as Order[]);

  const activeOrder = useMemo(() => {
    const orderPriority: Record<Order['status'], number> = {
      on_the_way: 5,
      picked_up: 4,
      preparing: 3,
      confirmed: 2,
      pending: 1,
      delivered: 0,
      cancelled: 0,
    };

    return (
      [...orders]
        .filter((order) => order.rider_id === user?.id && !['delivered', 'cancelled'].includes(order.status))
        .sort((left, right) => {
          const priorityDelta = (orderPriority[right.status] ?? 0) - (orderPriority[left.status] ?? 0);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }

          return right.updated_at.localeCompare(left.updated_at);
        })[0] ?? null
    );
  }, [orders, user?.id]);
  const trackingQuery = useOrderTrackingQuery(activeOrder?.id);
  const trackingPoints = trackingQuery.data ?? ([] as DeliveryTrackingPoint[]);
  const loading = riderOrdersQuery.isLoading || (Boolean(activeOrder?.id) && trackingQuery.isLoading);

  const nextStatus = useMemo(() => {
    if (!activeOrder) return null;
    if (activeOrder.status === 'pending') return null;
    if (activeOrder.status === 'confirmed' || activeOrder.status === 'preparing') return 'picked_up';
    if (activeOrder.status === 'picked_up') return 'on_the_way';
    if (activeOrder.status === 'on_the_way') return 'delivered';
    return null;
  }, [activeOrder]);

  const canShareLocation = Boolean(activeOrder);
  const workflowStage = useMemo(() => (activeOrder ? getWorkflowStage(activeOrder.status) : 0), [activeOrder]);
  const eta = useMemo(
    () => (activeOrder ? estimateOrderEta(activeOrder, trackingPoints) : 'Assigning rider'),
    [activeOrder, trackingPoints],
  );

  const latestTrackingPoint = trackingPoints.length ? trackingPoints[trackingPoints.length - 1] : null;

  useRealtimeQueryInvalidation(
    [
      ...(user
        ? [
            {
              table: 'orders',
              queryKeys: [queryKeys.ordersForUser(user.id, 'rider')],
            },
          ]
        : []),
      ...(activeOrder?.id
        ? [
            {
              table: 'delivery_tracking',
              filter: `order_id=eq.${activeOrder.id}`,
              queryKeys: [queryKeys.orderTracking(activeOrder.id)],
            },
          ]
        : []),
    ],
    true,
  );

  const persistTrackingPoint = (point: DeliveryTrackingPoint) => {
    if (!activeOrder?.id) {
      return;
    }

    queryClient.setQueryData<DeliveryTrackingPoint[]>(
      queryKeys.orderTracking(activeOrder.id),
      (current = []) =>
        [...current.filter((entry) => entry.id !== point.id), point].sort((left, right) =>
        left.created_at.localeCompare(right.created_at),
        ),
    );
  };

  const sendPreviewUpdate = async (statusOverride?: Order['status'], note?: string, silent = false) => {
    if (!activeOrder || !user?.id) return false;

    if (!silent) {
      setSendingPreview(true);
    }

    const previewCoordinate = getPreviewCoordinate(activeOrder.id, trackingPoints.length);
    const { data, error } = await createDeliveryTrackingPoint({
      orderId: activeOrder.id,
      riderId: user.id,
      status: statusOverride ?? activeOrder.status,
      latitude: previewCoordinate.latitude,
      longitude: previewCoordinate.longitude,
      note: note ?? 'Preview route update',
    });

    if (!silent) {
      setSendingPreview(false);
    }

    if (error || !data) {
      if (!silent) {
        showToast('Route update failed', error ?? 'Unable to send a preview route update.');
      }
      return false;
    }

    persistTrackingPoint(data);

    if (!silent) {
      showToast('Preview waypoint sent', `Order #${data.order_id.slice(0, 8)} route progress was updated.`);
    }

    return true;
  };

  const shareCurrentLocation = async () => {
    if (!activeOrder || !user?.id) return;

    setSharingLocation(true);

    try {
      if (!('geolocation' in window.navigator)) {
        throw new Error('Geolocation unavailable');
      }

      const position = await requestCurrentPosition();
      const { data, error } = await createDeliveryTrackingPoint({
        orderId: activeOrder.id,
        riderId: user.id,
        status: activeOrder.status,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        note: 'Live GPS location shared by rider',
      });

      if (error || !data) {
        throw new Error(error ?? 'Unable to save the live GPS update.');
      }

      persistTrackingPoint(data);
      showToast('Location shared', `Live GPS updated for order #${data.order_id.slice(0, 8)}.`);
    } catch {
      const previewSent = await sendPreviewUpdate(
        activeOrder.status,
        'Live GPS unavailable. Preview route update sent instead.',
        true,
      );

      if (previewSent) {
        showToast(
          'Preview waypoint sent',
          'Live GPS was unavailable, so a preview route update was saved instead.',
        );
      } else {
        showToast('Location update failed', 'Unable to send a rider location update.');
      }
    } finally {
      setSharingLocation(false);
    }
  };

  const updateStep = async (targetStatus: Order['status']) => {
    if (!activeOrder || !nextStatus || !user?.id || targetStatus !== nextStatus) return;

    const { data, error } = await updateOrderStatus(activeOrder.id, targetStatus, { riderId: user.id });

    if (error || !data) {
      showToast('Update failed', error ?? 'Unable to update the delivery status.');
      return;
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.ordersForUser(user.id, 'rider'),
      (current = []) => current.map((order) => (order.id === data.id ? data : order)),
    );
    void sendPreviewUpdate(data.status, `Status updated to ${STATUS_LABELS[data.status]}.`, true);
    showToast('Delivery updated', `Order #${data.id.slice(0, 8)} is now ${STATUS_LABELS[data.status]}.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="rider" />
          {loading ? (
            <Card className="summary-card">Loading your active delivery...</Card>
          ) : null}
          {activeOrder ? (
            <Card className="summary-card" style={{ minHeight: '28rem' }}>
              <div className="section" style={{ gap: '0.5rem' }}>
                <span className="eyebrow">Active Delivery</span>
                <h2>{STATUS_LABELS[activeOrder.status]}</h2>
                <p>{activeOrder.delivery_address}</p>
                <p>{activeOrder.notes}</p>
              </div>
              <div className="summary-row">
                <span>{activeOrder.items?.length ?? 0} bouquet item(s)</span>
                <span className="badge badge-success">{activeOrder.status}</span>
              </div>
              {activeOrder.status === 'pending' ? (
                <Card className="glass-card" style={{ padding: '1rem' }}>
                  <p>
                    This order is assigned to you and still waiting for cashier/admin release before pickup. You can
                    already share your standby location below.
                  </p>
                </Card>
              ) : null}

              <Card className="glass-card" style={{ padding: '1rem' }}>
                <div className="section" style={{ gap: '0.35rem' }}>
                  <strong>Delivery Workflow</strong>
                  <p>
                    {activeOrder.status === 'pending'
                      ? 'Cashier or admin still needs to release this order. Once released, the next highlighted card becomes your action.'
                      : nextStatus
                        ? `Tap the highlighted step when you reach ${STATUS_LABELS[nextStatus]}.`
                        : 'No more rider actions are required for this delivery.'}
                  </p>
                </div>

                <div className="rider-status-grid" style={{ marginTop: '1rem' }}>
                  {riderWorkflowSteps.map((step, index) => {
                    const isCurrent = index === workflowStage;
                    const isComplete = index < workflowStage || (index === 0 && activeOrder.status !== 'pending');
                    const isNextAction = step.actionStatus === nextStatus;

                    return (
                      <div
                        key={step.key}
                        className={cn(
                          'rider-status-card',
                          isComplete && 'complete',
                          isCurrent && 'current',
                          isNextAction && 'next',
                          !isComplete && !isCurrent && !isNextAction && 'locked',
                        )}
                      >
                        <div className="summary-row" style={{ alignItems: 'flex-start' }}>
                          <span className={cn('rider-status-marker', isComplete && 'complete')}>
                            {isComplete ? '✓' : index + 1}
                          </span>
                          <span
                            className={cn(
                              'badge',
                              isNextAction
                                ? 'badge-primary'
                                : isComplete
                                  ? 'badge-success'
                                  : isCurrent
                                    ? 'badge-primary'
                                    : 'badge-neutral',
                            )}
                          >
                            {isNextAction ? 'Next' : isComplete ? 'Done' : isCurrent ? 'Current' : 'Locked'}
                          </span>
                        </div>

                        <div className="rider-status-copy">
                          <strong>{step.title}</strong>
                          <p>{step.description}</p>
                        </div>

                        <div className="rider-status-actions">
                          {isNextAction ? (
                            <Button size="sm" onClick={() => void updateStep(step.actionStatus!)} fullWidth>
                              {step.actionStatus === 'picked_up'
                                ? 'Mark as Picked Up'
                                : step.actionStatus === 'on_the_way'
                                  ? 'Mark as On The Way'
                                  : 'Mark as Delivered'}
                            </Button>
                          ) : isCurrent ? (
                            <span className="muted">
                              {activeOrder.status === 'pending' && step.key === 'assigned'
                                ? 'Waiting for release'
                                : 'Current stage'}
                            </span>
                          ) : isComplete ? (
                            <span className="muted">Completed</span>
                          ) : (
                            <span className="muted">Available after the current step</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <TrackingMap
                orderId={activeOrder.id}
                rider={profile}
                customer={activeOrder.customer}
                deliveryAddress={activeOrder.delivery_address}
                eta={eta}
                orderStatus={activeOrder.status}
                trackingPoints={trackingPoints}
                variant="rider"
              />

              <Card className="glass-card" style={{ padding: '1rem' }}>
                <div className="section" style={{ gap: '0.35rem' }}>
                  <strong>Location Sharing</strong>
                  <p>
                    {latestTrackingPoint
                      ? `Last route signal at ${formatDateTime(latestTrackingPoint.created_at)}.`
                      : 'No route signal shared yet for this order.'}
                  </p>
                  {latestTrackingPoint?.latitude && latestTrackingPoint?.longitude ? (
                    <p>
                      {latestTrackingPoint.latitude.toFixed(4)}, {latestTrackingPoint.longitude.toFixed(4)}
                    </p>
                  ) : null}
                </div>
                <div className="action-row action-row-dual" style={{ marginTop: '1rem' }}>
                  <Button
                    variant="secondary"
                    onClick={() => void sendPreviewUpdate(activeOrder.status, 'Manual preview route update')}
                    disabled={sendingPreview || sharingLocation || !canShareLocation}
                  >
                    {sendingPreview ? 'Sending Preview...' : 'Send Preview Update'}
                  </Button>
                  <Button onClick={shareCurrentLocation} disabled={sharingLocation || sendingPreview || !canShareLocation}>
                    {sharingLocation ? 'Sharing GPS...' : 'Use Current Location'}
                  </Button>
                </div>
              </Card>
            </Card>
          ) : !loading ? (
            <Card className="empty-state">
              <h3>No active delivery right now.</h3>
              <p>Accept a nearby order from the dashboard to begin a route.</p>
            </Card>
          ) : null}
        </div>
      </div>
    </PageWrapper>
  );
}
