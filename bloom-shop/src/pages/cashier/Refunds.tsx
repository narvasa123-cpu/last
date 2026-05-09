import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useRefundableOrdersQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { processOrderRefund } from '../../lib/orders';
import { queryKeys } from '../../lib/queryClient';
import type { Order } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

export function Refunds() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotifications();
  const refundableOrdersQuery = useRefundableOrdersQuery();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [restoreStock, setRestoreStock] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const orders = refundableOrdersQuery.data ?? [];

  const submitRefund = async () => {
    if (!selectedOrder || !user?.id) return;

    setSubmitting(true);
    const { error } = await processOrderRefund({
      orderId: selectedOrder.id,
      cashierId: user.id,
      reason,
      restoreStock,
    });
    setSubmitting(false);

    if (error) {
      showToast('Refund failed', error);
      return;
    }

    setSelectedOrder(null);
    setReason('');
    setRestoreStock(true);
    void queryClient.invalidateQueries({ queryKey: queryKeys.refundableOrders });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminOrders });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    if (user?.id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashierTodayOrders(user.id) });
    }
    showToast('Refund processed', `Order #${selectedOrder.id.slice(0, 8)} has been marked refunded.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="cashier" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Refunds</span>
                <h2>Delivered orders eligible for refund</h2>
                <p>Record the reason, mark payment as refunded, and optionally restore product stock.</p>
              </div>
            </div>

            <div className="history-list">
              {refundableOrdersQuery.isLoading ? (
                <Card className="delivery-card">Loading delivered orders...</Card>
              ) : orders.length ? (
                orders.map((order) => (
                  <Card className="delivery-card" key={order.id}>
                    <div className="summary-row">
                      <div className="section" style={{ gap: '0.2rem' }}>
                        <strong>#{order.id.slice(0, 8)}</strong>
                        <p>{order.customer?.full_name ?? (order.is_walk_in ? 'Walk-in customer' : 'Customer')}</p>
                      </div>
                      <strong className="price">{formatPrice(order.total_amount)}</strong>
                    </div>
                    <div className="summary-row">
                      <Badge variant={order.is_walk_in ? 'neutral' : 'success'}>
                        {order.is_walk_in ? 'Walk-in' : order.payment_method.toUpperCase()}
                      </Badge>
                      <Button size="sm" onClick={() => setSelectedOrder(order)}>
                        <RotateCcw size={16} />
                        Process Refund
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="delivery-card">No delivered orders are eligible for refund.</Card>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => {
          if (!submitting) setSelectedOrder(null);
        }}
        title="Process Refund"
        description="A reason note is required before the order can be refunded."
      >
        <div className="section">
          <p>Order: #{selectedOrder?.id.slice(0, 8)}</p>
          <p>Amount: {selectedOrder ? formatPrice(selectedOrder.total_amount) : '-'}</p>
          <Textarea
            label="Refund Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe why this refund is being processed."
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={restoreStock}
              onChange={(event) => setRestoreStock(event.target.checked)}
            />
            Restore stock for refunded items
          </label>
          <Button onClick={submitRefund} disabled={submitting || !reason.trim()}>
            {submitting ? 'Processing...' : 'Process Refund'}
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
