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

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID;
BEGIN
  actor_id := COALESCE(auth.uid(), NEW.cashier_id, NEW.rider_id, NEW.customer_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, previous_status, next_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, actor_id, 'Order created');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, previous_status, next_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, actor_id, NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_after_insert ON public.orders;
CREATE TRIGGER trg_log_order_status_after_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

DROP TRIGGER IF EXISTS trg_log_order_status_after_update ON public.orders;
CREATE TRIGGER trg_log_order_status_after_update
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_order_status_change();

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "admins manage order status history"
ON public.order_status_history
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['admin']))
WITH CHECK (public.has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "staff update orders" ON public.orders;

CREATE POLICY "staff update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  public.has_role(ARRAY['admin'])
  OR rider_id = auth.uid()
  OR cashier_id = auth.uid()
  OR (public.has_role(ARRAY['rider']) AND rider_id IS NULL AND status IN ('confirmed', 'preparing'))
  OR (public.has_role(ARRAY['cashier']) AND cashier_id IS NULL)
)
WITH CHECK (
  public.has_role(ARRAY['admin'])
  OR rider_id = auth.uid()
  OR cashier_id = auth.uid()
);

DROP POLICY IF EXISTS "cashiers and admins manage payments" ON public.payments;

CREATE POLICY "customers create own payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_id
      AND o.customer_id = auth.uid()
  )
);

CREATE POLICY "cashiers and admins update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (public.has_role(ARRAY['admin', 'cashier']))
WITH CHECK (public.has_role(ARRAY['admin', 'cashier']));

CREATE POLICY "cashiers and admins delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['admin', 'cashier']));
