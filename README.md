<p align="center">
  <img src="public/logo.png" alt="CPIP logo" width="140" />
</p>

# CPIP - Creator Performance Intelligence Platform

SaaS MVP for brands running TikTok affiliate creator programs. Track engagement, estimate revenue, score creators, and surface actionable insights.

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
# 006_recommendation_tasks_and_rules.sql
# 007_scrape_jobs.sql

# 4. Install Playwright browsers (for scraping)
npx playwright install chromium

# 5. Start dev server
npm run dev
```

Requires Node.js 18.18+.

## Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `OPENAI_API_KEY` and `SEMANTIC_ANALYSIS_MODEL` for LLM-based semantic analysis
- `ALLOW_GUEST_MODE`, `ENABLE_PUBLIC_SIGNUP`
- `PUBLIC_SIGNUP_RATE_LIMIT_WINDOW_MS`, `PUBLIC_SIGNUP_RATE_LIMIT_MAX_REQUESTS`
- `BRIEF_DISPATCH_SECRET` for automated weekly brief dispatch jobs
- `SCRAPE_DISPATCH_SECRET` for automated scrape worker dispatch runs
- `SCRAPER_*` knobs for retry/timeouts/concurrency tuning

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
- Run all SQL migrations in order (`001` through `007`).
- Use `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` in CI before every merge.
- Configure monitoring/uptime checks for `GET /api/health` and `GET /api/health/supabase`.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` and any model provider keys on a regular schedule.
- Restrict dashboard access behind your SSO/auth layer before exposing to client teams.

## Project Structure

```text
src/
├── app/
│   ├── api/
│   │   ├── creators/            # Creator CRUD
│   │   ├── campaigns/           # Campaign endpoints
│   │   ├── dashboard/           # Aggregated dashboard data
│   │   ├── revenue/calculate/   # Revenue estimation
│   │   ├── scores/              # Scoring endpoints
│   │   ├── predictive-score/    # Predictive scoring
│   │   ├── lookalike-discovery/ # Lookalike creator discovery
│   │   ├── creative-audit/      # Creative quality analysis
│   │   ├── semantic/analyze/    # Semantic analysis
│   │   ├── scrape/              # Trigger TikTok scrape
│   │   ├── health/              # Health checks
│   │   └── auth/sign-up/        # Controlled signup flow
│   └── ...                      # Dashboard and app routes
├── components/
│   ├── dashboard/               # Dashboard widgets
│   ├── creators/                # Creator list/detail + analysis tools
│   ├── campaigns/               # Campaign selector/create UI
│   ├── alerts/                  # Alerts panel
│   ├── onboarding/              # Quick start UX
│   ├── layout/                  # Sidebar, top bar, footer
│   └── ui/                      # Shared UI primitives
├── lib/
│   ├── supabase*/               # Supabase clients
│   ├── auth/                    # Server auth/session helpers
│   ├── api/                     # API auth/response/rate-limit helpers
│   ├── revenue.ts               # Revenue estimation
│   ├── scoring.ts               # Creator scoring
│   ├── predictiveScore.ts       # Predictive performance model
│   └── scraper.ts               # Playwright TikTok scraper
scraper/
└── run.ts                       # Standalone scraper CLI
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_semantic_analysis.sql
    ├── 003_backend_hardening.sql
    ├── 004_demo_mode_preference.sql
    ├── 005_rls_hardening.sql
    ├── 006_recommendation_tasks_and_rules.sql
    └── 007_scrape_jobs.sql
```

## Revenue Model

```text
Estimated Revenue = Views x CTR x CVR x AOV x Commission Rate
```

Configurable per campaign. Default: CTR 2%, CVR 3%.

## Scoring Algorithm

| Component    | Weight | What it measures |
|-------------|--------|-----------------|
| Revenue     | 30%    | Est. revenue per post |
| Engagement  | 25%    | (likes + comments + shares x2 + saves x1.5) / views |
| Consistency | 20%    | Posts per week |
| Reach       | 15%    | Avg views / follower count |
| Growth      | 10%    | Score improvement vs previous period |

Tiers: S (80+), A (60+), B (40+), C (20+), D (<20)

## Scripts

```bash
npm run dev               # Start dev server
npm run build             # Production build
npm run start             # Run built app
npm run lint              # Run ESLint
npm run typecheck         # Run TypeScript checks
npm run test              # Run tests once
npm run test:watch        # Run tests in watch mode
npm run scrape <user>     # Scrape a TikTok user
npm run seed:demo         # Seed demo data
npm run verify:migrations # Verify migration integrity
```

## Weekly Brief Automation

Configure org-level delivery in **Settings -> Weekly Brief Delivery**.

For automated fanout from a scheduler/cron job:

- Set `BRIEF_DISPATCH_SECRET` in your environment.
- Call `POST /api/brief/dispatch` with header `x-brief-dispatch-secret` and body:
  - `{ "all_orgs": true }`
- Optional dry run:
  - `{ "all_orgs": true, "dry_run": true }`

To generate overdue recommendation-task reminder alerts:

- Call `POST /api/recommendation-tasks/reminders` with same secret header and body:
  - `{ "all_orgs": true }`

## Scrape Job Automation

Scrape API supports two modes:

- Synchronous run: `POST /api/scrape` with `{ "creator_id": "...", "campaign_id": "...", "wait_for_completion": true }`
- Async enqueue: `POST /api/scrape` with `{ "creator_id": "...", "campaign_id": "..." }` (returns `job_id`)

To process queued scrape jobs from scheduler/cron:

- Set `SCRAPE_DISPATCH_SECRET`
- Call `POST /api/scrape/dispatch` with header `x-scrape-dispatch-secret`
- Optional body: `{ "limit": 3 }`

To view job status:

- `GET /api/scrape/jobs`
- `GET /api/scrape/jobs/:id`
