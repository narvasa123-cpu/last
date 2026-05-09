DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL
    OR to_regclass('public.delivery_photos') IS NULL
    OR to_regclass('public.delivery_issues') IS NULL
  THEN
    RAISE EXCEPTION
      'Delivery relationship repair requires public.orders, public.delivery_photos, and public.delivery_issues.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.delivery_photos'::regclass
      AND c.confrelid = 'public.orders'::regclass
      AND a.attname = 'order_id'
  ) THEN
    ALTER TABLE public.delivery_photos
      ADD CONSTRAINT delivery_photos_order_id_fkey
      FOREIGN KEY (order_id)
      REFERENCES public.orders(id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.delivery_photos
      VALIDATE CONSTRAINT delivery_photos_order_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.delivery_issues'::regclass
      AND c.confrelid = 'public.orders'::regclass
      AND a.attname = 'order_id'
  ) THEN
    ALTER TABLE public.delivery_issues
      ADD CONSTRAINT delivery_issues_order_id_fkey
      FOREIGN KEY (order_id)
      REFERENCES public.orders(id)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.delivery_issues
      VALIDATE CONSTRAINT delivery_issues_order_id_fkey;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_photos_order_created_at
  ON public.delivery_photos(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_issues_order_created_at
  ON public.delivery_issues(order_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
