import { Activity, BadgeDollarSign, LayoutDashboard, MessageSquare, Package, ReceiptText, RotateCcw, TicketPercent, Truck, UserCircle2, Users, Wallet } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import type { Role } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';

const sidebarLinks: Record<Role, Array<{ to: string; label: string; icon: React.ReactNode }>> = {
  admin: [
    { to: '/admin', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/products', label: 'Products', icon: <Package size={18} /> },
    { to: '/admin/orders', label: 'Orders', icon: <ReceiptText size={18} /> },
    { to: '/admin/users', label: 'Users', icon: <Users size={18} /> },
    { to: '/admin/coupons', label: 'Coupons', icon: <TicketPercent size={18} /> },
    { to: '/admin/reports', label: 'Reports', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/reviews', label: 'Reviews', icon: <MessageSquare size={18} /> },
    { to: '/admin/activity', label: 'Activity', icon: <Activity size={18} /> },
  ],
  customer: [
    { to: '/customer/orders', label: 'Orders', icon: <ReceiptText size={18} /> },
    { to: '/customer/wishlist', label: 'Wishlist', icon: <Package size={18} /> },
    { to: '/customer/rewards', label: 'Rewards', icon: <TicketPercent size={18} /> },
    { to: '/customer/profile', label: 'Profile', icon: <UserCircle2 size={18} /> },
  ],
  rider: [
    { to: '/rider', label: 'Overview', icon: <Truck size={18} /> },
    { to: '/rider/active', label: 'Active Delivery', icon: <LayoutDashboard size={18} /> },
    { to: '/rider/earnings', label: 'Earnings', icon: <Wallet size={18} /> },
    { to: '/rider/history', label: 'History', icon: <ReceiptText size={18} /> },
    { to: '/rider/profile', label: 'Profile', icon: <UserCircle2 size={18} /> },
  ],
  cashier: [
    { to: '/cashier', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { to: '/cashier/payments', label: 'Confirm Payment', icon: <ReceiptText size={18} /> },
    { to: '/cashier/walk-in', label: 'Walk-In Orders', icon: <Package size={18} /> },
    { to: '/cashier/refunds', label: 'Refunds', icon: <RotateCcw size={18} /> },
    { to: '/cashier/close-shift', label: 'Close Shift', icon: <BadgeDollarSign size={18} /> },
  ],
};

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  return (
    <Card className="sidebar">
      <div className="section" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">Dashboard</span>
        <h3>{role[0].toUpperCase() + role.slice(1)} tools</h3>
        <p>Quick access to the workflows you use every day.</p>
      </div>
      {sidebarLinks[role].map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === `/${role}`}
          className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </Card>
  );
}
