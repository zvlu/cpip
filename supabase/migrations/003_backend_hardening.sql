-- 003_backend_hardening.sql
create extension if not exists pgcrypto;

-- Predictive scores table (referenced by API routes).
create table if not exists predictive_scores (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  conversion_probability numeric(5,2) default 0,
  viral_potential numeric(5,2) default 0,
  overall_roi_score numeric(5,2) default 0,
  tier text,
  recommendations text[] default '{}',
  risk_factors text[] default '{}',
  calculated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(creator_id, campaign_id)
);

-- Normalize semantic campaign references to UUID + FK.
alter table if exists post_semantic_features
  alter column campaign_id type uuid using campaign_id::uuid;
alter table if exists creator_semantic_profiles
  alter column campaign_id type uuid using campaign_id::uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_semantic_features_campaign_id_fkey'
  ) then
    alter table post_semantic_features
      add constraint post_semantic_features_campaign_id_fkey
      foreign key (campaign_id) references campaigns(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_semantic_profiles_campaign_id_fkey'
  ) then
    alter table creator_semantic_profiles
      add constraint creator_semantic_profiles_campaign_id_fkey
      foreign key (campaign_id) references campaigns(id) on delete cascade;
  end if;
end $$;

-- Enable RLS for tables missing coverage.
alter table if exists organizations enable row level security;
alter table if exists posts enable row level security;
alter table if exists campaign_creators enable row level security;
alter table if exists performance_scores enable row level security;
alter table if exists revenue_estimates enable row level security;
alter table if exists scrape_log enable row level security;
alter table if exists predictive_scores enable row level security;
alter table if exists post_semantic_features enable row level security;
alter table if exists creator_semantic_profiles enable row level security;

-- Organizations policy: user can read only their own organization.
drop policy if exists organizations_org_isolation on organizations;
create policy organizations_org_isolation
  on organizations
  for all
  using (id = (select org_id from users where id = auth.uid()))
  with check (id = (select org_id from users where id = auth.uid()));

-- Posts policy: post must belong to creator/campaign in caller org.
drop policy if exists posts_org_isolation on posts;
create policy posts_org_isolation
  on posts
  for all
  using (
    exists (
      select 1
      from creators c
      where c.id = posts.creator_id
        and c.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from creators c
      where c.id = posts.creator_id
        and c.org_id = (select org_id from users where id = auth.uid())
    )
  );

-- Campaign creator links.
drop policy if exists campaign_creators_org_isolation on campaign_creators;
create policy campaign_creators_org_isolation
  on campaign_creators
  for all
  using (
    exists (
      select 1
      from campaigns ca
      where ca.id = campaign_creators.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from campaigns ca
      where ca.id = campaign_creators.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  );

-- Performance scores.
drop policy if exists performance_scores_org_isolation on performance_scores;
create policy performance_scores_org_isolation
  on performance_scores
  for all
  using (
    exists (
      select 1
      from campaigns ca
      where ca.id = performance_scores.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from campaigns ca
      where ca.id = performance_scores.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  );

-- Revenue estimates.
drop policy if exists revenue_estimates_org_isolation on revenue_estimates;
create policy revenue_estimates_org_isolation
  on revenue_estimates
  for all
  using (
    exists (
      select 1
      from campaigns ca
      where ca.id = revenue_estimates.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from campaigns ca
      where ca.id = revenue_estimates.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  );

-- Scrape log.
drop policy if exists scrape_log_org_isolation on scrape_log;
create policy scrape_log_org_isolation
  on scrape_log
  for all
  using (
    exists (
      select 1
      from creators c
      where c.id = scrape_log.creator_id
        and c.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from creators c
      where c.id = scrape_log.creator_id
        and c.org_id = (select org_id from users where id = auth.uid())
    )
  );

-- Predictive scores.
drop policy if exists predictive_scores_org_isolation on predictive_scores;
create policy predictive_scores_org_isolation
  on predictive_scores
  for all
  using (
    exists (
      select 1
      from campaigns ca
      where ca.id = predictive_scores.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from campaigns ca
      where ca.id = predictive_scores.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  );

-- Semantic tables.
drop policy if exists post_semantic_features_org_isolation on post_semantic_features;
create policy post_semantic_features_org_isolation
  on post_semantic_features
  for all
  using (
    exists (
      select 1
      from campaigns ca
      where ca.id = post_semantic_features.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from campaigns ca
      where ca.id = post_semantic_features.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  );

drop policy if exists creator_semantic_profiles_org_isolation on creator_semantic_profiles;
create policy creator_semantic_profiles_org_isolation
  on creator_semantic_profiles
  for all
  using (
    exists (
      select 1
      from campaigns ca
      where ca.id = creator_semantic_profiles.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from campaigns ca
      where ca.id = creator_semantic_profiles.campaign_id
        and ca.org_id = (select org_id from users where id = auth.uid())
    )
  );
