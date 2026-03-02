# CPIP — Creator Performance Intelligence Platform

SaaS MVP for brands running TikTok affiliate creator programs. Track engagement, estimate revenue, score creators, surface insights.

## Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Recharts
- **Backend:** Next.js API Routes + Supabase
- **Database:** PostgreSQL (Supabase) with RLS
- **Scraping:** Playwright
- **Deploy:** Vercel + Supabase

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials

# 3. Run database migrations in order
# 001_initial_schema.sql
# 002_semantic_analysis.sql
# 003_backend_hardening.sql
# 004_demo_mode_preference.sql
# 005_rls_hardening.sql

# 4. Install Playwright browsers (for scraping)
npx playwright install chromium

# 5. Start dev server
npm run dev
```

## Supabase Auth Setup (Forgot Password)

In your Supabase project, configure Auth so reset emails can return to this app:

- Go to **Authentication -> URL Configuration**.
- Set **Site URL** to your app URL (for local: `http://localhost:3000`).
- Add this to **Redirect URLs**:
  - `http://localhost:3000/auth/reset-password`
  - your production equivalent, for example `https://your-domain.com/auth/reset-password`

## Production Readiness

For company deployment, use this baseline:

- Set all required env vars from `.env.example` in your hosting platform secrets.
- Keep `ALLOW_GUEST_MODE=false` in production (guest mode is for local/demo only).
- Keep `ENABLE_PUBLIC_SIGNUP=false` unless you intentionally want open self-serve signup.
- Run all SQL migrations in order (`001` through `005`).
- Use `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` in CI before every merge.
- Configure monitoring/uptime checks for `GET /api/health` and `GET /api/health/supabase`.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` and any model provider keys on a regular schedule.
- Restrict dashboard access behind your SSO/auth layer before exposing to client teams.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── creators/       # CRUD creators
│   │   ├── scrape/          # Trigger TikTok scrape
│   │   ├── revenue/calculate/  # Revenue estimation
│   │   ├── scores/calculate/   # Performance scoring
│   │   ├── dashboard/       # Aggregated dashboard data
│   │   ├── alerts/          # Alerts CRUD
│   │   └── posts/           # Posts listing
│   ├── creators/            # Creator pages
│   └── page.tsx             # Dashboard
├── components/
│   ├── dashboard/           # Dashboard widgets
│   ├── creators/            # Creator list + detail
│   ├── alerts/              # Alerts panel
│   └── layout/              # Sidebar, header
├── lib/
│   ├── supabase.ts          # DB client
│   ├── revenue.ts           # Revenue estimation: Views x CTR x CVR x AOV x Commission
│   ├── scoring.ts           # Creator scoring: engagement/revenue/consistency/reach/growth
│   └── scraper.ts           # Playwright TikTok scraper
scraper/
└── run.ts                   # Standalone scraper CLI
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_semantic_analysis.sql
    ├── 003_backend_hardening.sql
    ├── 004_demo_mode_preference.sql
    └── 005_rls_hardening.sql
```

## Revenue Model

```
Estimated Revenue = Views × CTR × CVR × AOV × Commission Rate
```

Configurable per campaign. Default: CTR 2%, CVR 3%.

## Scoring Algorithm

| Component    | Weight | What it measures |
|-------------|--------|-----------------|
| Revenue     | 30%    | Est. revenue per post |
| Engagement  | 25%    | (likes + comments + shares×2 + saves×1.5) / views |
| Consistency | 20%    | Posts per week |
| Reach       | 15%    | Avg views / follower count |
| Growth      | 10%    | Score improvement vs previous period |

Tiers: S (80+), A (60+), B (40+), C (20+), D (<20)

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run scrape <user> # Scrape a TikTok user
```
