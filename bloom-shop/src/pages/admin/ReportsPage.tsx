import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { getAdminCouponsPage, getAdminUsersPage } from '../../lib/admin';
import { getAdminOrdersPage } from '../../lib/orders';
import type { Coupon, Order, UserProfile } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [startDate, setStartDate] = useState(toDateInput(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(toDateInput(new Date()));
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [riders, setRiders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      const [orderResult, couponResult, riderResult] = await Promise.all([
        getAdminOrdersPage({ page: 1, pageSize: 500 }),
        getAdminCouponsPage({ page: 1, pageSize: 500 }),
        getAdminUsersPage({ page: 1, pageSize: 200, role: 'rider' }),
      ]);
      setOrders(orderResult.data);
      setCoupons(couponResult.data);
      setRiders(riderResult.data);
      setLoading(false);
    }

    void loadReports();
  }, []);

  const filteredOrders = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59`).getTime();
    return orders.filter((order) => {
      const createdAt = new Date(order.created_at).getTime();
      return createdAt >= start && createdAt <= end && order.status !== 'cancelled';
    });
  }, [endDate, orders, startDate]);

  const revenueRows = useMemo(() => {
    const revenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const discounts = filteredOrders.reduce((sum, order) => sum + order.discount_amount, 0);
    const deliveryFees = filteredOrders.reduce((sum, order) => sum + order.delivery_fee, 0);
    return [
      { metric: 'Gross revenue', amount: revenue },
      { metric: 'Discounts', amount: discounts },
      { metric: 'Delivery fees', amount: deliveryFees },
      { metric: 'Net after discounts', amount: Math.max(0, revenue - discounts) },
    ];
  }, [filteredOrders]);

  const topRiderRows = useMemo(
    () =>
      riders
        .map((rider) => ({
          rider: rider.full_name,
          deliveries: filteredOrders.filter((order) => order.rider_id === rider.id && order.status === 'delivered').length,
        }))
        .sort((left, right) => right.deliveries - left.deliveries),
    [filteredOrders, riders],
  );

  const couponRows = useMemo(
    () =>
      coupons
        .map((coupon) => ({
          code: coupon.code,
          redemptions: coupon.used_count,
          maxUses: coupon.max_uses,
          rate: coupon.max_uses ? Math.round((coupon.used_count / coupon.max_uses) * 100) : 0,
        }))
        .sort((left, right) => right.redemptions - left.redemptions),
    [coupons],
  );

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <div className="section">
            <Card className="summary-card">
              <div className="section-heading">
                <div className="section" style={{ gap: '0.25rem' }}>
                  <span className="eyebrow">Reports</span>
                  <h2>Operations reporting</h2>
                  <p>Revenue, discounts, delivery performance, and coupon redemption health.</p>
                </div>
              </div>
              <div className="search-row">
                <Input label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <Input label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </Card>

            <Card className="summary-card">
              <div className="section-heading">
                <strong>Revenue vs. discounts</strong>
                <Button size="sm" variant="secondary" onClick={() => downloadCsv('revenue-breakdown.csv', revenueRows)}>
                  <Download size={16} /> CSV
                </Button>
              </div>
              <div className="table-shell">
                <table className="table">
                  <tbody>
                    {loading ? (
                      <tr><td>Loading report data...</td></tr>
                    ) : (
                      revenueRows.map((row) => (
                        <tr key={row.metric}>
                          <td>{row.metric}</td>
                          <td>{formatPrice(row.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="summary-card">
              <div className="section-heading">
                <strong>Top riders by delivery count</strong>
                <Button size="sm" variant="secondary" onClick={() => downloadCsv('top-riders.csv', topRiderRows)}>
                  <Download size={16} /> CSV
                </Button>
              </div>
              <div className="table-shell">
                <table className="table">
                  <thead><tr><th>Rider</th><th>Delivered orders</th></tr></thead>
                  <tbody>
                    {topRiderRows.map((row) => (
                      <tr key={row.rider}><td>{row.rider}</td><td>{row.deliveries}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="summary-card">
              <div className="section-heading">
                <strong>Coupon redemption rates</strong>
                <Button size="sm" variant="secondary" onClick={() => downloadCsv('coupon-redemptions.csv', couponRows)}>
                  <Download size={16} /> CSV
                </Button>
              </div>
              <div className="table-shell">
                <table className="table">
                  <thead><tr><th>Coupon</th><th>Redemptions</th><th>Rate</th></tr></thead>
                  <tbody>
                    {couponRows.map((row) => (
                      <tr key={row.code}><td>{row.code}</td><td>{row.redemptions} / {row.maxUses}</td><td>{row.rate}%</td></tr>
                    ))}
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
