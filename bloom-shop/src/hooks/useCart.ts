import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useCartStore } from '../store/cartStore';
import { applyCouponDiscount, calculateSubtotal, calcPoints, getDeliveryFee } from '../lib/utils';

export function useCart() {
  const {
    items,
    isOpen,
    coupon,
    rewardPointsApplied,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    toggleDrawer,
    setCoupon,
    setRewardPointsApplied,
  } = useCartStore(
    useShallow((state) => ({
      items: state.items,
      isOpen: state.isOpen,
      coupon: state.coupon,
      rewardPointsApplied: state.rewardPointsApplied,
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateQuantity: state.updateQuantity,
      clearCart: state.clearCart,
      toggleDrawer: state.toggleDrawer,
      setCoupon: state.setCoupon,
      setRewardPointsApplied: state.setRewardPointsApplied,
    })),
  );

  const totals = useMemo(() => {
    const subtotal = calculateSubtotal(items);
    const deliveryFee = getDeliveryFee(subtotal);
    const couponDiscount = applyCouponDiscount(subtotal, coupon);
    const pointsDiscount = rewardPointsApplied;
    const discount = Math.min(subtotal + deliveryFee, couponDiscount + pointsDiscount);
    const total = Math.max(0, subtotal + deliveryFee - discount);

    return {
      count: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      deliveryFee,
      couponDiscount,
      pointsDiscount,
      discount,
      total,
      pointsToEarn: calcPoints(total),
    };
  }, [coupon, items, rewardPointsApplied]);

  return {
    items,
    isOpen,
    coupon,
    rewardPointsApplied,
    totals,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    toggleDrawer,
    setCoupon,
    setRewardPointsApplied,
  };
}
