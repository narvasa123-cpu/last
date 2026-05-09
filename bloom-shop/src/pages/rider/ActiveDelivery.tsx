import { useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { TrackingMap } from '../../components/orders/TrackingMap';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useOrderTrackingQuery, useOrdersForUserQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { STATUS_LABELS } from '../../lib/constants';
import {
  createDeliveryPhoto,
  createDeliveryTrackingPoint,
  estimateOrderEta,
  reportDeliveryIssue,
  updateOrderStatus,
  uploadDeliveryProofImage,
} from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import { BASE_TRACKING_ROUTE } from '../../lib/trackingRoute';
import type { DeliveryIssueReason, DeliveryTrackingPoint, Order } from '../../lib/types';
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

const issueOptions: Array<{ value: DeliveryIssueReason; label: string }> = [
  { value: 'wrong_address', label: 'Wrong address' },
  { value: 'customer_unreachable', label: 'Customer unreachable' },
  { value: 'damaged_bouquet', label: 'Damaged bouquet' },
  { value: 'other', label: 'Other' },
];

type QueuedStatusUpdate = {
  orderId: string;
  riderId: string;
  targetStatus: Order['status'];
  proofImageUrl?: string | null;
  createdAt: string;
};

function getActiveDeliveryCacheKey(riderId?: string | null) {
  return `bloom-shop:rider-active-delivery:${riderId ?? 'guest'}`;
}

function getPendingStatusQueueKey(riderId?: string | null) {
  return `bloom-shop:rider-pending-status-updates:${riderId ?? 'guest'}`;
}

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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueReason, setIssueReason] = useState<DeliveryIssueReason>('wrong_address');
  const [issueNotes, setIssueNotes] = useState('');
  const [cachedOrder, setCachedOrder] = useState<Order | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
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
  const displayOrder = activeOrder ?? cachedOrder;
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

  useEffect(() => {
    if (!user?.id) return;

    const cached = window.localStorage.getItem(getActiveDeliveryCacheKey(user.id));
    if (cached) {
      try {
        setCachedOrder(JSON.parse(cached) as Order);
      } catch {
        window.localStorage.removeItem(getActiveDeliveryCacheKey(user.id));
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !activeOrder) return;
    window.localStorage.setItem(getActiveDeliveryCacheKey(user.id), JSON.stringify(activeOrder));
    setCachedOrder(activeOrder);
  }, [activeOrder, user?.id]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const readPendingStatusQueue = (): QueuedStatusUpdate[] => {
    if (!user?.id) return [];
    const raw = window.localStorage.getItem(getPendingStatusQueueKey(user.id));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as QueuedStatusUpdate[];
    } catch {
      window.localStorage.removeItem(getPendingStatusQueueKey(user.id));
      return [];
    }
  };

  const writePendingStatusQueue = (queue: QueuedStatusUpdate[]) => {
    if (!user?.id) return;
    window.localStorage.setItem(getPendingStatusQueueKey(user.id), JSON.stringify(queue));
  };

  useEffect(() => {
    if (!isOnline || !user?.id) return;

    const syncPendingUpdates = async () => {
      const queue = readPendingStatusQueue();
      if (!queue.length) return;

      const remaining: QueuedStatusUpdate[] = [];
      for (const update of queue) {
        const { data, error } = await updateOrderStatus(update.orderId, update.targetStatus, {
          riderId: update.riderId,
          note: 'Synced after rider came back online.',
        });

        if (error || !data) {
          remaining.push(update);
          continue;
        }

        if (update.targetStatus === 'delivered' && update.proofImageUrl) {
          await createDeliveryPhoto({
            orderId: update.orderId,
            riderId: update.riderId,
            imageUrl: update.proofImageUrl,
          });
        }

        queryClient.setQueryData<Order[]>(
          queryKeys.ordersForUser(user.id, 'rider'),
          (current = []) => current.map((order) => (order.id === data.id ? data : order)),
        );
      }

      writePendingStatusQueue(remaining);
      if (remaining.length !== queue.length) {
        void riderOrdersQuery.refetch();
        showToast('Offline updates synced', 'Queued rider status updates were sent to Bloom Shop.');
      }
    };

    void syncPendingUpdates();
  }, [isOnline, user?.id]);

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

  const queueStatusUpdate = async (targetStatus: Order['status'], proofImageUrl?: string | null) => {
    if (!activeOrder || !user?.id) return;

    writePendingStatusQueue([
      ...readPendingStatusQueue(),
      {
        orderId: activeOrder.id,
        riderId: user.id,
        targetStatus,
        proofImageUrl: proofImageUrl ?? null,
        createdAt: new Date().toISOString(),
      },
    ]);
    showToast('Saved offline', `Order #${activeOrder.id.slice(0, 8)} will sync when your signal returns.`);
  };

  const updateStep = async (targetStatus: Order['status']) => {
    if (!activeOrder || !nextStatus || !user?.id || targetStatus !== nextStatus) return;

    let proofImageUrl: string | null = null;
    if (targetStatus === 'delivered') {
      if (!proofFile) {
        showToast('Proof photo required', 'Upload a photo of the delivered bouquet before closing the route.');
        return;
      }
      proofImageUrl = proofPreview;
      if (!proofImageUrl && !isOnline) {
        showToast('Photo unavailable', 'Select the proof photo again before saving this offline.');
        return;
      }
    }

    if (!isOnline) {
      await queueStatusUpdate(targetStatus, proofImageUrl);
      return;
    }

    setDelivering(targetStatus === 'delivered');
    if (targetStatus === 'delivered' && proofFile) {
      const upload = await uploadDeliveryProofImage(proofFile, activeOrder.id);
      if (upload.error || !upload.data) {
        setDelivering(false);
        const proceedWithoutPhoto = window.confirm(
          `Photo upload failed: ${upload.error ?? 'Unable to upload the proof photo.'}\n\nDo you want to mark this order as delivered without a photo?`,
        );
        if (!proceedWithoutPhoto) {
          return;
        }
        proofImageUrl = null;
      } else {
        proofImageUrl = upload.data;
      }
    }

    const { data, error } = await updateOrderStatus(activeOrder.id, targetStatus, { riderId: user.id });
    setDelivering(false);

    if (error || !data) {
      showToast('Update failed', error ?? 'Unable to update the delivery status.');
      return;
    }

    if (targetStatus === 'delivered' && proofImageUrl) {
      const photo = await createDeliveryPhoto({
        orderId: activeOrder.id,
        riderId: user.id,
        imageUrl: proofImageUrl,
      });

      if (photo.error) {
        showToast('Proof saved later', photo.error);
      }
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.ordersForUser(user.id, 'rider'),
      (current = []) => current.map((order) => (order.id === data.id ? data : order)),
    );
    void sendPreviewUpdate(data.status, `Status updated to ${STATUS_LABELS[data.status]}.`, true);
    showToast('Delivery updated', `Order #${data.id.slice(0, 8)} is now ${STATUS_LABELS[data.status]}.`);
  };

  const handleProofFileChange = (file?: File | null) => {
    setProofFile(file ?? null);
    if (!file) {
      setProofPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        setProofPreview(reader.result);
      }
    });
    reader.readAsDataURL(file);
  };

  const copyAddress = async () => {
    if (!displayOrder?.delivery_address) return;
    try {
      await navigator.clipboard.writeText(displayOrder.delivery_address);
      showToast('Address copied', 'Delivery address is ready to paste into maps or messages.');
    } catch {
      showToast('Copy unavailable', 'Select and copy the address manually from the customer details card.');
    }
  };

  const submitIssueReport = async () => {
    if (!activeOrder || !user?.id) return;

    const { data, error } = await reportDeliveryIssue({
      orderId: activeOrder.id,
      riderId: user.id,
      reason: issueReason,
      notes: issueNotes,
    });

    if (error || !data) {
      showToast('Issue not sent', error ?? 'Unable to report this delivery issue.');
      return;
    }

    setIssueModalOpen(false);
    setIssueNotes('');
    setIssueReason('wrong_address');
    showToast('Issue reported', 'Admin has been notified about this delivery.');
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="rider" />
          {loading ? (
            <Card className="summary-card">
              <Skeleton style={{ minHeight: '10rem' }} />
              <div className="rider-status-grid" style={{ marginTop: '1rem' }}>
                <Skeleton style={{ minHeight: '6rem' }} />
                <Skeleton style={{ minHeight: '6rem' }} />
                <Skeleton style={{ minHeight: '6rem' }} />
                <Skeleton style={{ minHeight: '6rem' }} />
              </div>
            </Card>
          ) : null}
          {displayOrder ? (
            <Card className="summary-card" style={{ minHeight: '28rem' }}>
              <div className="section" style={{ gap: '0.5rem' }}>
                <span className="eyebrow">Active Delivery</span>
                <h2>{STATUS_LABELS[displayOrder.status]}</h2>
                <p>{displayOrder.delivery_address}</p>
                <p>{displayOrder.notes}</p>
              </div>
              <div className="summary-row">
                <span>{displayOrder.items?.length ?? 0} bouquet item(s)</span>
                <span className="badge badge-success">{displayOrder.status}</span>
              </div>
              {!isOnline ? (
                <Card className="glass-card" style={{ padding: '1rem' }}>
                  <strong>Offline mode</strong>
                  <p>Address, phone, and delivery notes are cached. Status updates will sync when you are online.</p>
                </Card>
              ) : null}
              {displayOrder.status === 'pending' ? (
                <Card className="glass-card" style={{ padding: '1rem' }}>
                  <p>
                    This order is assigned to you and still waiting for cashier/admin release before pickup. You can
                    already share your standby location below.
                  </p>
                </Card>
              ) : null}

              <Card className="glass-card" style={{ padding: '1rem' }}>
                <div className="section" style={{ gap: '0.5rem' }}>
                  <strong>Customer Details</strong>
                  <div className="summary-list">
                    <div className="summary-row">
                      <span>Customer</span>
                      <strong>{displayOrder.customer?.full_name ?? 'Bloom customer'}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Phone</span>
                      {displayOrder.customer?.phone ? (
                        <a href={`tel:${displayOrder.customer.phone}`}>{displayOrder.customer.phone}</a>
                      ) : (
                        <strong>Not provided</strong>
                      )}
                    </div>
                    <div className="summary-row" style={{ alignItems: 'flex-start' }}>
                      <span>Address</span>
                      <strong>{displayOrder.delivery_address || 'TBD'}</strong>
                    </div>
                    <div className="summary-row" style={{ alignItems: 'flex-start' }}>
                      <span>Notes</span>
                      <strong>{displayOrder.notes || 'No delivery notes'}</strong>
                    </div>
                  </div>
                  <div className="action-row action-row-dual">
                    <Button variant="secondary" onClick={copyAddress}>Copy Address</Button>
                    <Button variant="secondary" disabled={!activeOrder} onClick={() => setIssueModalOpen(true)}>
                      Report Issue
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="glass-card" style={{ padding: '1rem' }}>
                <div className="section" style={{ gap: '0.35rem' }}>
                  <strong>Delivery Workflow</strong>
                  <p>
                    {displayOrder.status === 'pending'
                      ? 'Cashier or admin still needs to release this order. Once released, the next highlighted card becomes your action.'
                      : nextStatus
                        ? `Tap the highlighted step when you reach ${STATUS_LABELS[nextStatus]}.`
                        : 'No more rider actions are required for this delivery.'}
                  </p>
                </div>

                <div className="rider-status-grid" style={{ marginTop: '1rem' }}>
                  {riderWorkflowSteps.map((step, index) => {
                    const isCurrent = index === workflowStage;
                    const isComplete = index < workflowStage || (index === 0 && displayOrder.status !== 'pending');
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
                            <Button
                              size="sm"
                              onClick={() => void updateStep(step.actionStatus!)}
                              disabled={delivering}
                              fullWidth
                            >
                              {step.actionStatus === 'picked_up'
                                ? 'Mark as Picked Up'
                                : step.actionStatus === 'on_the_way'
                                  ? 'Mark as On The Way'
                                  : delivering
                                    ? 'Uploading Proof...'
                                    : 'Mark as Delivered'}
                            </Button>
                          ) : isCurrent ? (
                            <span className="muted">
                              {displayOrder.status === 'pending' && step.key === 'assigned'
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
                {nextStatus === 'delivered' ? (
                  <Card className="glass-card" style={{ marginTop: '1rem', padding: '1rem' }}>
                    <div className="section" style={{ gap: '0.5rem' }}>
                      <strong>Proof of Delivery</strong>
                      <p>Upload a clear photo of the delivered bouquet before closing this route.</p>
                      <input
                        aria-label="Proof of delivery photo"
                        accept="image/*"
                        type="file"
                        onChange={(event) => handleProofFileChange(event.target.files?.[0])}
                      />
                      {proofPreview ? (
                        <img
                          src={proofPreview}
                          alt="Proof of delivered bouquet preview"
                          style={{ borderRadius: '0.5rem', maxHeight: '14rem', objectFit: 'cover', width: '100%' }}
                        />
                      ) : null}
                    </div>
                  </Card>
                ) : null}
              </Card>

              <TrackingMap
                orderId={displayOrder.id}
                rider={profile}
                customer={displayOrder.customer}
                deliveryAddress={displayOrder.delivery_address}
                eta={eta}
                orderStatus={displayOrder.status}
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
                    onClick={() => void sendPreviewUpdate(displayOrder.status, 'Manual preview route update')}
                    disabled={sendingPreview || sharingLocation || !canShareLocation || !isOnline}
                  >
                    {sendingPreview ? 'Sending Preview...' : 'Send Preview Update'}
                  </Button>
                  <Button onClick={shareCurrentLocation} disabled={sharingLocation || sendingPreview || !canShareLocation || !isOnline}>
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
      <Modal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title="Report Delivery Issue"
        description="Send admin a delivery exception with the route context attached."
      >
        <div className="section">
          <div className="select-shell">
            <select value={issueReason} onChange={(event) => setIssueReason(event.target.value as DeliveryIssueReason)}>
              {issueOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <Textarea
            label="Optional notes"
            value={issueNotes}
            onChange={(event) => setIssueNotes(event.target.value)}
            placeholder="Add context for admin..."
          />
          <div className="summary-row">
            <Button variant="secondary" onClick={() => setIssueModalOpen(false)}>Close</Button>
            <Button onClick={submitIssueReport}>Send Report</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
