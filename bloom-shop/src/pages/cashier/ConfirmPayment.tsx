import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useAdminUsersQuery, usePendingPaymentsQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { assignDeliveryRider, verifyOrderPayment } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { Order } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

export function ConfirmPayment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const pendingPaymentsQuery = usePendingPaymentsQuery();
  const adminUsersQuery = useAdminUsersQuery();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const orders = pendingPaymentsQuery.data ?? [];
  const riders = (adminUsersQuery.data ?? []).filter((entry) => entry.role === 'rider' && entry.is_active);
  const loading = pendingPaymentsQuery.isLoading;
  const queueError = pendingPaymentsQuery.error instanceof Error ? pendingPaymentsQuery.error.message : null;
  const ridersLoading = adminUsersQuery.isLoading;
  const ridersError = adminUsersQuery.error instanceof Error ? adminUsersQuery.error.message : null;

  useRealtimeQueryInvalidation(
    [
      {
        table: 'orders',
        queryKeys: [queryKeys.pendingPayments],
      },
      {
        table: 'payments',
        queryKeys: [queryKeys.pendingPayments],
      },
      {
        table: 'users',
        queryKeys: [queryKeys.adminUsers],
      },
    ],
    true,
  );

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
                  {loading ? (
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
                        <td>{order.rider?.full_name ?? 'Unassigned'}</td>
                        <td>{formatPrice(order.total_amount)}</td>
                        <td>{order.payment_method.toUpperCase()}</td>
                        <td>
                          <Button size="sm" onClick={() => openVerification(order)}>
                            Verify Payment
                          </Button>
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
