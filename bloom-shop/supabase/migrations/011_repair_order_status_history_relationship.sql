DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL
    OR to_regclass('public.order_status_history') IS NULL
  THEN
    RAISE EXCEPTION
      'Order status history relationship repair requires public.orders and public.order_status_history.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.order_status_history'::regclass
      AND c.confrelid = 'public.orders'::regclass
      AND a.attname = 'order_id'
  ) THEN
    ALTER TABLE public.order_status_history
      ADD CONSTRAINT order_status_history_order_id_fkey
      FOREIGN KEY (order_id)
      REFERENCES public.orders(id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.order_status_history
      VALIDATE CONSTRAINT order_status_history_order_id_fkey;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created_at
  ON public.order_status_history(order_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
