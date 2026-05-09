import { QueryClient } from '@tanstack/react-query';

import type { Role } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  products: ['products'] as const,
  product: (productId: string) => ['products', productId] as const,
  productReviews: (productId: string) => ['product-reviews', productId] as const,
  ordersForUser: (userId: string, role: Role) => ['orders', role, userId] as const,
  adminOrders: ['admin', 'orders'] as const,
  adminUsers: ['admin', 'users'] as const,
  adminAnalytics: ['admin', 'analytics'] as const,
  pendingPayments: ['cashier', 'pending-payments'] as const,
  failedPayments: ['cashier', 'failed-payments'] as const,
  cashierTodayOrders: (cashierId: string) => ['cashier', 'today-orders', cashierId] as const,
  refundableOrders: ['cashier', 'refundable-orders'] as const,
  availableDeliveries: ['rider', 'available-deliveries'] as const,
  order: (orderId: string) => ['order', orderId] as const,
  orderStatusHistory: (orderId: string) => ['order-status-history', orderId] as const,
  orderTracking: (orderId: string) => ['order-tracking', orderId] as const,
};
