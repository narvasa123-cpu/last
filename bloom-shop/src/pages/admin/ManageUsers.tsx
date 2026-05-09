import { useEffect, useMemo, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useNotifications } from '../../hooks/useNotifications';
import { getAdminUsersPage, updateAdminUser } from '../../lib/admin';
import { getOrdersForUser } from '../../lib/orders';
import type { Order, Role, Tier, UserProfile } from '../../lib/types';
import { formatDateTime, formatPrice } from '../../lib/utils';

export function ManageUsers() {
  const { showToast } = useNotifications();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserOrders, setSelectedUserOrders] = useState<Order[]>([]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      const result = await getAdminUsersPage({ page, pageSize, search, role: roleFilter, tier: tierFilter });
      setUsers(result.data);
      setTotalUsers(result.total);
      setLoading(false);
    }

    loadUsers();
  }, [page, roleFilter, search, tierFilter]);

  useEffect(() => {
    if (!selectedUser) return;
    void getOrdersForUser(selectedUser.id, selectedUser.role ?? 'customer').then(setSelectedUserOrders);
  }, [selectedUser]);

  const userStats = useMemo(() => {
    const deliveredOrders = selectedUserOrders.filter((order) => order.status !== 'cancelled');
    return {
      totalOrders: selectedUserOrders.length,
      revenue: deliveredOrders.reduce((sum, order) => sum + order.total_amount, 0),
      nextTierPoints:
        selectedUser?.tier === 'Gold'
          ? 0
          : selectedUser?.tier === 'Silver'
            ? Math.max(0, 1500 - (selectedUser?.points ?? 0))
            : Math.max(0, 500 - (selectedUser?.points ?? 0)),
    };
  }, [selectedUser, selectedUserOrders]);

  const handleRoleChange = async (user: UserProfile, role: Role) => {
    setPendingUserId(user.id);
    const { data, error } = await updateAdminUser(user.id, { role });
    setPendingUserId(null);

    if (error || !data) {
      showToast('User update failed', error ?? 'Unable to update the user role.');
      return;
    }

    setUsers((current) => current.map((entry) => (entry.id === data.id ? data : entry)));
    showToast('Role updated', `${data.full_name} is now assigned as ${data.role}.`);
  };

  const handleToggleActive = async (user: UserProfile) => {
    setPendingUserId(user.id);
    const { data, error } = await updateAdminUser(user.id, { is_active: !user.is_active });
    setPendingUserId(null);

    if (error || !data) {
      showToast('User update failed', error ?? 'Unable to change the account status.');
      return;
    }

    setUsers((current) => current.map((entry) => (entry.id === data.id ? data : entry)));
    showToast('Account updated', `${data.full_name} is now ${data.is_active ? 'active' : 'inactive'}.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Manage Users</span>
                <h2>Accounts and roles</h2>
                <p>See which users are active and how they are classified in the system.</p>
              </div>
            </div>
            <div className="search-row">
              <Input
                label="Search users"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <div className="field-stack">
                <label htmlFor="role-filter">Role</label>
                <div className="select-shell">
                  <select
                    id="role-filter"
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value as Role | 'all');
                      setPage(1);
                    }}
                  >
                    <option value="all">All roles</option>
                    {(['admin', 'customer', 'rider', 'cashier'] as const).map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-stack">
                <label htmlFor="tier-filter">Tier</label>
                <div className="select-shell">
                  <select
                    id="tier-filter"
                    value={tierFilter}
                    onChange={(event) => {
                      setTierFilter(event.target.value as Tier | 'all');
                      setPage(1);
                    }}
                  >
                    <option value="all">All tiers</option>
                    {(['Bronze', 'Silver', 'Gold'] as const).map((tier) => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6}>Loading users...</td>
                    </tr>
                  ) : users.length ? (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>
                          <div className="select-shell">
                            <select
                              value={user.role ?? 'customer'}
                              onChange={(event) => handleRoleChange(user, event.target.value as Role)}
                              disabled={pendingUserId === user.id}
                            >
                              {(['admin', 'customer', 'rider', 'cashier'] as const).map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>{user.phone}</td>
                        <td>{user.tier}</td>
                        <td>
                          <Badge variant={user.is_active ? 'success' : 'neutral'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td>
                          <div className="summary-row">
                            <Button size="sm" variant="secondary" onClick={() => setSelectedUser(user)}>
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pendingUserId === user.id}
                              onClick={() => handleToggleActive(user)}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span>Page {page} of {totalPages} - {totalUsers} users</span>
              <div className="summary-row">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <Modal
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.full_name ?? 'User details'}
        description="Customer intelligence, order value, tier progress, and address."
      >
        {selectedUser ? (
          <div className="section">
            <div className="admin-order-insights">
              <div className="admin-insight-card">
                <span>Lifetime Orders</span>
                <strong>{userStats.totalOrders}</strong>
              </div>
              <div className="admin-insight-card">
                <span>Total Revenue</span>
                <strong>{formatPrice(userStats.revenue)}</strong>
              </div>
              <div className="admin-insight-card">
                <span>Tier Progress</span>
                <strong>{selectedUser.tier === 'Gold' ? 'Max' : `${userStats.nextTierPoints} pts`}</strong>
              </div>
            </div>
            <div className="admin-detail-panel">
              <strong>Address</strong>
              <p>{selectedUser.address || 'No address on file.'}</p>
            </div>
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUserOrders.slice(0, 6).map((order) => (
                    <tr key={order.id}>
                      <td>#{order.id.slice(0, 8)}</td>
                      <td>{order.status}</td>
                      <td>{formatPrice(order.total_amount)}</td>
                      <td>{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                  {!selectedUserOrders.length ? (
                    <tr>
                      <td colSpan={4}>No orders found for this user.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageWrapper>
  );
}
