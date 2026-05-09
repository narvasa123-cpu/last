DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL
    OR to_regclass('public.order_items') IS NULL
    OR to_regclass('public.products') IS NULL
    OR to_regclass('public.payments') IS NULL
    OR to_regclass('public.users') IS NULL
  THEN
    RAISE EXCEPTION
      'Cashier POS operations require orders, order_items, products, payments, and users.';
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_orders_walk_in_cashier_created_at
  ON public.orders(is_walk_in, cashier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_cashier_created_at
  ON public.refunds(cashier_id, created_at DESC);

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

NOTIFY pgrst, 'reload schema';
