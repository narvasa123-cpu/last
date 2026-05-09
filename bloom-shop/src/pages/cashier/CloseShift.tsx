import { Printer } from 'lucide-react';
import { useMemo } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useCashierTodayOrdersQuery } from '../../hooks/useAppQueries';
import { formatPrice } from '../../lib/utils';

export function CloseShift() {
  const { user, profile } = useAuth();
  const todayOrdersQuery = useCashierTodayOrdersQuery(user?.id);
  const orders = todayOrdersQuery.data ?? [];

  const summary = useMemo(() => {
    const walkInSales = orders
      .filter((order) => order.is_walk_in && order.payment_status === 'paid')
      .reduce((sum, order) => sum + order.total_amount, 0);
    const verifiedOnlinePayments = orders
      .filter((order) => !order.is_walk_in && ['verified', 'paid'].includes(order.payment_status))
      .reduce((sum, order) => sum + order.total_amount, 0);
    const refunds = orders
      .filter((order) => order.payment_status === 'refunded')
      .reduce((sum, order) => sum + order.total_amount, 0);

    return {
      walkInSales,
      verifiedOnlinePayments,
      refunds,
      cashInDrawer: Math.max(0, walkInSales - refunds),
    };
  }, [orders]);

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="cashier" />
          <div className="section">
            <section className="kpi-grid">
              <Card className="stat-card">
                <p>Walk-In Sales</p>
                <h3>{formatPrice(summary.walkInSales)}</h3>
                <span className="muted">Cash POS orders today</span>
              </Card>
              <Card className="stat-card">
                <p>Verified Online</p>
                <h3>{formatPrice(summary.verifiedOnlinePayments)}</h3>
                <span className="success">Reviewed by cashier</span>
              </Card>
              <Card className="stat-card">
                <p>Refunds</p>
                <h3>{formatPrice(summary.refunds)}</h3>
                <span className="rose">Deduct from shift</span>
              </Card>
              <Card className="stat-card">
                <p>Cash In Drawer</p>
                <h3>{formatPrice(summary.cashInDrawer)}</h3>
                <span className="muted">Walk-in cash minus refunds</span>
              </Card>
            </section>

            <Card className="summary-card shift-print-area">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Close Shift</span>
                  <h2>Printable shift summary</h2>
                  <p>{new Date().toLocaleDateString()} / Cashier: {profile?.full_name ?? 'Cashier'}</p>
                </div>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer size={18} />
                  Print
                </Button>
              </div>

              <div className="receipt-preview">
                <div className="receipt-brand">
                  <strong>Bloom Shop</strong>
                  <span>End-of-Day Cashier Shift Report</span>
                </div>
                <div className="summary-row">
                  <span>Cashier</span>
                  <strong>{profile?.full_name ?? user?.email ?? 'Cashier'}</strong>
                </div>
                <div className="summary-row">
                  <span>Printed</span>
                  <strong>{new Date().toLocaleString()}</strong>
                </div>
                <div className="summary-row">
                  <span>Total walk-in sales</span>
                  <strong>{formatPrice(summary.walkInSales)}</strong>
                </div>
                <div className="summary-row">
                  <span>Total verified online payments</span>
                  <strong>{formatPrice(summary.verifiedOnlinePayments)}</strong>
                </div>
                <div className="summary-row">
                  <span>Total refunds</span>
                  <strong>-{formatPrice(summary.refunds)}</strong>
                </div>
                <div className="summary-row">
                  <strong>Cash in drawer</strong>
                  <strong>{formatPrice(summary.cashInDrawer)}</strong>
                </div>
              </div>

              <div className="table-shell">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Order</th>
                      <th>Type</th>
                      <th>Payment</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayOrdersQuery.isLoading ? (
                      <tr>
                        <td colSpan={5}>Loading shift orders...</td>
                      </tr>
                    ) : orders.length ? (
                      orders.map((order) => (
                        <tr key={order.id}>
                          <td>{new Date(order.created_at).toLocaleTimeString()}</td>
                          <td>#{order.id.slice(0, 8)}</td>
                          <td>{order.is_walk_in ? 'Walk-in' : 'Online'}</td>
                          <td>{order.payment_status}</td>
                          <td>{formatPrice(order.total_amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No cashier orders recorded today.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
