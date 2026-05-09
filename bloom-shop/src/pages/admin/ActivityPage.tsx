import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { getActivityLogsPage } from '../../lib/admin';
import type { ActivityLog } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';

export function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      const result = await getActivityLogsPage({ page, pageSize, search });
      setLogs(result.data);
      setTotal(result.total);
      setLoading(false);
    }

    void loadLogs();
  }, [page, search]);

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Activity</span>
                <h2>Admin activity log</h2>
                <p>Track order status changes, product edits, user role changes, and coupon changes.</p>
              </div>
            </div>
            <div className="search-row">
              <Input
                label="Search activity"
                icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="table-shell">
              <table className="table">
                <thead><tr><th>Action</th><th>Actor</th><th>Details</th><th>When</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4}>Loading activity...</td></tr>
                  ) : logs.length ? (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.action}</td>
                        <td>{log.user?.full_name ?? log.user_id ?? 'System'}</td>
                        <td><code>{JSON.stringify(log.details)}</code></td>
                        <td>{formatDateTime(log.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4}>No activity has been recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span>Page {page} of {totalPages} - {total} events</span>
              <div className="summary-row">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
