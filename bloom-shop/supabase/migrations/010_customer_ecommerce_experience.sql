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
    WHERE user_id = NEW.user_id
      AND id <> NEW.id;
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
