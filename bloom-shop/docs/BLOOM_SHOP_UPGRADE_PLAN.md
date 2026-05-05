# Bloom Shop Upgrade Plan

## 1. Current State Assessment

The current app already has a strong foundation:

- Floral visual direction is already present in the global design system and homepage composition.
- Protected routes already exist for `admin`, `customer`, `rider`, and `cashier`.
- Checkout, wishlist, reviews, notifications, dashboards, and tracking pages already exist in the UI.
- Supabase schema already covers roles, users, products, orders, payments, reviews, rewards, tracking, and notifications.

Main gaps in the current implementation:

- The project is not using Tailwind right now. It is a React + Vite + custom CSS app.
- Several operational screens still depend on `MOCK_*` constants or local component state instead of live Supabase data.
- Demo-mode auth and data fallback are deeply wired into the runtime, which is useful for previewing the UI but weak for production behavior.
- Wishlist is stored in `localStorage`, not in Supabase.
- Order tracking uses a generated timeline and a mock map instead of persisted status events and realtime updates.
- Some RLS policies are too permissive and allow customers to update sensitive order and payment records.

## 2. What Is Already Implemented

### UI / UX

- Premium homepage shell with hero, featured products, categories, testimonials, and skeleton loading.
- Responsive layouts for dashboard, shop, product detail, cart, checkout, and tracking pages.
- Shared design primitives for cards, buttons, badges, inputs, modal, skeleton, and toast.

### Role System

- `AuthGuard` already blocks routes by role.
- Role-aware sidebars and dashboards already exist.
- Auth can run against Supabase or a local demo profile.

### Customer Features

- Product browsing with search, filter, sort, wishlist toggle, and reviews.
- Checkout flow with delivery schedule, payment selection, coupon entry, and reward points slider.
- Order history and tracking pages.

### Admin / Rider / Cashier

- Admin dashboard and management pages exist.
- Rider dashboard, active delivery page, and delivery history pages exist.
- Cashier dashboard, payment confirmation, and walk-in order pages exist.

## 3. Highest Priority Fixes

1. Replace mock operational data with Supabase on all admin, rider, and cashier flows.
2. Tighten RLS so customers cannot update arbitrary order and payment fields.
3. Persist wishlist, coupon redemption, delivery acceptance, and order status history in the database.
4. Add realtime subscriptions for order status, rider assignment, and cashier payment verification.
5. Separate feature logic from static demo constants so production code paths are easier to reason about.

## 4. Component-Level UI Improvements

### Homepage

- Keep the current hero, but make the featured bouquet the clear focal point with one dominant image card, one CTA, and one secondary CTA.
- Add a best-sellers band directly below the hero instead of relying only on the carousel.
- Add occasion chips: `Birthday`, `Anniversary`, `Sympathy`, `Graduation`, `Same Day`.
- Add a premium reassurance strip: same-day delivery, handcrafted wrapping, loyalty points, verified reviews.

### Product Grid / Product Cards

- Add hover image zoom plus quick actions: `Add to cart`, `Wishlist`, `Preview`.
- Show stock urgency on low stock items.
- Add delivery promise badges such as `Same Day`, `Best Seller`, `New`.
- Use consistent price, rating, and CTA alignment so cards do not visually jump.

### Shop / Filters

- Convert filters into a sticky desktop rail and a bottom sheet on mobile.
- Add filter chips above the product grid to show active filters with one-tap removal.
- Defer search updates to reduce rerenders while typing.
- Add empty states by category, not just one generic empty state.

### Cart / Checkout

- Keep the existing 3-step checkout, but add:
  - Address book presets
  - disabled time slots for past times
  - a delivery fee explanation
  - coupon validation states
  - clearer payment proof upload guidance for GCash
- Show reward points earn and spend breakdown in one card.
- Use a compact floating order summary on mobile.

### Order Tracking

- Replace synthetic ETA and generated timestamps with real status events from `order_status_history`.
- Show rider assignment, rider name, accepted time, pickup time, and delivered time.
- Add a milestone progress rail similar to Shopee/Lazada.

### Admin Dashboard

- Keep charts, but back them with real queries:
  - sales by day
  - order count by status
  - top products by revenue
  - low stock items
- Add date presets: `Today`, `7d`, `30d`, `90d`.
- Add KPI cards with delta vs previous period.

### Rider Dashboard

- Split into `Available`, `Accepted`, and `Completed` tabs.
- Add pickup notes, recipient contact, and proof of delivery action.
- Add accept/reject action states and disable double-claiming.

### Cashier Dashboard

- Show payment queue, walk-in queue, and receipt history.
- Add payment proof preview for GCash.
- Add receipt details: line items, cashier name, payment reference, change, print timestamp.

## 5. Architecture Improvements

Current structure is page-centric and shared-utility heavy. That is okay for a small app, but this project is now feature-rich enough to benefit from feature folders.

### Recommended Structure

```text
src/
  app/
    router/
    providers/
  features/
    auth/
      components/
      hooks/
      services/
    catalog/
      components/
      hooks/
      services/
    cart/
      components/
      store/
    checkout/
      components/
      hooks/
      services/
    orders/
      components/
      hooks/
      services/
    rewards/
      components/
      hooks/
    admin/
      components/
      pages/
      services/
    rider/
      components/
      pages/
      services/
    cashier/
      components/
      pages/
      services/
  shared/
    components/
    styles/
    utils/
    types/
  services/
    supabase/
      client.ts
      queries.ts
      mutations.ts
      channels.ts
```

### Why This Structure Fits Bloom Shop

- Keeps domain logic near the pages that use it.
- Stops `lib/constants.ts` from becoming the app's fake backend.
- Makes it easier to test admin, rider, and cashier flows independently.
- Makes future migration to React Query or server actions easier if needed later.

## 6. Database Improvements

The current schema is a solid base, but it needs better operational modeling and policy hardening.

### Problems in the Current Schema

- Customers can update their own orders via the `staff update orders` policy. That is too broad.
- Customers are effectively allowed to manage payments through the `cashiers and admins manage payments` policy because order ownership is accepted in `USING` and `WITH CHECK`.
- Profiles are globally readable to any authenticated user.
- Reviews are not tied to completed purchases.
- Wishlist exists in schema, but the app currently stores wishlist IDs in local storage.
- There is no dedicated order status history table.
- There is no coupon redemption table to enforce per-user usage.
- There is no delivery assignment table for accept/reject lifecycle.

### Suggested Additive Migration

```sql
-- 002_hardening_and_operations.sql

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  points_per_currency numeric(10, 2) not null default 100,
  peso_discount_per_point numeric(10, 2) not null default 1,
  bronze_min int not null default 0,
  silver_min int not null default 500,
  gold_min int not null default 1500,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, user_id, order_id)
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  rider_id uuid references public.users(id) on delete set null,
  status text not null default 'unassigned'
    check (status in ('unassigned', 'offered', 'accepted', 'rejected', 'picked_up', 'on_the_way', 'delivered')),
  offered_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  eta_minutes int,
  proof_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status text,
  next_status text not null,
  changed_by uuid references public.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.payments
  add constraint payments_order_id_unique unique (order_id);

alter table public.order_items
  add column if not exists product_name_snapshot text,
  add column if not exists product_image_snapshot text;

update public.order_items oi
set
  product_name_snapshot = p.name,
  product_image_snapshot = p.image_url
from public.products p
where p.id = oi.product_id
  and (oi.product_name_snapshot is null or oi.product_image_snapshot is null);

create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_customer_created on public.orders(customer_id, created_at desc);
create index if not exists idx_payments_status on public.payments(status, created_at desc);
create index if not exists idx_deliveries_rider_status on public.deliveries(rider_id, status);
create index if not exists idx_order_status_history_order_created on public.order_status_history(order_id, created_at desc);
create index if not exists idx_coupon_redemptions_user_coupon on public.coupon_redemptions(user_id, coupon_id);
```

### RLS Hardening

```sql
-- Restrict order updates to staff only.
drop policy if exists "staff update orders" on public.orders;

create policy "staff update orders"
on public.orders
for update
to authenticated
using (
  rider_id = auth.uid()
  or cashier_id = auth.uid()
  or public.has_role(array['admin'])
)
with check (
  rider_id = auth.uid()
  or cashier_id = auth.uid()
  or public.has_role(array['admin'])
);

-- Customers may insert payments but should not verify or rewrite them.
drop policy if exists "cashiers and admins manage payments" on public.payments;

create policy "customers create own pending payments"
on public.payments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.customer_id = auth.uid()
  )
);

create policy "cashiers and admins manage payments"
on public.payments
for update
to authenticated
using (public.has_role(array['admin', 'cashier']))
with check (public.has_role(array['admin', 'cashier']));

create policy "cashiers and admins delete payments"
on public.payments
for delete
to authenticated
using (public.has_role(array['admin', 'cashier']));

-- Limit profile exposure.
drop policy if exists "users can read profiles" on public.users;

create policy "users read own profile and staff read assigned users"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or public.has_role(array['admin', 'cashier', 'rider'])
);
```

### Optional Review Integrity Rule

```sql
alter table public.reviews
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create unique index if not exists idx_reviews_unique_user_product
  on public.reviews(user_id, product_id);
```

## 7. Example React Improvements

### A. Realtime Order Subscription

Use a dedicated hook instead of generating fake order progress in the page.

```tsx
import { useEffect, useState } from 'react';

import { supabase } from '../../services/supabase/client';
import type { Order } from '../../shared/types';

export function useRealtimeOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('orders')
        .select('*, deliveries(*), order_status_history(*)')
        .eq('id', orderId)
        .single();

      if (active) {
        setOrder(data);
        setLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${orderId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { order, loading };
}
```

### B. Deferred Search for Shop Performance

This reduces expensive re-filtering while the user is typing.

```tsx
import { useDeferredValue, useMemo, useState } from 'react';

export function useProductSearch(products: Product[]) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const filteredProducts = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return products.filter((product) => {
      if (!normalized) return true;
      return (
        product.name.toLowerCase().includes(normalized) ||
        product.description.toLowerCase().includes(normalized)
      );
    });
  }, [deferredQuery, products]);

  return { query, setQuery, filteredProducts };
}
```

### C. Centralized Role Access

Current route protection works, but access rules should live in one config object.

```tsx
const accessMatrix = {
  admin: ['/admin', '/admin/products', '/admin/orders', '/admin/users', '/admin/coupons', '/admin/reports'],
  customer: ['/customer/cart', '/customer/checkout', '/customer/orders', '/customer/wishlist', '/customer/rewards'],
  rider: ['/rider', '/rider/active', '/rider/history'],
  cashier: ['/cashier', '/cashier/payments', '/cashier/walk-in'],
} as const;

export function canAccess(role: Role, path: string) {
  return accessMatrix[role].includes(path as never);
}
```

## 8. Performance Recommendations

- Replace repeated `useEffect + useState` fetch patterns with feature hooks so list pages share one query path.
- Keep lazy-loaded routes, but lazy-load heavier dashboard widgets too.
- Use `useDeferredValue` for search-heavy pages.
- Move static image URLs and feature copy into smaller domain files instead of a single large constants file.
- Avoid loading full relational order payloads unless the page needs them.
- Use filtered Supabase selects for admin tables instead of fetching everything and filtering in the client.

## 9. Recommended Implementation Order

1. RLS hardening and operational tables
2. Realtime orders, deliveries, and cashier updates
3. Replace mock data in admin, rider, and cashier pages
4. Persist wishlist and coupon redemption
5. Upgrade analytics queries
6. Refactor into feature folders
7. Polish mobile checkout and premium homepage merchandising

## 10. Codebase-Specific Notes

- Keep the current floral identity. The existing palette and global CSS are already aligned with the brand.
- Do not migrate to Tailwind unless there is a strong team reason. The current app is not using Tailwind, and a forced migration would be expensive without giving product value.
- Keep demo mode, but isolate it behind a `demo` service layer so production pages do not directly import `MOCK_*` data.
