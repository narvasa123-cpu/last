import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { CartDrawer } from './components/cart/CartDrawer';
import { FloatingPetals } from './components/layout/FloatingPetals';
import { Navbar } from './components/layout/Navbar';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { FullPageSpinner } from './components/ui/Spinner';
import { ToastViewport } from './components/ui/Toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { NotificationsProvider } from './hooks/useNotifications';
import type { Role } from './lib/types';

const HomePage = lazy(() => import('./pages/public/HomePage').then((module) => ({ default: module.HomePage })));
const ShopPage = lazy(() => import('./pages/public/ShopPage').then((module) => ({ default: module.ShopPage })));
const CustomBouquetPage = lazy(() =>
  import('./pages/public/CustomBouquetPage').then((module) => ({ default: module.CustomBouquetPage })),
);
const ProductDetailPage = lazy(() =>
  import('./pages/public/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })),
);
const LoginPage = lazy(() => import('./pages/public/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/public/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const CartPage = lazy(() => import('./pages/customer/CartPage').then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() =>
  import('./pages/customer/CheckoutPage').then((module) => ({ default: module.CheckoutPage })),
);
const OrdersPage = lazy(() =>
  import('./pages/customer/OrdersPage').then((module) => ({ default: module.OrdersPage })),
);
const TrackOrderPage = lazy(() =>
  import('./pages/customer/TrackOrderPage').then((module) => ({ default: module.TrackOrderPage })),
);
const WishlistPage = lazy(() =>
  import('./pages/customer/WishlistPage').then((module) => ({ default: module.WishlistPage })),
);
const RewardsPage = lazy(() =>
  import('./pages/customer/RewardsPage').then((module) => ({ default: module.RewardsPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/customer/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
);
const ManageProducts = lazy(() =>
  import('./pages/admin/ManageProducts').then((module) => ({ default: module.ManageProducts })),
);
const ManageOrders = lazy(() =>
  import('./pages/admin/ManageOrders').then((module) => ({ default: module.ManageOrders })),
);
const ManageUsers = lazy(() =>
  import('./pages/admin/ManageUsers').then((module) => ({ default: module.ManageUsers })),
);
const ManageCoupons = lazy(() =>
  import('./pages/admin/ManageCoupons').then((module) => ({ default: module.ManageCoupons })),
);
const ReportsPage = lazy(() =>
  import('./pages/admin/ReportsPage').then((module) => ({ default: module.ReportsPage })),
);
const ReviewsPage = lazy(() =>
  import('./pages/admin/ReviewsPage').then((module) => ({ default: module.ReviewsPage })),
);
const ActivityPage = lazy(() =>
  import('./pages/admin/ActivityPage').then((module) => ({ default: module.ActivityPage })),
);
const RiderDashboard = lazy(() =>
  import('./pages/rider/RiderDashboard').then((module) => ({ default: module.RiderDashboard })),
);
const ActiveDelivery = lazy(() =>
  import('./pages/rider/ActiveDelivery').then((module) => ({ default: module.ActiveDelivery })),
);
const EarningsDashboard = lazy(() =>
  import('./pages/rider/EarningsDashboard').then((module) => ({ default: module.EarningsDashboard })),
);
const DeliveryHistory = lazy(() =>
  import('./pages/rider/DeliveryHistory').then((module) => ({ default: module.DeliveryHistory })),
);
const CashierDashboard = lazy(() =>
  import('./pages/cashier/CashierDashboard').then((module) => ({ default: module.CashierDashboard })),
);
const ConfirmPayment = lazy(() =>
  import('./pages/cashier/ConfirmPayment').then((module) => ({ default: module.ConfirmPayment })),
);
const WalkInOrder = lazy(() =>
  import('./pages/cashier/WalkInOrder').then((module) => ({ default: module.WalkInOrder })),
);
const Refunds = lazy(() =>
  import('./pages/cashier/Refunds').then((module) => ({ default: module.Refunds })),
);
const CloseShift = lazy(() =>
  import('./pages/cashier/CloseShift').then((module) => ({ default: module.CloseShift })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

const AuthGuard = ({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: React.ReactNode;
}) => {
  const { user, role, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

function AppLayout() {
  return (
    <div className="app-shell">
      <FloatingPetals />
      <Navbar />
      <CartDrawer />
      <ToastViewport />
      <Outlet />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/custom-bouquet" element={<CustomBouquetPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/customer" element={<Navigate to="/customer/profile" replace />} />
          <Route
            path="/customer/cart"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <CartPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/checkout"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <CheckoutPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/orders"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <OrdersPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/orders/:id"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <TrackOrderPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/track-order/:id"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <TrackOrderPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/wishlist"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <WishlistPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/rewards"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <RewardsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/customer/profile"
            element={
              <AuthGuard allowedRoles={['customer']}>
                <ProfilePage />
              </AuthGuard>
            }
          />

          <Route
            path="/admin"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <AdminDashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/products"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ManageProducts />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ManageOrders />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ManageUsers />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/coupons"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ManageCoupons />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ReportsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/reviews"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ReviewsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/activity"
            element={
              <AuthGuard allowedRoles={['admin']}>
                <ActivityPage />
              </AuthGuard>
            }
          />

          <Route
            path="/rider"
            element={
              <AuthGuard allowedRoles={['rider']}>
                <RiderDashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/rider/active"
            element={
              <AuthGuard allowedRoles={['rider']}>
                <ActiveDelivery />
              </AuthGuard>
            }
          />
          <Route
            path="/rider/history"
            element={
              <AuthGuard allowedRoles={['rider']}>
                <DeliveryHistory />
              </AuthGuard>
            }
          />
          <Route
            path="/rider/earnings"
            element={
              <AuthGuard allowedRoles={['rider']}>
                <EarningsDashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/rider/profile"
            element={
              <AuthGuard allowedRoles={['rider']}>
                <ProfilePage />
              </AuthGuard>
            }
          />

          <Route
            path="/cashier"
            element={
              <AuthGuard allowedRoles={['cashier']}>
                <CashierDashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/cashier/payments"
            element={
              <AuthGuard allowedRoles={['cashier']}>
                <ConfirmPayment />
              </AuthGuard>
            }
          />
          <Route
            path="/cashier/walk-in"
            element={
              <AuthGuard allowedRoles={['cashier']}>
                <WalkInOrder />
              </AuthGuard>
            }
          />
          <Route
            path="/cashier/refunds"
            element={
              <AuthGuard allowedRoles={['cashier']}>
                <Refunds />
              </AuthGuard>
            }
          />
          <Route
            path="/cashier/close-shift"
            element={
              <AuthGuard allowedRoles={['cashier']}>
                <CloseShift />
              </AuthGuard>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <AuthProvider>
        <NotificationsProvider>
          <AppRoutes />
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
