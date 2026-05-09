import {
  Bell,
  CheckCircle2,
  Flower2,
  Heart,
  LogOut,
  Mail,
  Menu,
  ShoppingBag,
  UserCircle2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import type { NavLinkItem, Role } from '../../lib/types';
import { cn, getInitials } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const navItems: NavLinkItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'Custom Bouquet', to: '/custom-bouquet' },
  { label: 'Orders', to: '/customer/orders', roles: ['customer'] },
  { label: 'Rewards', to: '/customer/rewards', roles: ['customer'] },
  { label: 'Admin', to: '/admin', roles: ['admin'] },
  { label: 'Rider', to: '/rider', roles: ['rider'] },
  { label: 'Cashier', to: '/cashier', roles: ['cashier'] },
];

function filterLinks(role: Role, isAuthenticated: boolean) {
  return navItems.filter((item) => {
    if (!item.roles) return true;
    return isAuthenticated && item.roles.includes(role);
  });
}

export function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, signOut } = useAuth();
  const { totals, toggleDrawer } = useCart();
  const { notifications, unreadCount, markAllAsRead, markNotificationRead, showToast } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const links = filterLinks(role, Boolean(user));

  useEffect(() => {
    if (!notificationOpen) return;
    function handleClick(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notificationOpen]);

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setNotificationOpen(false);
    setMenuOpen(false);
    toggleDrawer(false);

    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      showToast('Sign out failed', 'We could not sign you out cleanly. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <header className="navbar">
        <Card className="navbar-inner">
          <div className="nav-brand">
            <NavLink to="/" className="nav-brand">
              <span className="brand-mark">
                <Flower2 size={20} />
              </span>
              <div className="section" style={{ gap: '0.15rem' }}>
                <h1>Bloom Shop</h1>
                <span className="muted">Flower delivery, designed beautifully.</span>
              </div>
            </NavLink>
          </div>

          <nav className="nav-links" aria-label="Primary navigation">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'nav-link',
                    (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)) && 'active',
                    isActive && 'active',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav-actions">
            <div style={{ position: 'relative' }} ref={notificationRef}>
              <button
                className="icon-button"
                onClick={() => setNotificationOpen((current) => !current)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 ? <span className="icon-badge">{unreadCount}</span> : null}
              </button>
              {notificationOpen ? (
                <Card className="glass-card notification-popover">
                  <div className="summary-row">
                    <div>
                      <strong>Notifications</strong>
                      <p>{notifications.length ? 'Realtime order and promo updates.' : 'No notifications yet.'}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                      Mark all read
                    </Button>
                  </div>
                  <div className="notification-list">
                    {notifications.slice(0, 5).map((item) => (
                      <div className="notification-item glass-card" key={item.id}>
                        <div className="summary-row">
                          <strong>{item.title}</strong>
                          {!item.is_read ? <span className="badge badge-primary">New</span> : null}
                        </div>
                        <p>{item.message}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markNotificationRead(item.id, !item.is_read)}
                        >
                          {item.is_read ? <Mail size={16} /> : <CheckCircle2 size={16} />}
                          {item.is_read ? 'Mark unread' : 'Mark read'}
                        </Button>
                      </div>
                    ))}
                    {!notifications.length ? (
                      <div className="empty-state">
                        <div className="empty-illustration">
                          <Bell size={30} />
                        </div>
                        <p>Your notification center is calm right now.</p>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ) : null}
            </div>

            <button className="icon-button" onClick={() => toggleDrawer(true)} aria-label="Open cart">
              <ShoppingBag size={18} />
              {totals.count > 0 ? <span className="icon-badge">{totals.count}</span> : null}
            </button>

            {role === 'customer' ? (
              <NavLink to="/customer/wishlist" className="icon-button" aria-label="Wishlist">
                <Heart size={18} />
              </NavLink>
            ) : null}

            {user ? (
              <>
                <button
                  className="icon-button desktop-only"
                  onClick={() => navigate(role === 'customer' ? '/customer/profile' : `/${role}`)}
                  aria-label="Profile"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  ) : (
                    <span>{getInitials(profile?.full_name ?? 'Bloom')}</span>
                  )}
                </button>
                <Button variant="ghost" className="desktop-only" onClick={handleSignOut} disabled={signingOut}>
                  <LogOut size={18} />
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </Button>
              </>
            ) : (
              <Button variant="primary" className="desktop-only" onClick={() => navigate('/login')}>
                <UserCircle2 size={18} />
                Login
              </Button>
            )}

            <button
              className="icon-button mobile-menu-toggle"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </Card>
      </header>

      {menuOpen ? (
        <>
          <div className="drawer-overlay" onClick={() => setMenuOpen(false)} role="presentation" />
          <aside className="mobile-drawer" aria-label="Mobile navigation">
            <div className="summary-row">
              <strong>Menu</strong>
              <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="sidebar-link"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <Button
                variant="secondary"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                <LogOut size={18} />
                {signingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate('/login')}>
                Login
              </Button>
            )}
          </aside>
        </>
      ) : null}
    </>
  );
}
