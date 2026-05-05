import { CategoryScale, Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { useAdminAnalyticsQuery } from '../../hooks/useAppQueries';
import { useRealtimeQueryInvalidation } from '../../hooks/useRealtimeQueryInvalidation';
import { queryKeys } from '../../lib/queryClient';
import { formatPrice } from '../../lib/utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function ReportsPage() {
  const { data: analytics, isLoading } = useAdminAnalyticsQuery();
  const salesSeries = analytics?.salesSeries['30d'] ?? [];
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
    ],
    true,
  );

  const reportData = useMemo(
    () => ({
      labels: salesSeries.map((_, index) => `Day ${index + 1}`),
      datasets: [
        {
          label: '30-Day Revenue',
          data: salesSeries,
          borderColor: 'rgba(233,30,99,0.86)',
          backgroundColor: 'rgba(233,30,99,0.08)',
          fill: true,
          tension: 0.35,
        },
      ],
    }),
    [salesSeries],
  );

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <div className="section">
            <Card className="chart-shell">
              <div className="section" style={{ gap: '0.25rem' }}>
                <span className="eyebrow">Reports</span>
                <h2>Sales reporting</h2>
                <p>Longer-range trend reporting and top revenue contributors.</p>
              </div>
              <div className="chart-frame">
                {isLoading ? <p>Loading report data...</p> : <Line data={reportData} options={{ responsive: true, maintainAspectRatio: false }} />}
              </div>
            </Card>

            <Card className="summary-card">
              <div className="section" style={{ gap: '0.25rem' }}>
                <strong>Top Revenue Products</strong>
                <p>Fast reference list for campaign planning and replenishment.</p>
              </div>
              <div className="table-shell">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={2}>Loading top products...</td>
                      </tr>
                    ) : topProductRevenue.length ? (
                      topProductRevenue.map((entry) => (
                        <tr key={entry.label}>
                          <td>{entry.label}</td>
                          <td>{formatPrice(entry.value)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2}>No revenue data available.</td>
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
