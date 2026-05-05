import { Link } from 'react-router-dom';
import { useMemo } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { usePendingPaymentsQuery } from '../../hooks/useAppQueries';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { queryKeys } from '../../lib/queryClient';
import { formatPrice } from '../../lib/utils';

export function CashierDashboard() {
  const pendingPaymentsQuery = usePendingPaymentsQuery();
  const pendingPayments = pendingPaymentsQuery.data ?? [];
  const isLoading = pendingPaymentsQuery.isLoading;
  const queueError = pendingPaymentsQuery.error instanceof Error ? pendingPaymentsQuery.error.message : null;

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
    ],
    true,
  );

  const stats = useMemo(
    () => [
      { label: 'Pending Queue', value: `${pendingPayments.length}`, trend: 'Needs cashier review', accent: 'primary' as const },
      {
        label: 'GCash References',
        value: `${pendingPayments.filter((order) => order.payment_method === 'gcash').length}`,
        trend: 'Digital confirmations',
        accent: 'success' as const,
      },
      {
        label: 'COD Receivables',
        value: `${pendingPayments.filter((order) => order.payment_method === 'cod').length}`,
        trend: 'Collect on delivery',
        accent: 'neutral' as const,
      },
      {
        label: 'Queue Amount',
        value: formatPrice(pendingPayments.reduce((sum, order) => sum + order.total_amount, 0)),
        trend: 'Awaiting release',
        accent: 'primary' as const,
      },
    ],
    [pendingPayments],
  );

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="cashier" />
          <div className="section">
            <section className="kpi-grid">
              {stats.map((metric) => (
                <Card className="stat-card" key={metric.label}>
                  <p>{metric.label}</p>
                  <h3>{metric.value}</h3>
                  <span className={metric.accent === 'success' ? 'success' : metric.accent === 'primary' ? 'rose' : 'muted'}>
                    {metric.trend}
                  </span>
                </Card>
              ))}
            </section>

            <Card className="summary-card">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Pending Confirmations</span>
                  <h2>Payments needing review</h2>
                  <p>Verify references and push valid orders into preparing.</p>
                </div>
              </div>
              <div className="history-list">
                {isLoading ? (
                  <Card className="delivery-card">Loading payment queue...</Card>
                ) : queueError ? (
                  <Card className="delivery-card">Unable to load the payment queue: {queueError}</Card>
                ) : pendingPayments.length ? (
                  pendingPayments.map((order) => (
                    <Card className="delivery-card" key={order.id}>
                      <div className="summary-row">
                        <div className="section" style={{ gap: '0.15rem' }}>
                          <strong>{order.customer?.full_name}</strong>
                          <p>Order #{order.id.slice(0, 8)}</p>
                        </div>
                        <strong className="price">{formatPrice(order.total_amount)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>{order.payment_method.toUpperCase()}</span>
                        <Link to="/cashier/payments">
                          <Button size="sm">Verify Payment</Button>
                        </Link>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="delivery-card">No pending payments in the queue.</Card>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
