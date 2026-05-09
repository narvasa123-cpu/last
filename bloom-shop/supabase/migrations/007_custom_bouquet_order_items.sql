ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'order_items_product_id_fkey'
        AND conrelid = 'public.order_items'::regclass
    )
  THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id);
  END IF;
END $$;

ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custom_bouquet JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_product_or_custom_check'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_or_custom_check
      CHECK (product_id IS NOT NULL OR custom_bouquet IS NOT NULL)
      NOT VALID;
  END IF;
END $$;
