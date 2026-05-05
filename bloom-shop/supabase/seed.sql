-- Bloom Shop seed data
-- Supabase will pick up supabase/seed.sql by default during `supabase db reset`.

INSERT INTO public.products (
  id,
  name,
  description,
  category,
  price,
  image_url,
  stock,
  is_featured,
  avg_rating,
  review_count
)
VALUES
  (
    '90000000-0000-4000-8000-000000000001',
    'Rose Sonata',
    'A lush blend of garden roses, ranunculus, and soft eucalyptus in a wrapped signature bundle.',
    'roses',
    1890,
    'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=80',
    18,
    true,
    4.90,
    128
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    'Blush Cloud',
    'Peonies, lisianthus, and blush spray roses arranged with a gallery-like color balance.',
    'mixed',
    2450,
    'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80',
    11,
    true,
    4.80,
    92
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    'Tulip Letter',
    'Minimal tulip arrangement with layered wrapping for a crisp, editorial silhouette.',
    'tulips',
    1590,
    'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=1200&q=80',
    26,
    true,
    4.70,
    61
  ),
  (
    '90000000-0000-4000-8000-000000000004',
    'Sunlit Bloom',
    'Sunflowers, yellow roses, and chamomile for bright celebration energy.',
    'sunflowers',
    1490,
    'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80',
    34,
    false,
    4.60,
    49
  ),
  (
    '90000000-0000-4000-8000-000000000005',
    'Orchid Whisper',
    'Phalaenopsis stems with layered neutral wrapping and pearl accents.',
    'orchids',
    2890,
    'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=1200&q=80',
    7,
    true,
    5.00,
    84
  ),
  (
    '90000000-0000-4000-8000-000000000006',
    'Velvet Vow',
    'Long-stem premium roses in deep magenta with satin ribbon detailing.',
    'roses',
    3290,
    'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1200&q=80',
    5,
    false,
    4.90,
    144
  ),
  (
    '90000000-0000-4000-8000-000000000007',
    'Dawn Tulips',
    'Pastel tulips in layered tones with soft blush wrap and note card.',
    'tulips',
    1720,
    'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=1200&q=80',
    16,
    false,
    4.50,
    37
  ),
  (
    '90000000-0000-4000-8000-000000000008',
    'Golden Hour',
    'Sunflowers, peach carnations, and soft greenery in a warm palette.',
    'sunflowers',
    1360,
    'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
    24,
    false,
    4.40,
    28
  ),
  (
    '90000000-0000-4000-8000-000000000009',
    'Garden Story',
    'A mixed bouquet with hydrangeas, roses, tulips, and premium foliage.',
    'mixed',
    2150,
    'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80',
    12,
    true,
    4.80,
    76
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url,
  stock = EXCLUDED.stock,
  is_featured = EXCLUDED.is_featured,
  avg_rating = EXCLUDED.avg_rating,
  review_count = EXCLUDED.review_count,
  updated_at = now();

INSERT INTO public.coupons (
  id,
  code,
  discount_type,
  discount_value,
  min_order,
  max_uses,
  used_count,
  expires_at,
  is_active
)
VALUES
  (
    '91000000-0000-4000-8000-000000000001',
    'BLOOM10',
    'percent',
    10,
    1000,
    500,
    141,
    '2026-05-31T23:59:59.000Z',
    true
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'FREESHIP',
    'fixed',
    99,
    1200,
    300,
    188,
    '2026-06-15T23:59:59.000Z',
    true
  )
ON CONFLICT (code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  min_order = EXCLUDED.min_order,
  max_uses = EXCLUDED.max_uses,
  used_count = EXCLUDED.used_count,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active,
  updated_at = now();
