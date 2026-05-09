DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.notifications') IS NULL
  THEN
    RAISE EXCEPTION
      'Bloom Shop base schema is missing. Apply earlier migrations before 009_rider_delivery_suite.sql.';
  END IF;
END $$;

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

CREATE INDEX IF NOT EXISTS idx_delivery_photos_order_created_at
  ON public.delivery_photos(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_photos_rider_created_at
  ON public.delivery_photos(rider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_issues_order_created_at
  ON public.delivery_issues(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_issues_rider_created_at
  ON public.delivery_issues(rider_id, created_at DESC);

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
    WHERE o.id = delivery_photos.order_id
      AND o.rider_id = auth.uid()
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
    WHERE o.id = delivery_photos.order_id
      AND o.rider_id = auth.uid()
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
    WHERE o.id = delivery_issues.order_id
      AND o.rider_id = auth.uid()
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-photos',
  'delivery-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
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
