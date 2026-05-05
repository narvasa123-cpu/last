CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at
  ON public.orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_rider_status_updated_at
  ON public.orders(rider_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_cashier_payment_status_created_at
  ON public.orders(cashier_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_available_delivery_queue
  ON public.orders(status, created_at DESC)
  WHERE rider_id IS NULL
    AND status IN ('confirmed', 'preparing');

CREATE INDEX IF NOT EXISTS idx_orders_pending_payment_queue
  ON public.orders(payment_status, created_at DESC)
  WHERE payment_status IN ('unpaid', 'pending');

CREATE INDEX IF NOT EXISTS idx_payments_order_status_created_at
  ON public.payments(order_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_created_at
  ON public.delivery_tracking(order_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rewards_log_user_created_at
  ON public.rewards_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role_active_created_at
  ON public.users(role_id, is_active, created_at DESC);
