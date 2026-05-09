import { useMemo } from 'react';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAdminAnalytics, getAdminUsers } from '../lib/admin';
import { getProductById, getProducts, getReviewsByProduct } from '../lib/data';
import {
  getAdminOrders,
  getAvailableDeliveries,
  getCashierTodayOrders,
  getFailedPaymentOrders,
  getOrderById,
  getOrderStatusHistory,
  getOrderTrackingPoints,
  getOrdersForUser,
  getPendingPaymentOrders,
  getRefundableOrders,
} from '../lib/orders';
import { queryKeys } from '../lib/queryClient';
import type { Order, Product, Role } from '../lib/types';

export function useProductsQuery() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: getProducts,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecommendedProductsQuery(excludeIds: string[] = []) {
  const productsQuery = useProductsQuery();
  const data = useMemo(
    () =>
      [...(productsQuery.data ?? [])]
        .filter((product) => !excludeIds.includes(product.id))
        .sort((left, right) => right.review_count * right.avg_rating - left.review_count * left.avg_rating)
        .slice(0, 4),
    [excludeIds, productsQuery.data],
  );

  return {
    ...productsQuery,
    data,
  };
}

export function useProductQuery(productId?: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.product(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: async () => {
      const product = await getProductById(productId!);
      if (!product) {
        throw new Error('Product not found.');
      }
      return product;
    },
    initialData: () =>
      queryClient
        .getQueryData<Product[]>(queryKeys.products)
        ?.find((entry) => entry.id === productId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProductReviewsQuery(productId?: string) {
  return useQuery({
    queryKey: queryKeys.productReviews(productId ?? ''),
    enabled: Boolean(productId),
    queryFn: () => getReviewsByProduct(productId!),
    staleTime: 60 * 1000,
  });
}

export function useOrdersForUserQuery(userId?: string, role?: Role) {
  return useQuery({
    queryKey: queryKeys.ordersForUser(userId ?? '', role ?? 'customer'),
    enabled: Boolean(userId && role),
    queryFn: () => getOrdersForUser(userId!, role!),
    staleTime: 15 * 1000,
  });
}

export function useAdminOrdersQuery() {
  return useQuery({
    queryKey: queryKeys.adminOrders,
    queryFn: getAdminOrders,
    staleTime: 15 * 1000,
  });
}

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: getAdminUsers,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAdminAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.adminAnalytics,
    queryFn: getAdminAnalytics,
    staleTime: 30 * 1000,
  });
}

export function usePendingPaymentsQuery() {
  return useQuery({
    queryKey: queryKeys.pendingPayments,
    queryFn: getPendingPaymentOrders,
    staleTime: 15 * 1000,
  });
}

export function useFailedPaymentsQuery() {
  return useQuery({
    queryKey: queryKeys.failedPayments,
    queryFn: getFailedPaymentOrders,
    staleTime: 15 * 1000,
  });
}

export function useCashierTodayOrdersQuery(cashierId?: string) {
  return useQuery({
    queryKey: queryKeys.cashierTodayOrders(cashierId ?? ''),
    enabled: Boolean(cashierId),
    queryFn: () => getCashierTodayOrders(cashierId!),
    staleTime: 10 * 1000,
  });
}

export function useRefundableOrdersQuery() {
  return useQuery({
    queryKey: queryKeys.refundableOrders,
    queryFn: getRefundableOrders,
    staleTime: 15 * 1000,
  });
}

export function useAvailableDeliveriesQuery() {
  return useQuery({
    queryKey: queryKeys.availableDeliveries,
    queryFn: getAvailableDeliveries,
    staleTime: 10 * 1000,
  });
}

export function useTrackOrderQueries(orderId?: string) {
  const [orderQuery, historyQuery, trackingQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.order(orderId ?? ''),
        enabled: Boolean(orderId),
        queryFn: async () => {
          const order = await getOrderById(orderId!);
          if (!order) {
            throw new Error('Order not found.');
          }
          return order;
        },
        staleTime: 10 * 1000,
      },
      {
        queryKey: queryKeys.orderStatusHistory(orderId ?? ''),
        enabled: Boolean(orderId),
        queryFn: () => getOrderStatusHistory(orderId!),
        staleTime: 10 * 1000,
      },
      {
        queryKey: queryKeys.orderTracking(orderId ?? ''),
        enabled: Boolean(orderId),
        queryFn: () => getOrderTrackingPoints(orderId!),
        staleTime: 10 * 1000,
      },
    ],
  });

  return {
    order: (orderQuery.data as Order | undefined) ?? null,
    history: (historyQuery.data ?? []).map((entry) => ({
      status: entry.next_status,
      timestamp: entry.created_at,
    })),
    trackingPoints: trackingQuery.data ?? [],
    isLoading: orderQuery.isLoading || historyQuery.isLoading || trackingQuery.isLoading,
    isFetching: orderQuery.isFetching || historyQuery.isFetching || trackingQuery.isFetching,
  };
}

export function useOrderTrackingQuery(orderId?: string) {
  return useQuery({
    queryKey: queryKeys.orderTracking(orderId ?? ''),
    enabled: Boolean(orderId),
    queryFn: () => getOrderTrackingPoints(orderId!),
    staleTime: 10 * 1000,
  });
}
