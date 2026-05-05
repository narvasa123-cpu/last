CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.roles (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.roles (id, name)
VALUES
  (1, 'admin'),
  (2, 'customer'),
  (3, 'rider'),
  (4, 'cashier')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

CREATE TABLE public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    INT NOT NULL REFERENCES public.roles(id) DEFAULT 2,
  full_name  TEXT,
  phone      TEXT,
  address    TEXT,
  avatar_url TEXT,
  points     INT NOT NULL DEFAULT 0,
  tier       TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  category     TEXT CHECK (category IN ('roses', 'tulips', 'mixed', 'sunflowers', 'orchids')),
  price        NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url    TEXT,
  stock        INT NOT NULL DEFAULT 100 CHECK (stock >= 0),
  is_featured  BOOLEAN NOT NULL DEFAULT false,
  avg_rating   NUMERIC(3, 2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
  min_order      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  max_uses       INT NOT NULL DEFAULT 100 CHECK (max_uses >= 0),
  used_count     INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rider_id         UUID REFERENCES public.users(id),
  cashier_id       UUID REFERENCES public.users(id),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'preparing', 'picked_up', 'on_the_way', 'delivered', 'cancelled')),
  total_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  delivery_fee     NUMERIC(10, 2) NOT NULL DEFAULT 99 CHECK (delivery_fee >= 0),
  discount_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  coupon_id        UUID REFERENCES public.coupons(id),
  payment_method   TEXT CHECK (payment_method IN ('cod', 'gcash', 'card')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'verified', 'failed', 'paid', 'refunded')),
  delivery_address TEXT,
  delivery_date    DATE,
  delivery_time    TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity   INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal   NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount        NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method        TEXT NOT NULL CHECK (method IN ('cod', 'gcash', 'card')),
  reference_no  TEXT,
  verified_by   UUID REFERENCES public.users(id),
  verified_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rewards_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points       INT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.delivery_tracking (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  latitude    NUMERIC(10, 6),
  longitude   NUMERIC(10, 6),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wishlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('order', 'promo', 'system')),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role_id ON public.users(role_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_featured ON public.products(is_featured);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX idx_orders_cashier_id ON public.orders(cashier_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_rewards_log_user_id ON public.rewards_log(user_id);
CREATE INDEX idx_delivery_tracking_order_id ON public.delivery_tracking(order_id);
CREATE INDEX idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, is_read);

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT r.name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.current_role() = ANY(allowed_roles), false);
$$;

CREATE OR REPLACE FUNCTION public.sync_user_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.points >= 1500 THEN 'Gold'
    WHEN NEW.points >= 500 THEN 'Silver'
    ELSE 'Bronze'
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_product_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_product UUID;
BEGIN
  target_product := COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.reviews
      WHERE product_id = target_product
    ), 0),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE product_id = target_product
    ),
    updated_at = now()
  WHERE id = target_product;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desired_role TEXT;
  resolved_role_id INT;
BEGIN
  desired_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer');

  SELECT id
  INTO resolved_role_id
  FROM public.roles
  WHERE name = desired_role;

  INSERT INTO public.users (id, role_id, full_name, phone, address, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(resolved_role_id, 2),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'address',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_users_sync_tier
BEFORE INSERT OR UPDATE OF points ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_tier();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_order_items_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rewards_log_updated_at
BEFORE UPDATE ON public.rewards_log
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_delivery_tracking_updated_at
BEFORE UPDATE ON public.delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_wishlists_updated_at
BEFORE UPDATE ON public.wishlists
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_activity_logs_updated_at
BEFORE UPDATE ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_refresh_product_rating_after_insert
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_rating();

CREATE TRIGGER trg_refresh_product_rating_after_update
AFTER UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_rating();

CREATE TRIGGER trg_refresh_product_rating_after_delete
AFTER DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_rating();

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles are readable by authenticated users"
ON public.roles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admins manage roles"
ON public.roles
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

CREATE POLICY "users can read profiles"
ON public.users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "users update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.has_role(ARRAY['admin']))
WITH CHECK (id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "admins delete profiles"
ON public.users
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['admin']));

CREATE POLICY "products are publicly readable"
ON public.products
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "admins manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

CREATE POLICY "authenticated users read coupons"
ON public.coupons
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.has_role(ARRAY['admin', 'cashier']));

CREATE POLICY "admins manage coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

CREATE POLICY "customers create own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND public.has_role(ARRAY['customer', 'admin', 'cashier'])
);

CREATE POLICY "stakeholders read related orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR rider_id = auth.uid()
  OR cashier_id = auth.uid()
  OR public.has_role(ARRAY['admin'])
);

CREATE POLICY "staff update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  customer_id = auth.uid()
  OR rider_id = auth.uid()
  OR cashier_id = auth.uid()
  OR public.has_role(ARRAY['admin'])
)
WITH CHECK (
  customer_id = auth.uid()
  OR rider_id = auth.uid()
  OR cashier_id = auth.uid()
  OR public.has_role(ARRAY['admin'])
);

CREATE POLICY "admins delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['admin']));

CREATE POLICY "order items follow order access"
ON public.order_items
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

CREATE POLICY "customers insert own order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.cashier_id = auth.uid()
        OR public.has_role(ARRAY['admin'])
      )
  )
);

CREATE POLICY "staff update order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.cashier_id = auth.uid()
        OR public.has_role(ARRAY['admin'])
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.cashier_id = auth.uid()
        OR public.has_role(ARRAY['admin'])
      )
  )
);

CREATE POLICY "admins delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['admin']));

CREATE POLICY "payments visible to order stakeholders"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.cashier_id = auth.uid()
        OR public.has_role(ARRAY['admin'])
      )
  )
);

CREATE POLICY "cashiers and admins manage payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  public.has_role(ARRAY['admin', 'cashier'])
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND o.customer_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(ARRAY['admin', 'cashier'])
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND o.customer_id = auth.uid()
  )
);

CREATE POLICY "users read own rewards"
ON public.rewards_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "admins manage rewards log"
ON public.rewards_log
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

CREATE POLICY "tracking visible to stakeholders"
ON public.delivery_tracking
FOR SELECT
TO authenticated
USING (
  rider_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.rider_id = auth.uid()
        OR public.has_role(ARRAY['admin'])
      )
  )
);

CREATE POLICY "riders and admins manage tracking"
ON public.delivery_tracking
FOR ALL
TO authenticated
USING (rider_id = auth.uid() OR public.has_role(ARRAY['admin']))
WITH CHECK (rider_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "reviews are publicly readable"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "authenticated users insert reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "users manage own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']))
WITH CHECK (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "users delete own reviews"
ON public.reviews
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "users manage own wishlist"
ON public.wishlists
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']))
WITH CHECK (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "users read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "users update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']))
WITH CHECK (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "staff create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(ARRAY['admin', 'cashier', 'rider'])
  OR user_id = auth.uid()
);

CREATE POLICY "admins delete notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['admin']));

CREATE POLICY "users read own activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "authenticated users insert activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(ARRAY['admin']));

CREATE POLICY "admins manage activity logs"
ON public.activity_logs
FOR UPDATE
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

CREATE POLICY "admins delete activity logs"
ON public.activity_logs
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['admin']));
