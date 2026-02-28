# Creator Performance Intelligence Platform (CPIP)

## SaaS MVP for TikTok Affiliate Creator Programs

**Target clients:** Brands like Goli Gummy, Comfort — running TikTok Shop affiliate programs with 100s-1000s of creators.

**Core value prop:** Stop guessing which creators drive revenue. See performance scores, estimated revenue, and engagement trends in one dashboard.

---

## 1. Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│  Next.js API  │────▶│   Supabase   │
│  Frontend    │     │   Routes      │     │  PostgreSQL  │
│  (Vercel)    │     │  (Vercel)     │     │  + Auth      │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  TikTok      │
                    │  Scraper     │
                    │  (Cron/Queue)│
                    └──────────────┘
```

**Stack:**
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Recharts
- **Backend:** Next.js API routes + Supabase Edge Functions
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Scraping:** Playwright (fallback) + TikTok Research API (if approved)
- **Hosting:** Vercel + Supabase hosted
- **Auth:** Supabase Auth (magic link for brand users)
- **Jobs:** Vercel Cron or Supabase pg_cron for scheduled scrapes

**Why this stack:**
- Zero infra management = ship fast
- Supabase gives us real-time subscriptions for live dashboard updates
- Next.js API routes keep frontend/backend in one repo
- Vercel edge = low latency globally

---

## 2. Database Schema (Supabase / PostgreSQL)

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- ORGANIZATIONS (multi-tenant)
-- ============================================
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  plan text default 'free' check (plan in ('free', 'pro', 'enterprise')),
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- USERS (brand team members)
-- ============================================
create table users (
  id uuid primary key references auth.users(id),
  org_id uuid references organizations(id) on delete cascade,
  email text not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now()
);

-- ============================================
-- CAMPAIGNS
-- ============================================
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  product_name text,
  aov numeric(10,2) default 0,          -- Average Order Value
  commission_rate numeric(5,4) default 0, -- e.g. 0.15 = 15%
  default_ctr numeric(5,4) default 0.02,  -- Click-through rate
  default_cvr numeric(5,4) default 0.03,  -- Conversion rate
  status text default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- CREATORS
-- ============================================
create table creators (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  tiktok_username text not null,
  tiktok_uid text,
  display_name text,
  avatar_url text,
  follower_count integer default 0,
  bio text,
  category text,                         -- e.g. 'health', 'beauty', 'fitness'
  tags text[] default '{}',
  status text default 'active' check (status in ('active', 'inactive', 'blacklisted')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, tiktok_username)
);

-- ============================================
-- CREATOR-CAMPAIGN JUNCTION
-- ============================================
create table campaign_creators (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  custom_commission numeric(5,4),        -- override campaign default
  joined_at timestamptz default now(),
  unique(campaign_id, creator_id)
);

-- ============================================
-- POSTS (scraped TikTok data)
-- ============================================
create table posts (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  tiktok_post_id text unique not null,
  url text not null,
  caption text,
  hashtags text[] default '{}',
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  duration_seconds integer,
  posted_at timestamptz,
  has_product_link boolean default false,
  scraped_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookups
create index idx_posts_creator on posts(creator_id);
create index idx_posts_campaign on posts(campaign_id);
create index idx_posts_posted_at on posts(posted_at desc);

-- ============================================
-- REVENUE ESTIMATES
-- ============================================
create table revenue_estimates (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  views integer not null,
  ctr numeric(5,4) not null,
  cvr numeric(5,4) not null,
  aov numeric(10,2) not null,
  commission_rate numeric(5,4) not null,
  estimated_clicks integer generated always as (floor(views * ctr)) stored,
  estimated_conversions numeric(10,2) generated always as (floor(views * ctr) * cvr) stored,
  estimated_gmv numeric(12,2) generated always as (floor(views * ctr) * cvr * aov) stored,
  estimated_revenue numeric(12,2) generated always as (floor(views * ctr) * cvr * aov * commission_rate) stored,
  calculated_at timestamptz default now(),
  unique(post_id, campaign_id)
);

-- ============================================
-- PERFORMANCE SCORES (daily snapshots)
-- ============================================
create table performance_scores (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  score_date date not null default current_date,

  -- Component scores (0-100)
  engagement_score numeric(5,2) default 0,
  consistency_score numeric(5,2) default 0,
  revenue_score numeric(5,2) default 0,
  growth_score numeric(5,2) default 0,
  reach_score numeric(5,2) default 0,

  -- Weighted composite
  overall_score numeric(5,2) default 0,
  tier text generated always as (
    case
      when overall_score >= 80 then 'S'
      when overall_score >= 60 then 'A'
      when overall_score >= 40 then 'B'
      when overall_score >= 20 then 'C'
      else 'D'
    end
  ) stored,

  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(creator_id, campaign_id, score_date)
);

create index idx_scores_creator_date on performance_scores(creator_id, score_date desc);

-- ============================================
-- ALERTS
-- ============================================
create table alerts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  creator_id uuid references creators(id) on delete set null,
  type text not null check (type in (
    'score_drop', 'score_rise', 'viral_post', 'inactive',
    'new_milestone', 'anomaly', 'campaign_target'
  )),
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text,
  data jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

create index idx_alerts_org on alerts(org_id, created_at desc);

-- ============================================
-- SCRAPE LOG (tracking scrape health)
-- ============================================
create table scrape_log (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  status text check (status in ('success', 'failed', 'partial')),
  posts_found integer default 0,
  error_message text,
  duration_ms integer,
  scraped_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table organizations enable row level security;
alter table creators enable row level security;
alter table posts enable row level security;
alter table campaigns enable row level security;
alter table alerts enable row level security;

-- Users can only see their org's data
create policy "org_isolation" on creators
  for all using (org_id = (select org_id from users where id = auth.uid()));

create policy "org_isolation" on campaigns
  for all using (org_id = (select org_id from users where id = auth.uid()));

create policy "org_isolation" on alerts
  for all using (org_id = (select org_id from users where id = auth.uid()));
```

---

## 3. Backend API Endpoints

### File: `src/app/api/creators/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreatorSchema = z.object({
  tiktok_username: z.string().min(1).max(50),
  display_name: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaign_id: z.string().uuid().optional(),
});

// GET /api/creators — list creators with latest scores
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);

  const campaign_id = searchParams.get('campaign_id');
  const sort = searchParams.get('sort') || 'overall_score';
  const order = searchParams.get('order') || 'desc';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '25');

  let query = supabase
    .from('creators')
    .select(`
      *,
      latest_score:performance_scores(
        overall_score, tier, engagement_score,
        revenue_score, consistency_score, score_date
      ),
      post_count:posts(count),
      campaign_creators(campaign_id)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (campaign_id) {
    query = query.eq('campaign_creators.campaign_id', campaign_id);
  }

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, limit });
}

// POST /api/creators — add a new creator
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();
  const parsed = CreatorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.user?.id)
    .single();

  const { data, error } = await supabase
    .from('creators')
    .insert({
      ...parsed.data,
      org_id: profile?.org_id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If campaign_id provided, link creator to campaign
  if (parsed.data.campaign_id) {
    await supabase.from('campaign_creators').insert({
      campaign_id: parsed.data.campaign_id,
      creator_id: data.id,
    });
  }

  return NextResponse.json({ data }, { status: 201 });
}

// PATCH /api/creators — update creator
export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('creators')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
```

### File: `src/app/api/scrape/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { scrapeTikTokPosts } from '@/lib/scraper';

// POST /api/scrape — trigger scrape for a creator
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { creator_id } = await req.json();

  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('id', creator_id)
    .single();

  if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

  const startTime = Date.now();

  try {
    const posts = await scrapeTikTokPosts(creator.tiktok_username);

    // Upsert posts
    const postRecords = posts.map((p: any) => ({
      creator_id,
      tiktok_post_id: p.id,
      url: p.url,
      caption: p.caption,
      hashtags: p.hashtags,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      duration_seconds: p.duration,
      posted_at: p.posted_at,
      has_product_link: p.has_product_link,
      scraped_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('posts')
      .upsert(postRecords, { onConflict: 'tiktok_post_id' })
      .select();

    // Log scrape
    await supabase.from('scrape_log').insert({
      creator_id,
      status: 'success',
      posts_found: posts.length,
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json({ scraped: data?.length || 0 });
  } catch (err: any) {
    await supabase.from('scrape_log').insert({
      creator_id,
      status: 'failed',
      error_message: err.message,
      duration_ms: Date.now() - startTime,
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

### File: `src/app/api/revenue/calculate/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/revenue/calculate — calculate revenue estimates for a campaign
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { campaign_id, creator_id } = await req.json();

  // Get campaign params
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaign_id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Get posts (optionally filtered by creator)
  let query = supabase
    .from('posts')
    .select('*')
    .eq('campaign_id', campaign_id);

  if (creator_id) query = query.eq('creator_id', creator_id);

  const { data: posts } = await query;

  if (!posts?.length) return NextResponse.json({ estimates: [], total: 0 });

  const estimates = posts.map((post) => {
    const ctr = campaign.default_ctr;
    const cvr = campaign.default_cvr;
    const aov = campaign.aov;
    const commission = campaign.commission_rate;

    return {
      post_id: post.id,
      campaign_id,
      views: post.views,
      ctr,
      cvr,
      aov,
      commission_rate: commission,
    };
  });

  // Upsert revenue estimates
  const { data, error } = await supabase
    .from('revenue_estimates')
    .upsert(estimates, { onConflict: 'post_id,campaign_id' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalRevenue = data?.reduce((sum, e) => sum + Number(e.estimated_revenue), 0) || 0;

  return NextResponse.json({
    estimates: data,
    total_estimated_revenue: totalRevenue,
    post_count: data?.length,
  });
}
```

### File: `src/app/api/scores/calculate/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { calculateCreatorScore } from '@/lib/scoring';

// POST /api/scores/calculate — calculate performance scores
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { campaign_id, creator_id } = await req.json();

  // Get all creators in campaign (or specific one)
  let query = supabase
    .from('campaign_creators')
    .select('creator_id, creators(*)')
    .eq('campaign_id', campaign_id);

  if (creator_id) query = query.eq('creator_id', creator_id);

  const { data: campaignCreators } = await query;

  if (!campaignCreators?.length) {
    return NextResponse.json({ error: 'No creators found' }, { status: 404 });
  }

  const scores = [];

  for (const cc of campaignCreators) {
    // Get creator's posts for this campaign (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: posts } = await supabase
      .from('posts')
      .select('*, revenue_estimates(*)')
      .eq('creator_id', cc.creator_id)
      .eq('campaign_id', campaign_id)
      .gte('posted_at', thirtyDaysAgo.toISOString())
      .order('posted_at', { ascending: false });

    // Get previous score for growth calc
    const { data: prevScore } = await supabase
      .from('performance_scores')
      .select('*')
      .eq('creator_id', cc.creator_id)
      .eq('campaign_id', campaign_id)
      .order('score_date', { ascending: false })
      .limit(1)
      .single();

    const score = calculateCreatorScore(posts || [], prevScore, cc.creators);
    score.creator_id = cc.creator_id;
    score.campaign_id = campaign_id;

    scores.push(score);
  }

  const { data, error } = await supabase
    .from('performance_scores')
    .upsert(scores, { onConflict: 'creator_id,campaign_id,score_date' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ scores: data });
}
```

### File: `src/app/api/dashboard/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/dashboard — aggregated dashboard data
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const campaign_id = searchParams.get('campaign_id');

  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.user?.id)
    .single();

  const org_id = profile?.org_id;

  // Parallel queries
  const [
    creatorsRes,
    topPerformersRes,
    recentPostsRes,
    revenueRes,
    alertsRes,
    tierDistRes,
  ] = await Promise.all([
    // Total creators
    supabase
      .from('creators')
      .select('id', { count: 'exact' })
      .eq('org_id', org_id)
      .eq('status', 'active'),

    // Top 10 performers
    supabase
      .from('performance_scores')
      .select('*, creators(tiktok_username, display_name, avatar_url)')
      .eq('campaign_id', campaign_id!)
      .eq('score_date', new Date().toISOString().split('T')[0])
      .order('overall_score', { ascending: false })
      .limit(10),

    // Recent posts (last 7 days)
    supabase
      .from('posts')
      .select('*, creators(tiktok_username, display_name)')
      .eq('campaign_id', campaign_id!)
      .gte('posted_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('views', { ascending: false })
      .limit(20),

    // Total estimated revenue
    supabase
      .from('revenue_estimates')
      .select('estimated_revenue')
      .eq('campaign_id', campaign_id!),

    // Unread alerts
    supabase
      .from('alerts')
      .select('*')
      .eq('org_id', org_id!)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10),

    // Tier distribution
    supabase
      .from('performance_scores')
      .select('tier')
      .eq('campaign_id', campaign_id!)
      .eq('score_date', new Date().toISOString().split('T')[0]),
  ]);

  const totalRevenue = revenueRes.data?.reduce(
    (sum, r) => sum + Number(r.estimated_revenue), 0
  ) || 0;

  const tierDist = (tierDistRes.data || []).reduce((acc: Record<string, number>, s) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    total_creators: creatorsRes.count || 0,
    total_estimated_revenue: totalRevenue,
    top_performers: topPerformersRes.data || [],
    recent_top_posts: recentPostsRes.data || [],
    unread_alerts: alertsRes.data || [],
    tier_distribution: tierDist,
  });
}
```

---

## 4. Revenue Estimation Algorithm

```
Estimated Revenue = Views × CTR × CVR × AOV × Commission Rate
```

### File: `src/lib/revenue.ts`

```typescript
export interface RevenueParams {
  views: number;
  ctr: number;     // Click-through rate (e.g., 0.02 = 2%)
  cvr: number;     // Conversion rate (e.g., 0.03 = 3%)
  aov: number;     // Average order value in USD
  commission: number; // Commission rate (e.g., 0.15 = 15%)
}

export interface RevenueEstimate {
  estimated_clicks: number;
  estimated_conversions: number;
  estimated_gmv: number;
  estimated_revenue: number;
}

export function estimateRevenue(params: RevenueParams): RevenueEstimate {
  const clicks = Math.floor(params.views * params.ctr);
  const conversions = clicks * params.cvr;
  const gmv = conversions * params.aov;
  const revenue = gmv * params.commission;

  return {
    estimated_clicks: clicks,
    estimated_conversions: Math.round(conversions * 100) / 100,
    estimated_gmv: Math.round(gmv * 100) / 100,
    estimated_revenue: Math.round(revenue * 100) / 100,
  };
}

/**
 * Example for Goli Gummy:
 *   Views: 500,000
 *   CTR: 2% (0.02) — typical TikTok Shop
 *   CVR: 3% (0.03) — health/supplement vertical
 *   AOV: $25
 *   Commission: 15%
 *
 *   Clicks: 10,000
 *   Conversions: 300
 *   GMV: $7,500
 *   Revenue (to creator): $1,125
 */
```

---

## 5. Creator Scoring Algorithm

### Formula

```
Overall Score = (Engagement × 0.25) + (Revenue × 0.30) + (Consistency × 0.20) + (Reach × 0.15) + (Growth × 0.10)
```

**Revenue gets the highest weight** — this is a performance platform, not a vanity metrics tracker.

### File: `src/lib/scoring.ts`

```typescript
interface Post {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  posted_at: string;
  revenue_estimates?: { estimated_revenue: number }[];
}

interface PrevScore {
  overall_score: number;
  engagement_score: number;
  revenue_score: number;
}

interface Creator {
  follower_count: number;
}

interface ScoreResult {
  creator_id?: string;
  campaign_id?: string;
  score_date: string;
  engagement_score: number;
  consistency_score: number;
  revenue_score: number;
  growth_score: number;
  reach_score: number;
  overall_score: number;
  metadata: Record<string, any>;
}

const WEIGHTS = {
  engagement: 0.25,
  revenue: 0.30,
  consistency: 0.20,
  reach: 0.15,
  growth: 0.10,
};

export function calculateCreatorScore(
  posts: Post[],
  prevScore: PrevScore | null,
  creator: Creator
): ScoreResult {
  if (!posts.length) {
    return emptyScore();
  }

  // --- ENGAGEMENT SCORE (0-100) ---
  // Engagement rate = (likes + comments + shares + saves) / views
  // Benchmarked: >6% = 100, <1% = 0
  const totalEngagement = posts.reduce(
    (sum, p) => sum + p.likes + p.comments + (p.shares * 2) + (p.saves * 1.5), 0
  );
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const engagementRate = totalViews > 0 ? totalEngagement / totalViews : 0;
  const engagement_score = clamp(normalize(engagementRate, 0.01, 0.08) * 100);

  // --- REVENUE SCORE (0-100) ---
  // Based on total estimated revenue relative to campaign median
  // For MVP: use absolute thresholds
  const totalRevenue = posts.reduce((sum, p) => {
    const rev = p.revenue_estimates?.[0]?.estimated_revenue || 0;
    return sum + Number(rev);
  }, 0);
  const revenuePerPost = posts.length > 0 ? totalRevenue / posts.length : 0;
  // $0 = 0, $500+/post = 100
  const revenue_score = clamp(normalize(revenuePerPost, 0, 500) * 100);

  // --- CONSISTENCY SCORE (0-100) ---
  // How regularly do they post? (posts per week over 30 days)
  const daySpan = 30;
  const postsPerWeek = (posts.length / daySpan) * 7;
  // 0 posts/week = 0, 5+/week = 100
  const consistency_score = clamp(normalize(postsPerWeek, 0, 5) * 100);

  // --- REACH SCORE (0-100) ---
  // Average views relative to follower count (virality potential)
  const avgViews = totalViews / posts.length;
  const viewToFollower = creator.follower_count > 0
    ? avgViews / creator.follower_count
    : 0;
  // 0.1x = baseline, 2x+ = viral
  const reach_score = clamp(normalize(viewToFollower, 0.05, 2.0) * 100);

  // --- GROWTH SCORE (0-100) ---
  // Improvement vs. previous period
  let growth_score = 50; // neutral if no previous data
  if (prevScore) {
    const delta = engagement_score - prevScore.engagement_score;
    // -20 or worse = 0, +20 or better = 100
    growth_score = clamp(normalize(delta, -20, 20) * 100);
  }

  // --- OVERALL ---
  const overall_score = Math.round(
    engagement_score * WEIGHTS.engagement +
    revenue_score * WEIGHTS.revenue +
    consistency_score * WEIGHTS.consistency +
    reach_score * WEIGHTS.reach +
    growth_score * WEIGHTS.growth
  );

  return {
    score_date: new Date().toISOString().split('T')[0],
    engagement_score: round2(engagement_score),
    consistency_score: round2(consistency_score),
    revenue_score: round2(revenue_score),
    growth_score: round2(growth_score),
    reach_score: round2(reach_score),
    overall_score,
    metadata: {
      total_posts: posts.length,
      total_views: totalViews,
      total_revenue: totalRevenue,
      engagement_rate: round2(engagementRate * 100),
      posts_per_week: round2(postsPerWeek),
    },
  };
}

function normalize(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyScore(): ScoreResult {
  return {
    score_date: new Date().toISOString().split('T')[0],
    engagement_score: 0,
    consistency_score: 0,
    revenue_score: 0,
    growth_score: 0,
    reach_score: 0,
    overall_score: 0,
    metadata: {},
  };
}
```

---

## 6. TikTok Scraper

### File: `src/lib/scraper.ts`

```typescript
import { chromium, Browser, Page } from 'playwright';

interface TikTokPost {
  id: string;
  url: string;
  caption: string;
  hashtags: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  duration: number;
  posted_at: string;
  has_product_link: boolean;
}

export async function scrapeTikTokPosts(
  username: string,
  maxPosts: number = 30
): Promise<TikTokPost[]> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    });

    const page = await context.newPage();

    // Navigate to user profile
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for video grid to load
    await page.waitForSelector('[data-e2e="user-post-item"]', { timeout: 15000 });

    // Scroll to load more posts
    let previousHeight = 0;
    let scrollAttempts = 0;

    while (scrollAttempts < 10) {
      const posts = await page.$$('[data-e2e="user-post-item"]');
      if (posts.length >= maxPosts) break;

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;
      scrollAttempts++;
    }

    // Extract post data from the grid
    const postElements = await page.$$('[data-e2e="user-post-item"]');
    const posts: TikTokPost[] = [];

    for (const el of postElements.slice(0, maxPosts)) {
      try {
        const link = await el.$('a');
        const href = await link?.getAttribute('href');
        if (!href) continue;

        const viewText = await el.$eval(
          '[data-e2e="video-views"]',
          (el) => el.textContent || '0'
        ).catch(() => '0');

        posts.push({
          id: href.split('/').pop() || '',
          url: `https://www.tiktok.com${href}`,
          caption: '', // filled on detail page
          hashtags: [],
          views: parseCount(viewText),
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          duration: 0,
          posted_at: '',
          has_product_link: false,
        });
      } catch {
        continue;
      }
    }

    // Enrich each post with detail data (batch — limit concurrency)
    const enriched: TikTokPost[] = [];
    for (const post of posts) {
      try {
        const detail = await scrapePostDetail(context, post.url);
        enriched.push({ ...post, ...detail });
      } catch {
        enriched.push(post);
      }
      // Rate limit
      await page.waitForTimeout(1000 + Math.random() * 2000);
    }

    return enriched;
  } finally {
    if (browser) await browser.close();
  }
}

async function scrapePostDetail(context: any, url: string) {
  const page: Page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

    const caption = await page
      .$eval('[data-e2e="browse-video-desc"]', (el) => el.textContent || '')
      .catch(() => '');

    const hashtags = caption.match(/#\w+/g) || [];

    const likes = await page
      .$eval('[data-e2e="like-count"]', (el) => el.textContent || '0')
      .catch(() => '0');

    const comments = await page
      .$eval('[data-e2e="comment-count"]', (el) => el.textContent || '0')
      .catch(() => '0');

    const shares = await page
      .$eval('[data-e2e="share-count"]', (el) => el.textContent || '0')
      .catch(() => '0');

    const saves = await page
      .$eval('[data-e2e="undefined-count"]', (el) => el.textContent || '0')
      .catch(() => '0');

    // Check for product link (TikTok Shop indicator)
    const hasProduct = await page
      .$('[data-e2e="product-anchor"]')
      .then((el) => !!el)
      .catch(() => false);

    return {
      caption,
      hashtags: hashtags.map((h: string) => h.slice(1)),
      likes: parseCount(likes),
      comments: parseCount(comments),
      shares: parseCount(shares),
      saves: parseCount(saves),
      has_product_link: hasProduct,
    };
  } finally {
    await page.close();
  }
}

function parseCount(text: string): number {
  text = text.trim().toUpperCase();
  if (text.endsWith('K')) return Math.round(parseFloat(text) * 1000);
  if (text.endsWith('M')) return Math.round(parseFloat(text) * 1000000);
  if (text.endsWith('B')) return Math.round(parseFloat(text) * 1000000000);
  return parseInt(text.replace(/,/g, '')) || 0;
}
```

**Architecture note:** Playwright scraping is the MVP approach. For production:
1. Apply for the [TikTok Research API](https://developers.tiktok.com/products/research-api/) — rate-limited but legal
2. Consider proxied scraping services (Bright Data, Apify) for scale
3. Add a job queue (BullMQ or Supabase Edge Functions + pg_cron) for scheduled scrapes

---

## 7. Frontend Components

### File: `src/components/dashboard/DashboardOverview.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const TIER_COLORS: Record<string, string> = {
  S: '#10b981', A: '#3b82f6', B: '#f59e0b', C: '#f97316', D: '#ef4444',
};

export function DashboardOverview({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard?campaign_id=${campaignId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <div className="animate-pulse">Loading dashboard...</div>;
  if (!data) return <div>Error loading dashboard</div>;

  const tierData = Object.entries(data.tier_distribution).map(([tier, count]) => ({
    tier,
    count,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Active Creators" value={data.total_creators} />
        <KPICard
          title="Est. Revenue"
          value={`$${data.total_estimated_revenue.toLocaleString()}`}
        />
        <KPICard title="Top Posts (7d)" value={data.recent_top_posts.length} />
        <KPICard title="Alerts" value={data.unread_alerts.length} variant="alert" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.top_performers}>
                <XAxis dataKey="creators.tiktok_username" angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="overall_score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Creator Tiers</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={tierData} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={100} label>
                  {tierData.map((entry: any) => (
                    <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || '#999'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Viral Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Top Posts This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recent_top_posts.slice(0, 5).map((post: any) => (
              <div key={post.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div>
                  <span className="font-medium">@{post.creators?.tiktok_username}</span>
                  <p className="text-sm text-muted-foreground truncate max-w-md">{post.caption}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatCount(post.views)} views</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCount(post.likes)} ❤️ {formatCount(post.comments)} 💬
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, variant }: { title: string; value: any; variant?: string }) {
  return (
    <Card className={variant === 'alert' ? 'border-orange-500' : ''}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
```

### File: `src/components/creators/CreatorList.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TIER_STYLES: Record<string, string> = {
  S: 'bg-emerald-500', A: 'bg-blue-500', B: 'bg-amber-500', C: 'bg-orange-500', D: 'bg-red-500',
};

export function CreatorList({ campaignId, onSelect }: {
  campaignId: string;
  onSelect: (id: string) => void;
}) {
  const [creators, setCreators] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/creators?campaign_id=${campaignId}`)
      .then((r) => r.json())
      .then((d) => setCreators(d.data || []))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const filtered = creators.filter((c) =>
    c.tiktok_username.toLowerCase().includes(search.toLowerCase()) ||
    c.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search creators..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Creator</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Followers</TableHead>
            <TableHead>Posts</TableHead>
            <TableHead>Engagement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((creator) => {
            const score = creator.latest_score?.[0];
            return (
              <TableRow
                key={creator.id}
                className="cursor-pointer hover:bg-muted"
                onClick={() => onSelect(creator.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    {creator.avatar_url && (
                      <img src={creator.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                    )}
                    <div>
                      <div className="font-medium">@{creator.tiktok_username}</div>
                      {creator.display_name && (
                        <div className="text-sm text-muted-foreground">{creator.display_name}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {score?.tier && (
                    <Badge className={TIER_STYLES[score.tier]}>{score.tier}</Badge>
                  )}
                </TableCell>
                <TableCell className="font-bold">{score?.overall_score || '—'}</TableCell>
                <TableCell>{formatCount(creator.follower_count)}</TableCell>
                <TableCell>{creator.post_count?.[0]?.count || 0}</TableCell>
                <TableCell>{score?.engagement_score || '—'}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
```

### File: `src/components/creators/CreatorDetail.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';

export function CreatorDetail({ creatorId, campaignId }: {
  creatorId: string;
  campaignId: string;
}) {
  const [creator, setCreator] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/creators/${creatorId}`).then((r) => r.json()),
      fetch(`/api/scores?creator_id=${creatorId}&campaign_id=${campaignId}`).then((r) => r.json()),
      fetch(`/api/posts?creator_id=${creatorId}&campaign_id=${campaignId}`).then((r) => r.json()),
    ]).then(([c, s, p]) => {
      setCreator(c.data);
      setScores(s.data || []);
      setPosts(p.data || []);
    });
  }, [creatorId, campaignId]);

  if (!creator) return <div className="animate-pulse">Loading...</div>;

  const latestScore = scores[0];
  const radarData = latestScore ? [
    { metric: 'Engagement', value: latestScore.engagement_score },
    { metric: 'Revenue', value: latestScore.revenue_score },
    { metric: 'Consistency', value: latestScore.consistency_score },
    { metric: 'Reach', value: latestScore.reach_score },
    { metric: 'Growth', value: latestScore.growth_score },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {creator.avatar_url && (
          <img src={creator.avatar_url} className="w-16 h-16 rounded-full" alt="" />
        )}
        <div>
          <h2 className="text-2xl font-bold">@{creator.tiktok_username}</h2>
          <p className="text-muted-foreground">{creator.display_name}</p>
          <div className="flex gap-2 mt-1">
            {latestScore?.tier && <Badge>{latestScore.tier}-Tier</Badge>}
            <Badge variant="outline">Score: {latestScore?.overall_score || 'N/A'}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Radar */}
        <Card>
          <CardHeader><CardTitle>Performance Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score History */}
        <Card>
          <CardHeader><CardTitle>Score Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scores.slice().reverse()}>
                <XAxis dataKey="score_date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="overall_score" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="engagement_score" stroke="#10b981" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="revenue_score" stroke="#f59e0b" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Posts Table */}
      <Card>
        <CardHeader><CardTitle>Recent Posts</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {posts.map((post: any) => (
              <div key={post.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="text-sm truncate max-w-lg">{post.caption}</p>
                  <div className="flex gap-2 mt-1">
                    {post.has_product_link && <Badge variant="outline" className="text-xs">🛒 Product</Badge>}
                    {post.hashtags?.map((h: string) => (
                      <span key={h} className="text-xs text-muted-foreground">#{h}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>{formatCount(post.views)} views</div>
                  <div className="text-muted-foreground">
                    Est. ${post.revenue_estimates?.[0]?.estimated_revenue?.toFixed(2) || '0'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
```

### File: `src/components/alerts/AlertsPanel.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

const TYPE_ICONS: Record<string, string> = {
  score_drop: '📉',
  score_rise: '📈',
  viral_post: '🔥',
  inactive: '😴',
  new_milestone: '🏆',
  anomaly: '⚠️',
  campaign_target: '🎯',
};

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/alerts')
      .then((r) => r.json())
      .then((d) => setAlerts(d.data || []));
  }, []);

  const markRead = async (id: string) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      body: JSON.stringify({ id, read: true }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between">
          Alerts
          {alerts.length > 0 && (
            <Badge variant="destructive">{alerts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No new alerts ✨</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                onClick={() => markRead(alert.id)}
              >
                <span className="text-xl">{TYPE_ICONS[alert.type] || '📌'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{alert.title}</span>
                    <Badge className={`text-xs ${SEVERITY_STYLES[alert.severity]}`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 8. Development Roadmap (14-Day MVP Sprint)

### Week 1: Foundation

| Day | Tasks |
|-----|-------|
| **1** | Project init: Next.js + Supabase setup, DB schema migration, auth config, env vars |
| **2** | Creator CRUD API + basic creator list UI. Seed with 10 test creators |
| **3** | TikTok scraper v1 (Playwright). Test against 5 accounts. Store posts in DB |
| **4** | Revenue estimation engine. Campaign CRUD. Wire campaign params to estimation |
| **5** | Scoring algorithm implementation. Daily score calculation endpoint |

### Week 2: Dashboard + Polish

| Day | Tasks |
|-----|-------|
| **6** | Dashboard API endpoint. KPI cards + top performers chart |
| **7** | Creator detail page: radar chart, score history, post list |
| **8** | Alerts system: trigger logic (score drops, viral posts, inactivity) |
| **9** | Scheduled scraping (Vercel cron or pg_cron). Bulk score recalculation |
| **10** | Multi-tenancy: org isolation, invite flow, RLS policies tested |

### Week 3: Launch Prep

| Day | Tasks |
|-----|-------|
| **11** | UI polish: responsive, loading states, error handling, empty states |
| **12** | Testing: E2E tests, scoring accuracy validation, scraper reliability |
| **13** | Deploy to Vercel + Supabase. Custom domain. Monitoring (Sentry) |
| **14** | Demo prep: seed Goli data, build pitch deck, record demo video |

---

## 9. Pitch Deck Outline (Goli Gummy & Comfort)

### Slide Structure

1. **Title** — "CPIP: Know Which Creators Actually Drive Revenue"
2. **Problem** — You have 500+ creators. You don't know who's performing. Spreadsheets don't scale. You're overpaying underperformers and underinvesting in top talent.
3. **Solution** — Automated creator performance intelligence. Track engagement, estimate revenue, rank creators by composite score. One dashboard.
4. **How It Works** — [Screenshot of dashboard] Auto-scrape → Score → Rank → Act
5. **Revenue Model** — Views × CTR × CVR × AOV × Commission. Configurable per campaign.
6. **Scoring** — S/A/B/C/D tiers. Weighted: Revenue 30%, Engagement 25%, Consistency 20%, Reach 15%, Growth 10%.
7. **Key Insights** — Who's trending up? Who went inactive? Which posts went viral? Where's the ROI?
8. **Live Demo** — [Walk through dashboard, creator detail, alerts]
9. **Results** — "Brands using creator analytics see 2-3x ROI improvement on affiliate spend" (cite: CreatorIQ, impact.com reports)
10. **Pricing** — Free: 50 creators. Pro ($299/mo): 500 creators. Enterprise: custom.
11. **Roadmap** — TikTok Shop API integration, Instagram/YouTube expansion, AI-powered creator recommendations, automated outreach
12. **Ask** — Pilot program: 30 days free, track your top 100 creators, prove the value

### Customization Notes

**For Goli Gummy:**
- Health/supplement vertical benchmarks
- AOV ~$20-30, typical commission 15-20%
- Emphasis: finding micro-creators with high CVR (not just views)

**For Comfort:**
- Lifestyle/home vertical
- Emphasis: consistency tracking (they need reliable posters)

---

## 10. Testing Plan

### Unit Tests

| Component | Test Cases |
|-----------|------------|
| `estimateRevenue()` | Zero views, typical values, extreme values, rounding |
| `calculateCreatorScore()` | Empty posts, single post, 30-day window, all zero engagement |
| `parseCount()` | "1.2K", "3.5M", "500", "0", edge cases |

### Integration Tests

| Flow | Validation |
|------|------------|
| Creator → Scrape → Estimate → Score | End-to-end pipeline produces valid scores |
| Dashboard API | Returns correct aggregations for multi-creator campaign |
| Auth + RLS | Org A cannot see Org B's data |

### Scraper Reliability

| Test | Criteria |
|------|----------|
| Rate limiting | Scraper handles 429 responses gracefully |
| Profile not found | Returns empty array, logs error |
| Changed DOM structure | Fails gracefully, alerts dev team |
| Concurrent scrapes | 10 creators simultaneously without crashes |

### Metric Validation

| Assumption | Validation Method |
|------------|-------------------|
| CTR 1-3% for TikTok Shop | Cross-reference with TikTok Shop seller center data from pilot client |
| CVR 2-5% for health/supplements | Compare estimates to actual TikTok Shop revenue (manual check first month) |
| Scoring weights produce useful tiers | Have brand managers rank their top 20 creators manually, compare to algorithm |
| Engagement rate benchmarks | Scrape 100 random TikTok Shop creators, establish percentile distribution |

### UAT Checklist

- [ ] Brand manager can log in, see their creators
- [ ] Scores update daily and feel "right" vs. intuition
- [ ] Revenue estimates within 30% of actual (validated in pilot)
- [ ] Alerts fire for score drops > 15 points
- [ ] Dashboard loads < 2 seconds
- [ ] Mobile responsive

---

## Architecture Decisions Log

| Decision | Rationale |
|----------|-----------|
| Supabase over raw Postgres | Auth, RLS, real-time, edge functions — all built-in. Faster to MVP. |
| Playwright over TikTok API | No API approval needed. Faster to start. Switch later. |
| Generated columns for revenue | Revenue calc is deterministic — computed at DB level avoids drift. |
| Daily score snapshots | Enables trend analysis. Point-in-time scoring avoids recalculation debates. |
| Weighted composite score | Simple, explainable, tunable. Brands can understand why a creator ranks where they do. |
| shadcn/ui | Copy-paste components, no dependency lock-in, full customization control. |
