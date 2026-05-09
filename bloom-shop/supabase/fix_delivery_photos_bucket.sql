-- Fix: Create the missing delivery-photos storage bucket
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

-- Allow public reads for delivery proof images
DROP POLICY IF EXISTS "delivery photos are publicly readable" ON storage.objects;
CREATE POLICY "delivery photos are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'delivery-photos');

-- Allow riders to upload delivery photos
DROP POLICY IF EXISTS "riders upload delivery photos" ON storage.objects;
CREATE POLICY "riders upload delivery photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos'
  AND public.has_role(ARRAY['rider'])
);
