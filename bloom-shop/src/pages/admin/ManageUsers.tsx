import { useEffect, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useNotifications } from '../../hooks/useNotifications';
import { getAdminUsers, updateAdminUser } from '../../lib/admin';
import type { Role, UserProfile } from '../../lib/types';

export function ManageUsers() {
  const { showToast } = useNotifications();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      setUsers(await getAdminUsers());
      setLoading(false);
    }

    loadUsers();
  }, []);

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
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pendingUserId === user.id}
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
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
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
