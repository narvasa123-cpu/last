import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CartLine, Coupon, Product } from '../lib/types';

interface CartState {
  items: CartLine[];
  isOpen: boolean;
  coupon: Coupon | null;
  rewardPointsApplied: number;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleDrawer: (value?: boolean) => void;
  setCoupon: (coupon: Coupon | null) => void;
  setRewardPointsApplied: (points: number) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      coupon: null,
      rewardPointsApplied: 0,
      addItem: (product, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((item) => item.product.id === product.id);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              ),
            };
          }
          return { items: [...state.items, { product, quantity }] };
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.product.id !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.product.id !== productId)
              : state.items.map((item) =>
                  item.product.id === productId ? { ...item, quantity } : item,
                ),
        })),
      clearCart: () => set({ items: [], coupon: null, rewardPointsApplied: 0 }),
      toggleDrawer: (value) =>
        set((state) => ({ isOpen: typeof value === 'boolean' ? value : !state.isOpen })),
      setCoupon: (coupon) => set({ coupon }),
      setRewardPointsApplied: (rewardPointsApplied) => set({ rewardPointsApplied }),
    }),
    {
      name: 'bloom-shop-cart',
      partialize: (state) => ({
        items: state.items,
        coupon: state.coupon,
        rewardPointsApplied: state.rewardPointsApplied,
      }),
    },
  ),
);
