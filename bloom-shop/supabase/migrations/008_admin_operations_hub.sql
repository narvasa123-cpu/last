DO $$
BEGIN
  IF to_regclass('public.products') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.orders') IS NULL
    OR to_regclass('public.reviews') IS NULL
    OR to_regclass('public.notifications') IS NULL
    OR to_regclass('public.payments') IS NULL
    OR to_regclass('public.activity_logs') IS NULL
  THEN
    RAISE EXCEPTION
      'Bloom Shop base schema is missing. Apply supabase/migrations/001_schema.sql and the earlier migrations before 008_admin_operations_hub.sql.';
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_internal_note TEXT;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

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

CREATE INDEX IF NOT EXISTS idx_stock_change_logs_product_created_at
  ON public.stock_change_logs(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_hidden_rating_created_at
  ON public.reviews(is_hidden, rating, created_at DESC);

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

CREATE OR REPLACE FUNCTION public.notify_admins(notification_title TEXT, notification_message TEXT, notification_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT u.id, notification_title, notification_message, notification_type
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE r.name = 'admin'
    AND u.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_admin_new_order_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'New order received',
    'Order #' || left(NEW.id::text, 8) || ' needs review.',
    'order'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_admin_low_stock_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock <= 12 AND (TG_OP = 'INSERT' OR OLD.stock IS DISTINCT FROM NEW.stock) THEN
    PERFORM public.notify_admins(
      'Low stock alert',
      NEW.name || ' has ' || NEW.stock || ' stems remaining.',
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_admin_payment_failure_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.notify_admins(
      'Payment verification failed',
      'Payment for order #' || left(NEW.order_id::text, 8) || ' needs attention.',
      'order'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_new_order_notification ON public.orders;
CREATE TRIGGER trg_admin_new_order_notification
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_new_order_notification();

DROP TRIGGER IF EXISTS trg_admin_low_stock_notification ON public.products;
CREATE TRIGGER trg_admin_low_stock_notification
AFTER INSERT OR UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_low_stock_notification();

DROP TRIGGER IF EXISTS trg_admin_payment_failure_notification ON public.payments;
CREATE TRIGGER trg_admin_payment_failure_notification
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_payment_failure_notification();

CREATE OR REPLACE FUNCTION public.log_admin_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_name TEXT;
BEGIN
  action_name := TG_TABLE_NAME || '.' || lower(TG_OP);

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    action_name,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record_id', COALESCE(NEW.id, OLD.id),
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_orders ON public.orders;
CREATE TRIGGER trg_activity_orders
AFTER UPDATE OF status, payment_status, admin_internal_note, rider_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_activity();

DROP TRIGGER IF EXISTS trg_activity_products ON public.products;
CREATE TRIGGER trg_activity_products
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_activity();

DROP TRIGGER IF EXISTS trg_activity_users ON public.users;
CREATE TRIGGER trg_activity_users
AFTER UPDATE OF role_id, is_active ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_activity();

DROP TRIGGER IF EXISTS trg_activity_coupons ON public.coupons;
CREATE TRIGGER trg_activity_coupons
AFTER INSERT OR UPDATE OR DELETE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.log_admin_activity();
