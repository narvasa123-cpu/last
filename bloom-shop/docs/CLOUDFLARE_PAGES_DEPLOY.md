# Cloudflare Pages Deployment

This project is prepared for Cloudflare Pages as a static Vite app.

## What was added

- `wrangler.jsonc`
  - Sets the Pages project name to `bloom-shop-production`
  - Sets the build output directory to `dist`
- `public/_headers`
  - Adds browser security headers
  - Adds long cache headers for built assets
- `public/_redirects`
  - Rewrites deep links back to `index.html` so React Router routes survive refresh
- `.node-version`
  - Pins the build image to Node `22`
- `.env.example`
  - Shows the frontend-safe variables required for production builds
- `package.json` scripts
  - `npm run deploy:cloudflare`
  - `npm run deploy:cloudflare:preview`

## Required Cloudflare setup

Create a Cloudflare Pages project named `bloom-shop-production`.

If you deploy from Git:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

Add these environment variables in Cloudflare Pages for both `Production` and `Preview`:

```env
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://qluvfpziaxwsagemxwkz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_NwE2ZHg6n-gI7O4cmem3dg_1xlWdJyh
```

Do not add:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Database passwords

Those must stay server-side only.

## Deploy options

### Option 1: Direct deploy with Wrangler

Log in to Cloudflare:

```powershell
npx wrangler login
```

Deploy production:

```powershell
npm run deploy:cloudflare
```

Deploy a preview branch:

```powershell
npm run deploy:cloudflare:preview
```

### Option 2: Git-connected Pages project

Connect the repo in Cloudflare Pages, then use these settings:

- Production branch: your main branch
- Build command: `npm run build`
- Output directory: `dist`

Every push will create a new deployment. Preview deployments can be shared with your team automatically.

## Routing

This app uses React Router, so deep links need an SPA fallback on static hosting.

This repo now includes `public/_redirects` with:

```text
/* /index.html 200
```

That makes refreshes on routes like `/admin`, `/shop`, and `/customer/orders` load the app correctly on Cloudflare Pages.

## After deploy

Test these routes directly:

- `/`
- `/login`
- `/admin`
- `/admin/products`
- `/customer/orders`

Use the seeded real Supabase users:

- `customer@bloom.shop`
- `admin@bloom.shop`
- `rider@bloom.shop`
- `cashier@bloom.shop`

Password:

```text
Password123!
```
