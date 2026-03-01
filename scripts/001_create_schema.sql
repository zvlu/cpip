-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ORGANIZATIONS (multi-tenant)
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  plan text default 'free' check (plan in ('free', 'pro', 'enterprise')),
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- USERS (brand team members)
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  email text not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now()
);

-- CAMPAIGNS
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  product_name text,
  aov numeric(10,2) default 0,
  commission_rate numeric(5,4) default 0,
  default_ctr numeric(5,4) default 0.02,
  default_cvr numeric(5,4) default 0.03,
  status text default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CREATORS
create table if not exists creators (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  tiktok_username text not null,
  tiktok_uid text,
  display_name text,
  avatar_url text,
  follower_count integer default 0,
  bio text,
  category text,
  tags text[] default '{}',
  status text default 'active' check (status in ('active', 'inactive', 'blacklisted')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, tiktok_username)
);

-- CREATOR-CAMPAIGN JUNCTION
create table if not exists campaign_creators (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  custom_commission numeric(5,4),
  joined_at timestamptz default now(),
  unique(campaign_id, creator_id)
);

-- POSTS (scraped TikTok data)
create table if not exists posts (
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

create index if not exists idx_posts_creator on posts(creator_id);
create index if not exists idx_posts_campaign on posts(campaign_id);
create index if not exists idx_posts_posted_at on posts(posted_at desc);

-- REVENUE ESTIMATES
create table if not exists revenue_estimates (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references posts(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  views integer not null,
  ctr numeric(5,4) not null,
  cvr numeric(5,4) not null,
  aov numeric(10,2) not null,
  commission_rate numeric(5,4) not null,
  estimated_clicks integer generated always as (floor(views * ctr)::integer) stored,
  estimated_conversions numeric(10,2) generated always as (floor(views * ctr) * cvr) stored,
  estimated_gmv numeric(12,2) generated always as (floor(views * ctr) * cvr * aov) stored,
  estimated_revenue numeric(12,2) generated always as (floor(views * ctr) * cvr * aov * commission_rate) stored,
  calculated_at timestamptz default now(),
  unique(post_id, campaign_id)
);

-- PERFORMANCE SCORES (daily snapshots)
create table if not exists performance_scores (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  score_date date not null default current_date,
  engagement_score numeric(5,2) default 0,
  consistency_score numeric(5,2) default 0,
  revenue_score numeric(5,2) default 0,
  growth_score numeric(5,2) default 0,
  reach_score numeric(5,2) default 0,
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

create index if not exists idx_scores_creator_date on performance_scores(creator_id, score_date desc);

-- ALERTS
create table if not exists alerts (
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

create index if not exists idx_alerts_org on alerts(org_id, created_at desc);

-- SCRAPE LOG
create table if not exists scrape_log (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  status text check (status in ('success', 'failed', 'partial')),
  posts_found integer default 0,
  error_message text,
  duration_ms integer,
  scraped_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table organizations enable row level security;
alter table users enable row level security;
alter table creators enable row level security;
alter table posts enable row level security;
alter table campaigns enable row level security;
alter table campaign_creators enable row level security;
alter table alerts enable row level security;
alter table performance_scores enable row level security;
alter table revenue_estimates enable row level security;
alter table scrape_log enable row level security;

-- RLS Policies: Users can only see their org's data
create policy "users_select_own" on users for select using (auth.uid() = id);
create policy "users_update_own" on users for update using (auth.uid() = id);

create policy "org_isolation_select" on organizations for select
  using (id in (select org_id from users where id = auth.uid()));

create policy "org_isolation" on creators
  for all using (org_id in (select org_id from users where id = auth.uid()));

create policy "org_isolation" on campaigns
  for all using (org_id in (select org_id from users where id = auth.uid()));

create policy "org_isolation" on alerts
  for all using (org_id in (select org_id from users where id = auth.uid()));

create policy "campaign_creators_access" on campaign_creators
  for all using (
    campaign_id in (select id from campaigns where org_id in (select org_id from users where id = auth.uid()))
  );

create policy "posts_access" on posts
  for all using (
    creator_id in (select id from creators where org_id in (select org_id from users where id = auth.uid()))
  );

create policy "scores_access" on performance_scores
  for all using (
    creator_id in (select id from creators where org_id in (select org_id from users where id = auth.uid()))
  );

create policy "revenue_access" on revenue_estimates
  for all using (
    post_id in (select id from posts where creator_id in (select id from creators where org_id in (select org_id from users where id = auth.uid())))
  );

create policy "scrape_log_access" on scrape_log
  for all using (
    creator_id in (select id from creators where org_id in (select org_id from users where id = auth.uid()))
  );
