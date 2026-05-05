import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { useMemo, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAdminAnalyticsQuery } from '../../hooks/useAppQueries';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { STATUS_LABELS } from '../../lib/constants';
import { queryKeys } from '../../lib/queryClient';
import type { DashboardMetric, Order, Product } from '../../lib/types';
import { formatDateTime, formatPrice } from '../../lib/utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

export function AdminDashboard() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const { data: analytics, isLoading } = useAdminAnalyticsQuery();
  const metrics = analytics?.metrics ?? ([] as DashboardMetric[]);
  const recentOrders = analytics?.recentOrders ?? ([] as Order[]);
  const lowStockProducts = analytics?.lowStockProducts ?? ([] as Product[]);
  const salesSeries = analytics?.salesSeries ?? { '7d': [], '30d': [], '90d': [] };
  const topProductRevenue = analytics?.topProductRevenue ?? [];

  useRealtimeQueryInvalidation(
    [
      {
        table: 'orders',
        queryKeys: [queryKeys.adminAnalytics],
      },
      {
        table: 'products',
        queryKeys: [queryKeys.adminAnalytics],
      },
      {
        table: 'users',
        queryKeys: [queryKeys.adminAnalytics],
      },
    ],
    true,
  );

  const salesData = useMemo(
    () => ({
      labels: salesSeries[range].map((_, index) => `${index + 1}`),
      datasets: [
        {
          label: 'Sales',
          data: salesSeries[range],
          borderColor: 'rgba(233,30,99,0.9)',
          backgroundColor: 'rgba(233,30,99,0.12)',
          fill: true,
          tension: 0.35,
        },
      ],
    }),
    [range, salesSeries],
  );

  const topProductsData = useMemo(
    () => ({
      labels: topProductRevenue.map((entry) => entry.label),
      datasets: [
        {
          label: 'Revenue',
          data: topProductRevenue.map((entry) => entry.value),
          backgroundColor: 'rgba(233,30,99,0.72)',
          borderRadius: 12,
        },
      ],
    }),
    [topProductRevenue],
  );

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <div className="section">
            <section className="section">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Admin Dashboard</span>
                  <h2>Operations, sales, and fulfillment at a glance.</h2>
                  <p>Track revenue, inventory pressure, and live order progress from one place.</p>
                </div>
              </div>
              <div className="kpi-grid">
                {(isLoading ? [] : metrics).map((metric) => (
                  <Card className="stat-card" key={metric.label}>
                    <p>{metric.label}</p>
                    <h3>{metric.value}</h3>
                    <span className={metric.accent === 'success' ? 'success' : metric.accent === 'primary' ? 'rose' : 'muted'}>
                      {metric.trend}
                    </span>
                  </Card>
                ))}
              </div>
            </section>

            <section className="layout-grid admin-dashboard-charts">
              <Card className="chart-shell">
                <div className="summary-row">
                  <div>
                    <strong>Sales Trend</strong>
                    <p>Switch between short and long-term sales windows.</p>
                  </div>
                  <div className="summary-row">
                    {(['7d', '30d', '90d'] as const).map((value) => (
                      <Button
                        key={value}
                        variant={range === value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setRange(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="chart-frame">
                  <Line data={salesData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </Card>

              <Card className="chart-shell">
                <div className="section" style={{ gap: '0.25rem' }}>
                  <strong>Top Products</strong>
                  <p>Revenue leaders over the selected time window.</p>
                </div>
                <div className="chart-frame">
                  <Bar data={topProductsData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
              </Card>
            </section>

            <section className="layout-grid admin-dashboard-details">
              <Card className="summary-card">
                <div className="section" style={{ gap: '0.25rem' }}>
                  <strong>Recent Orders</strong>
                  <p>Newest order records with quick status context.</p>
                </div>
                <div className="table-shell">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={5}>Loading recent orders...</td>
                        </tr>
                      ) : recentOrders.length ? (
                        recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td>#{order.id.slice(0, 8)}</td>
                          <td>{order.customer?.full_name}</td>
                          <td>
                            <Badge variant={order.status === 'delivered' ? 'success' : 'primary'}>
                              {STATUS_LABELS[order.status]}
                            </Badge>
                          </td>
                          <td>{formatPrice(order.total_amount)}</td>
                          <td>{formatDateTime(order.updated_at)}</td>
                        </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5}>No recent orders available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="summary-card">
                <div className="section" style={{ gap: '0.25rem' }}>
                  <strong>Low Stock Alerts</strong>
                  <p>Products with limited stems remaining.</p>
                </div>
                <div className="cart-list">
                  {(isLoading ? [] : lowStockProducts).slice(0, 5).map((product) => (
                    <div className="glass-card" key={product.id} style={{ padding: '1rem' }}>
                      <div className="summary-row">
                        <strong>{product.name}</strong>
                        <span className="badge badge-primary">{product.stock} left</span>
                      </div>
                      <p>{formatPrice(product.price)}</p>
                    </div>
                  ))}
                  {!isLoading && !lowStockProducts.length ? <p>No low stock alerts right now.</p> : null}
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
