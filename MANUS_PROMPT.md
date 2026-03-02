# CPIP - Phase 3 Build Instructions

## Context

You're continuing development on **CreatorPulse** (CPIP) - a SaaS platform for brands managing TikTok affiliate creator programs. The foundation is ~60% complete.

**Current State:**
- ✅ Next.js 14 + Tailwind + Supabase + Recharts stack
- ✅ Full auth system (login/signup/sessions via Supabase SSR)
- ✅ Database schema with demo data (organizations, campaigns, creators, posts, scores)
- ✅ 14 working API routes
- ✅ Dashboard with charts (top performers, tier distribution, KPIs)
- ✅ Creators list + detail pages with scoring/charts
- ✅ Business logic: revenue estimation, 5-metric scoring algorithm
- ✅ TikTok scraper (Playwright, CLI-only)

**What's Missing:**
- Campaign management UI (currently hardcoded to "default")
- Creator onboarding flow (no "Add Creator" button)
- Alerts page (API works, but no UI)
- Scraper UI integration (manual CLI only)
- Automated score/revenue recalculation

## Your Mission: Build Phase 3 (MVP Completion)

Implement the 4 critical missing features to reach a shippable MVP.

---

## Task 1: Campaign Management System

**Goal:** Allow users to create, select, and switch between campaigns.

### Requirements:

1. **Campaign Selector (Navbar/Header)**
   - Add a dropdown in the top navigation showing all campaigns for current org
   - Display campaign name + product name (e.g., "Summer Launch 2025 - Acme Essentials")
   - On select, update global state (React Context or URL param `?campaign_id=xxx`)
   - Default to first active campaign if none selected
   - Show "(Demo)" badge for demo campaign

2. **Create Campaign Modal**
   - Trigger: "New Campaign" button in campaign dropdown
   - Form fields:
     - Campaign Name (required)
     - Product Name (optional)
     - AOV (Average Order Value) - number, default 45.00
     - Commission Rate - percentage (0-100), default 15
     - Default CTR - percentage, default 2
     - Default CVR - percentage, default 3
   - POST to `/api/campaigns` (you'll need to create this route)
   - On success: close modal, refresh campaign list, auto-select new campaign

3. **Campaign Settings Page** (optional, nice-to-have)
   - Route: `/campaigns/[id]/settings`
   - Edit campaign details
   - Archive/pause campaign
   - Delete campaign (with confirmation)

### API Route to Create:

**`src/app/api/campaigns/route.ts`** (already exists, add POST handler):
```typescript
export async function POST(req: NextRequest) {
  // Parse body with zod validation
  // Get org_id from authenticated user
  // Insert into campaigns table
  // Return created campaign
}
```

### Acceptance Criteria:
- [ ] User can see list of campaigns in dropdown
- [ ] User can create new campaign via modal
- [ ] Dashboard/creators pages respect selected campaign
- [ ] Campaign selection persists across page navigation

---

## Task 2: Creator Onboarding Flow

**Goal:** Let users add creators and trigger TikTok scraping from the UI.

### Requirements:

1. **"Add Creator" Button**
   - Location: `/creators` page, top-right
   - Opens modal with form

2. **Add Creator Modal**
   - Form fields:
     - TikTok Username (required, e.g., "@sarah_styles" or "sarah_styles")
     - Display Name (optional)
     - Category (optional dropdown: Beauty, Tech, Fitness, Food, Lifestyle, Other)
     - Tags (optional, comma-separated or tag chips)
     - Campaign Assignment (optional, multi-select campaigns)
   - Submit button: "Add & Scrape"
   - On submit:
     1. POST to `/api/creators` (already exists)
     2. Immediately trigger POST to `/api/scrape` with `creator_id` and `username`
     3. Show loading spinner: "Adding creator and fetching posts..."
     4. On success: close modal, show toast "Creator added! Scraped X posts.", refresh creator list

3. **Bulk Add (Optional Enhancement)**
   - Tab in modal: "Bulk Add"
   - Textarea: paste list of usernames (one per line)
   - On submit: loop and create all, trigger scrapes in sequence
   - Show progress: "Adding 5/10 creators..."

4. **Scrape Status Indicator**
   - In creators list, show badge if creator has 0 posts: "⏳ Pending Scrape"
   - Add "Refresh Data" icon button next to each creator
   - On click: POST to `/api/scrape?creator_id=xxx`, show loading, refresh on complete

### API Updates:

**`src/app/api/scrape/route.ts`** (exists, ensure it works):
- Accepts `creator_id` or `username`
- Calls `scrapeTikTokPosts(username)`
- Inserts posts into `posts` table
- Returns `{ success: true, posts_count: X }`

**`src/app/api/creators/route.ts`** (already has POST, ensure it):
- Accepts `campaign_id` in body
- If provided, inserts into `campaign_creators` join table

### Acceptance Criteria:
- [ ] User can click "Add Creator" button
- [ ] User can fill form and submit
- [ ] New creator appears in list immediately
- [ ] Scrape runs automatically on add
- [ ] User can see scrape status/progress
- [ ] User can manually trigger re-scrape per creator

---

## Task 3: Alerts Page

**Goal:** Let users view and dismiss alerts.

### Requirements:

1. **Alerts Route**
   - Create: `src/app/alerts/page.tsx`
   - Add to sidebar navigation (bell icon + unread count badge)

2. **Alerts List Component**
   - Fetch from `/api/alerts?org_id=xxx`
   - Display as list/table:
     - Alert type icon (⚠️ critical, ℹ️ info, 📊 insight)
     - Message (e.g., "Creator @sarah_styles posted 10x more than average")
     - Timestamp (relative, e.g., "2 hours ago")
     - Read/unread indicator (dot or opacity)
   - Filters: All / Unread / Critical
   - Sort: newest first

3. **Mark as Read**
   - Click alert → mark as read (PATCH `/api/alerts/[id]` with `{ read: true }`)
   - "Mark all as read" button at top

4. **Empty State**
   - When no alerts: "No alerts yet. We'll notify you when something important happens."

### API Route to Create/Update:

**`src/app/api/alerts/route.ts`** (exists, ensure GET works, add PATCH):
```typescript
export async function PATCH(req: NextRequest) {
  // Get alert_id from body
  // Update alerts set read = true where id = alert_id
  // Return updated alert
}
```

### Acceptance Criteria:
- [ ] Alerts page shows list of alerts
- [ ] User can filter by read/unread/critical
- [ ] User can mark individual alert as read
- [ ] User can mark all as read
- [ ] Sidebar shows unread count badge
- [ ] Empty state when no alerts

---

## Task 4: Automated Score & Revenue Calculation

**Goal:** Wire up the calculation APIs so data updates automatically or on-demand.

### Requirements:

1. **"Recalculate All" Button**
   - Location: Dashboard page, top-right (admin action)
   - On click:
     1. Show loading overlay: "Recalculating scores and revenue..."
     2. POST to `/api/scores/calculate?campaign_id=xxx`
     3. POST to `/api/revenue/calculate?campaign_id=xxx`
     4. On complete: show toast "✅ Recalculated X creators", refresh dashboard

2. **Auto-Calculate on New Posts**
   - In `/api/scrape/route.ts`, after inserting posts:
     1. Call `/api/revenue/calculate?creator_id=xxx`
     2. Call `/api/scores/calculate?creator_id=xxx`
   - This ensures scores update immediately after scraping

3. **Dashboard "Last Updated" Timestamp**
   - Show in dashboard header: "Last updated: 2 hours ago"
   - Fetch from `performance_scores.score_date` (most recent)

### API Updates:

**`src/app/api/scores/calculate/route.ts`** (exists, ensure it):
- Accepts `campaign_id` or `creator_id` query param
- For each creator in campaign (or single creator):
  1. Fetch recent posts (last 30 days)
  2. Call `calculateCreatorScore()` from `lib/scoring.ts`
  3. Insert into `performance_scores` table
- Return `{ success: true, creators_updated: X }`

**`src/app/api/revenue/calculate/route.ts`** (exists, ensure it):
- Accepts `campaign_id` or `creator_id` or `post_id`
- For each post:
  1. Get campaign CTR/CVR/AOV/commission defaults
  2. Call `estimateRevenue()` from `lib/revenue.ts`
  3. Insert into `revenue_estimates` table
- Return `{ success: true, posts_updated: X }`

### Acceptance Criteria:
- [ ] Dashboard has "Recalculate All" button
- [ ] Button triggers score + revenue calculation
- [ ] Dashboard shows "Last updated" timestamp
- [ ] New posts auto-trigger calculations
- [ ] Loading states during calculation

---

## Technical Constraints

1. **Styling:** Use existing Tailwind classes. Match dark theme (zinc-900/950 palette).
2. **State Management:** Use React Context or URL params for campaign selection (avoid Redux unless necessary).
3. **Error Handling:** Show toast notifications on success/error (install `react-hot-toast` or use custom toast).
4. **Validation:** Use Zod for API input validation (already in use).
5. **Auth:** All routes must check `supabase.auth.getUser()` and filter by `org_id`.
6. **Loading States:** Use skeleton loaders or spinners (not just "Loading...").

---

## Folder Structure Reference

```
src/
├── app/
│   ├── api/
│   │   ├── alerts/route.ts          (exists, update PATCH)
│   │   ├── campaigns/route.ts       (exists, add POST)
│   │   ├── creators/route.ts        (exists, ensure POST works)
│   │   ├── scrape/route.ts          (exists, add auto-calc)
│   │   ├── scores/calculate/route.ts (exists, test)
│   │   └── revenue/calculate/route.ts (exists, test)
│   ├── alerts/page.tsx              (CREATE THIS)
│   ├── page.tsx                     (dashboard, add recalc button)
│   └── creators/page.tsx            (add "Add Creator" button)
├── components/
│   ├── campaigns/
│   │   ├── CampaignSelector.tsx    (CREATE THIS)
│   │   └── CreateCampaignModal.tsx (CREATE THIS)
│   ├── creators/
│   │   └── AddCreatorModal.tsx     (CREATE THIS)
│   ├── alerts/
│   │   └── AlertsList.tsx          (CREATE THIS)
│   └── layout/
│       └── Sidebar.tsx              (add Alerts link)
└── lib/
    ├── scoring.ts                   (already exists, use it)
    ├── revenue.ts                   (already exists, use it)
    └── context/CampaignContext.tsx  (CREATE IF using Context)
```

---

## Delivery Checklist

When you're done, ensure:

- [ ] All 4 tasks complete
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] All new components use Tailwind (match existing style)
- [ ] API routes return proper JSON errors (try/catch)
- [ ] Demo data works (test with demo org/campaign)
- [ ] Mobile-responsive (test sidebar, modals on small screens)
- [ ] Git commit with message: "feat: Phase 3 - campaign mgmt, creator onboarding, alerts, automation"

---

## Testing Steps

After build:

1. Start dev server: `npm run dev`
2. Login with demo account (or create new)
3. **Test Campaign Management:**
   - Create new campaign "Winter Sale 2026"
   - Switch between campaigns in dropdown
   - Verify dashboard updates to show correct campaign data
4. **Test Creator Onboarding:**
   - Click "Add Creator"
   - Enter username "@testcreator"
   - Submit, verify scrape runs
   - Check creator appears in list
5. **Test Alerts:**
   - Navigate to /alerts
   - Verify demo alerts appear
   - Mark one as read, verify it updates
6. **Test Recalculation:**
   - Click "Recalculate All" on dashboard
   - Verify loading state, then success toast
   - Check scores updated in creator list

---

## Notes

- **Playwright scraper** won't work on Vercel. For now, manual CLI is fine. Future: separate service.
- **Demo data** is in `scripts/002_seed_demo.sql`. Uses fixed UUIDs for testing.
- **Supabase RLS**: Current policies allow public read for demo. Production needs proper user-scoped policies.
- **Performance**: If calculation is slow for many creators, add progress indicator or queue (future enhancement).

---

## Questions?

If anything is unclear:
1. Check existing code in `src/app/api/` and `src/components/` for patterns
2. Follow the same structure (client components use `"use client"`, server use `createClient()`)
3. Match the existing dark theme styling

Good luck! 🚀
