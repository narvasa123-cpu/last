import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useAdminUsersQuery, useFailedPaymentsQuery, usePendingPaymentsQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { assignDeliveryRider, updateFailedPaymentOrder, verifyOrderPayment } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { FailedPaymentAction, Order } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

const RIDER_ASSIGNABLE_STATUSES: Order['status'][] = ['pending', 'confirmed', 'preparing'];

export function ConfirmPayment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const pendingPaymentsQuery = usePendingPaymentsQuery();
  const failedPaymentsQuery = useFailedPaymentsQuery();
  const adminUsersQuery = useAdminUsersQuery();
  const [activeTab, setActiveTab] = useState<'pending' | 'failed'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [riderSelections, setRiderSelections] = useState<Record<string, string>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const orders = pendingPaymentsQuery.data ?? [];
  const failedOrders = failedPaymentsQuery.data ?? [];
  const riders = (adminUsersQuery.data ?? []).filter((entry) => entry.role === 'rider' && entry.is_active);
  const loading = pendingPaymentsQuery.isLoading;
  const queueError = pendingPaymentsQuery.error instanceof Error ? pendingPaymentsQuery.error.message : null;
  const ridersLoading = adminUsersQuery.isLoading;
  const ridersError = adminUsersQuery.error instanceof Error ? adminUsersQuery.error.message : null;
  const failedError = failedPaymentsQuery.error instanceof Error ? failedPaymentsQuery.error.message : null;

  useRealtimeQueryInvalidation(
    [
      {
        table: 'orders',
        queryKeys: [queryKeys.pendingPayments, queryKeys.failedPayments],
      },
      {
        table: 'payments',
        queryKeys: [queryKeys.pendingPayments, queryKeys.failedPayments],
      },
      {
        table: 'users',
        queryKeys: [queryKeys.adminUsers],
      },
    ],
    true,
  );

  const handleFailedAction = async (order: Order, action: FailedPaymentAction) => {
    if (!user?.id) return;

    setSubmitting(true);
    const { error } = await updateFailedPaymentOrder(order.id, action, user.id);
    setSubmitting(false);

    if (error) {
      showToast('Payment update failed', error);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.failedPayments });
    void queryClient.invalidateQueries({ queryKey: queryKeys.pendingPayments });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminOrders });

    const label =
      action === 'retry'
        ? 'Payment retry queued'
        : action === 'cancel_order'
          ? 'Order cancelled'
          : 'Customer contact noted';
    showToast(label, `Order #${order.id.slice(0, 8)} has been updated.`);
  };

  const verifyPayment = async () => {
    if (!selectedOrder || !user?.id) return;

    setSubmitting(true);
    const { data, error } = await verifyOrderPayment(selectedOrder.id, user.id);

    if (error || !data) {
      setSubmitting(false);
      showToast('Verification failed', error ?? 'Unable to verify the payment.');
      return;
    }

    let nextOrder = data;

    if (selectedRiderId) {
      const assignment = await assignDeliveryRider(data.id, selectedRiderId, {
        cashierId: user.id,
      });

      if (assignment.error || !assignment.data) {
        setSubmitting(false);
        queryClient.setQueryData<Order[]>(
          queryKeys.pendingPayments,
          (current = []) => current.filter((order) => order.id !== data.id),
        );
        setSelectedOrder(null);
        setSelectedRiderId('');
        showToast(
          'Payment verified',
          `Order #${data.id.slice(0, 8)} is ready for preparation, but the rider was not assigned yet.`,
        );
        return;
      }

      nextOrder = assignment.data;
    }

    queryClient.setQueryData<Order[]>(
      queryKeys.pendingPayments,
      (current = []) => current.filter((order) => order.id !== nextOrder.id),
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminOrders });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminAnalytics });
    void queryClient.invalidateQueries({ queryKey: queryKeys.availableDeliveries });
    if (selectedRiderId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ordersForUser(selectedRiderId, 'rider') });
    }

    setSubmitting(false);
    setSelectedOrder(null);
    setSelectedRiderId('');
    showToast(
      'Payment verified',
      selectedRiderId
        ? `Order #${nextOrder.id.slice(0, 8)} is assigned to ${nextOrder.rider?.full_name ?? 'the selected rider'}.`
        : `Order #${nextOrder.id.slice(0, 8)} is ready for preparation.`,
    );
  };

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
      queryKeys.pendingPayments,
      (current = []) => current.map((entry) => (entry.id === data.id ? data : entry)),
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

  const openVerification = (order: Order) => {
    setSelectedOrder(order);
    setSelectedRiderId(order.rider_id ?? '');
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setSelectedOrder(null);
    setSelectedRiderId('');
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="cashier" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Confirm Payment</span>
                <h2>Review uploaded references</h2>
                <p>Approve valid payments so the florist team can begin preparation.</p>
              </div>
            </div>
            <div className="tab-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Button variant={activeTab === 'pending' ? 'primary' : 'secondary'} onClick={() => setActiveTab('pending')}>
                Pending
              </Button>
              <Button variant={activeTab === 'failed' ? 'primary' : 'secondary'} onClick={() => setActiveTab('failed')}>
                Failed
              </Button>
            </div>
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Order ID</th>
                    <th>Rider</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'failed' ? (
                    failedPaymentsQuery.isLoading ? (
                      <tr>
                        <td colSpan={6}>Loading failed payments...</td>
                      </tr>
                    ) : failedError ? (
                      <tr>
                        <td colSpan={6}>Unable to load failed payments: {failedError}</td>
                      </tr>
                    ) : failedOrders.length ? (
                      failedOrders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.customer?.full_name ?? 'Customer'}</td>
                          <td>#{order.id.slice(0, 8)}</td>
                          <td>{order.rider?.full_name ?? 'Unassigned'}</td>
                          <td>{formatPrice(order.total_amount)}</td>
                          <td>{order.payment_method.toUpperCase()}</td>
                          <td>
                            <div className="action-row" style={{ gridTemplateColumns: 'repeat(3, max-content)' }}>
                              <Button size="sm" onClick={() => handleFailedAction(order, 'retry')} disabled={submitting}>
                                Retry
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleFailedAction(order, 'contact_customer')}
                                disabled={submitting}
                              >
                                Contact
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleFailedAction(order, 'cancel_order')}
                                disabled={submitting}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No failed payments found.</td>
                      </tr>
                    )
                  ) : loading ? (
                    <tr>
                      <td colSpan={6}>Loading payment queue...</td>
                    </tr>
                  ) : queueError ? (
                    <tr>
                      <td colSpan={6}>Unable to load the payment queue: {queueError}</td>
                    </tr>
                  ) : orders.length ? (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.customer?.full_name}</td>
                        <td>#{order.id.slice(0, 8)}</td>
                        <td>
                          {order.rider ? (
                            order.rider.full_name
                          ) : RIDER_ASSIGNABLE_STATUSES.includes(order.status) ? (
                            <div className="select-shell rider-select-shell">
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
                          ) : (
                            'Unassigned'
                          )}
                        </td>
                        <td>{formatPrice(order.total_amount)}</td>
                        <td>{order.payment_method.toUpperCase()}</td>
                        <td>
                          <div className="action-row" style={{ gridTemplateColumns: 'repeat(2, max-content)' }}>
                            <Button size="sm" onClick={() => openVerification(order)}>
                              Verify Payment
                            </Button>
                            {RIDER_ASSIGNABLE_STATUSES.includes(order.status) && !order.rider_id ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleAssignRider(order)}
                                disabled={submittingOrderId === order.id || !riderSelections[order.id]}
                              >
                                {submittingOrderId === order.id ? 'Assigning...' : 'Assign Rider'}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No pending payments found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={closeModal}
        title="Verify Payment"
        description="Approve this payment and optionally assign the delivery rider."
      >
        <div className="section">
          <p>Customer: {selectedOrder?.customer?.full_name}</p>
          <p>Amount: {selectedOrder ? formatPrice(selectedOrder.total_amount) : '-'}</p>
          <p>Reference: {selectedOrder?.payments?.[0]?.reference_no ?? 'No reference uploaded'}</p>
          {ridersLoading ? (
            <p className="muted">Loading riders...</p>
          ) : riders.length ? (
            <div className="field-stack">
              <label htmlFor="cashier-rider-select">Assign rider</label>
              <div className="select-shell">
                <select
                  id="cashier-rider-select"
                  value={selectedRiderId}
                  onChange={(event) => setSelectedRiderId(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">Assign later</option>
                  {riders.map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="muted">Optional. You can verify now and let admin assign the rider later.</span>
            </div>
          ) : (
            <p className="muted">
              {ridersError
                ? `Riders are unavailable right now: ${ridersError}`
                : 'No active riders are available right now. Verify the payment and assign later.'}
            </p>
          )}
          <Button onClick={verifyPayment} disabled={submitting}>
            {selectedRiderId ? 'Verify & Assign Rider' : 'Mark as Verified'}
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
