-- ============================================
-- Bloom Shop: Consolidated Schema Fix
-- Run this in the Supabase Dashboard SQL Editor
-- ============================================

-- 1. ORDER STATUS HISTORY (migration 002)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status     TEXT NOT NULL
                  CHECK (next_status IN ('pending', 'confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered', 'cancelled')),
  changed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON public.order_status_history(order_id, created_at DESC);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stakeholders read order status history" ON public.order_status_history;
CREATE POLICY "stakeholders read order status history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.rider_id = auth.uid()
        OR o.cashier_id = auth.uid()
        OR public.has_role(ARRAY['admin'])
      )
  )
);

DROP POLICY IF EXISTS "admins manage order status history" ON public.order_status_history;
CREATE POLICY "admins manage order status history"
ON public.order_status_history
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

-- 2. REALTIME PUBLICATION (migration 004)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coupons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
  END IF;
END;
$$;

-- 3. PERFORMANCE INDEXES (migration 005)
CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rider_status_updated_at ON public.orders(rider_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cashier_payment_status_created_at ON public.orders(cashier_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_available_delivery_queue ON public.orders(status, created_at DESC) WHERE rider_id IS NULL AND status IN ('confirmed', 'preparing');
CREATE INDEX IF NOT EXISTS idx_orders_pending_payment_queue ON public.orders(payment_status, created_at DESC) WHERE payment_status IN ('unpaid', 'pending');
CREATE INDEX IF NOT EXISTS idx_payments_order_status_created_at ON public.payments(order_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_created_at ON public.delivery_tracking(order_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_rewards_log_user_created_at ON public.rewards_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role_active_created_at ON public.users(role_id, is_active, created_at DESC);

-- 4. CASHIER VISIBILITY (migration 006)
DROP POLICY IF EXISTS "cashiers read operational orders" ON public.orders;
CREATE POLICY "cashiers read operational orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['cashier']));

DROP POLICY IF EXISTS "cashiers read payment queue records" ON public.payments;
CREATE POLICY "cashiers read payment queue records"
ON public.payments
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['cashier']));

-- 5. ORDER ITEMS: CUSTOM BOUQUET (migration 007)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'order_items_product_id_fkey' AND conrelid = 'public.order_items'::regclass
    )
  THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id);
  END IF;
END;
$$;

ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS custom_bouquet JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_product_or_custom_check' AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_or_custom_check
      CHECK (product_id IS NOT NULL OR custom_bouquet IS NOT NULL)
      NOT VALID;
  END IF;
END;
$$;

-- 6. ADMIN OPERATIONS / STOCK CHANGE LOGS (migration 008)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_internal_note TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.stock_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  previous_stock INT NOT NULL,
  next_stock INT NOT NULL,
  delta INT NOT NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_change_logs_product_created_at ON public.stock_change_logs(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_hidden_rating_created_at ON public.reviews(is_hidden, rating, created_at DESC);

DROP TRIGGER IF EXISTS trg_stock_change_logs_updated_at ON public.stock_change_logs;
CREATE TRIGGER trg_stock_change_logs_updated_at
BEFORE UPDATE ON public.stock_change_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stock_change_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read stock change logs" ON public.stock_change_logs;
CREATE POLICY "admins read stock change logs"
ON public.stock_change_logs
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "admins write stock change logs" ON public.stock_change_logs;
CREATE POLICY "admins write stock change logs"
ON public.stock_change_logs
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

-- 7. RIDER DELIVERY SUITE (migration 009)
CREATE TABLE IF NOT EXISTS public.delivery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('wrong_address', 'customer_unreachable', 'damaged_bouquet', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_photos_order_created_at ON public.delivery_photos(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_photos_rider_created_at ON public.delivery_photos(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_order_created_at ON public.delivery_issues(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_rider_created_at ON public.delivery_issues(rider_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_delivery_photos_updated_at ON public.delivery_photos;
CREATE TRIGGER trg_delivery_photos_updated_at
BEFORE UPDATE ON public.delivery_photos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_issues_updated_at ON public.delivery_issues;
CREATE TRIGGER trg_delivery_issues_updated_at
BEFORE UPDATE ON public.delivery_issues
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.delivery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read delivery photos" ON public.delivery_photos;
CREATE POLICY "admins read delivery photos"
ON public.delivery_photos
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "customers read own delivery photos" ON public.delivery_photos;
CREATE POLICY "customers read own delivery photos"
ON public.delivery_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_photos.order_id
      AND o.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "riders read assigned delivery photos" ON public.delivery_photos;
CREATE POLICY "riders read assigned delivery photos"
ON public.delivery_photos
FOR SELECT
TO authenticated
USING (
  rider_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_photos.order_id AND o.rider_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "riders create delivery photos" ON public.delivery_photos;
CREATE POLICY "riders create delivery photos"
ON public.delivery_photos
FOR INSERT
TO authenticated
WITH CHECK (
  rider_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_photos.order_id AND o.rider_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "admins read delivery issues" ON public.delivery_issues;
CREATE POLICY "admins read delivery issues"
ON public.delivery_issues
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "riders read own delivery issues" ON public.delivery_issues;
CREATE POLICY "riders read own delivery issues"
ON public.delivery_issues
FOR SELECT
TO authenticated
USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "riders create delivery issues" ON public.delivery_issues;
CREATE POLICY "riders create delivery issues"
ON public.delivery_issues
FOR INSERT
TO authenticated
WITH CHECK (
  rider_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_issues.order_id AND o.rider_id = auth.uid()
  )
);

-- Delivery photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-photos',
  'delivery-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "delivery photos are publicly readable" ON storage.objects;
CREATE POLICY "delivery photos are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'delivery-photos');

DROP POLICY IF EXISTS "riders upload delivery photos" ON storage.objects;
CREATE POLICY "riders upload delivery photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos'
  AND public.has_role(ARRAY['rider'])
);

-- Delivery issue notification function
CREATE OR REPLACE FUNCTION public.handle_delivery_issue_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'Delivery issue reported',
    'Order #' || left(NEW.order_id::text, 8) || ': ' || replace(NEW.reason, '_', ' '),
    'order'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_issue_notification ON public.delivery_issues;
CREATE TRIGGER trg_delivery_issue_notification
AFTER INSERT ON public.delivery_issues
FOR EACH ROW
EXECUTE FUNCTION public.handle_delivery_issue_notification();

-- 8. CUSTOMER ECOMMERCE / DELIVERY ADDRESSES (migration 010)
CREATE TABLE IF NOT EXISTS public.delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  recipient_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL,
  delivery_notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_default
  ON public.delivery_addresses(user_id, is_default DESC, created_at DESC);

ALTER TABLE public.delivery_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own delivery addresses" ON public.delivery_addresses;
CREATE POLICY "users manage own delivery addresses"
ON public.delivery_addresses
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_delivery_addresses_updated_at ON public.delivery_addresses;
CREATE TRIGGER trg_delivery_addresses_updated_at
BEFORE UPDATE ON public.delivery_addresses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_single_default_delivery_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.delivery_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_default_delivery_address ON public.delivery_addresses;
CREATE TRIGGER trg_single_default_delivery_address
AFTER INSERT OR UPDATE OF is_default ON public.delivery_addresses
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_delivery_address();

CREATE OR REPLACE FUNCTION public.notify_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('confirmed', 'picked_up', 'on_the_way', 'delivered') THEN
    RETURN NEW;
  END IF;
  status_label := REPLACE(NEW.status::TEXT, '_', ' ');
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.customer_id,
    'Order ' || status_label,
    'Your order #' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8) || ' is now ' || status_label || '.',
    'order'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_order_status_notification ON public.orders;
CREATE TRIGGER trg_customer_order_status_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_order_status();

-- 9. REPAIR ORDER STATUS HISTORY FK (migration 011)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.order_status_history'::regclass
      AND c.confrelid = 'public.orders'::regclass
      AND a.attname = 'order_id'
  ) THEN
    ALTER TABLE public.order_status_history
      ADD CONSTRAINT order_status_history_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.order_status_history VALIDATE CONSTRAINT order_status_history_order_id_fkey;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created_at
  ON public.order_status_history(order_id, created_at DESC);

-- 10. REPAIR DELIVERY FKs (migration 012)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.delivery_photos'::regclass
      AND c.confrelid = 'public.orders'::regclass
      AND a.attname = 'order_id'
  ) THEN
    ALTER TABLE public.delivery_photos
      ADD CONSTRAINT delivery_photos_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.delivery_photos VALIDATE CONSTRAINT delivery_photos_order_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.delivery_issues'::regclass
      AND c.confrelid = 'public.orders'::regclass
      AND a.attname = 'order_id'
  ) THEN
    ALTER TABLE public.delivery_issues
      ADD CONSTRAINT delivery_issues_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE NOT VALID;
    ALTER TABLE public.delivery_issues VALIDATE CONSTRAINT delivery_issues_order_id_fkey;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_delivery_photos_order_created_at ON public.delivery_photos(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_issues_order_created_at ON public.delivery_issues(order_id, created_at DESC);

-- 11. CASHIER POS / REFUNDS (migration 013)
ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'gcash', 'card', 'cash'));

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cod', 'gcash', 'card', 'cash'));

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  reason TEXT NOT NULL,
  restore_stock BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_refunds_updated_at ON public.refunds;
CREATE TRIGGER trg_refunds_updated_at
BEFORE UPDATE ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_walk_in_cashier_created_at ON public.orders(is_walk_in, cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_cashier_created_at ON public.refunds(cashier_id, created_at DESC);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cashiers create walk in orders" ON public.orders;
CREATE POLICY "cashiers create walk in orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(ARRAY['cashier'])
  AND is_walk_in = true
  AND cashier_id = auth.uid()
  AND customer_id IS NULL
);

DROP POLICY IF EXISTS "cashiers adjust product stock" ON public.products;
CREATE POLICY "cashiers adjust product stock"
ON public.products
FOR UPDATE
TO authenticated
USING (public.has_role(ARRAY['cashier', 'admin']))
WITH CHECK (public.has_role(ARRAY['cashier', 'admin']));

DROP POLICY IF EXISTS "cashiers insert payments" ON public.payments;
CREATE POLICY "cashiers insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(ARRAY['cashier', 'admin']));

DROP POLICY IF EXISTS "cashiers read refunds" ON public.refunds;
CREATE POLICY "cashiers read refunds"
ON public.refunds
FOR SELECT
TO authenticated
USING (
  cashier_id = auth.uid()
  OR public.has_role(ARRAY['admin'])
);

DROP POLICY IF EXISTS "cashiers create refunds" ON public.refunds;
CREATE POLICY "cashiers create refunds"
ON public.refunds
FOR INSERT
TO authenticated
WITH CHECK (
  cashier_id = auth.uid()
  AND public.has_role(ARRAY['cashier', 'admin'])
);

DROP POLICY IF EXISTS "admins manage refunds" ON public.refunds;
CREATE POLICY "admins manage refunds"
ON public.refunds
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
