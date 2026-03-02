-- 005_rls_hardening.sql
-- Enforce tenant isolation by tying all data access to auth.uid() -> users.org_id.

create or replace function public.requesting_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

grant execute on function public.requesting_user_org_id() to authenticated;

alter table if exists public.users enable row level security;
alter table if exists public.organizations enable row level security;
alter table if exists public.campaigns enable row level security;
alter table if exists public.creators enable row level security;
alter table if exists public.alerts enable row level security;
alter table if exists public.campaign_creators enable row level security;
alter table if exists public.posts enable row level security;
alter table if exists public.revenue_estimates enable row level security;
alter table if exists public.performance_scores enable row level security;
alter table if exists public.scrape_log enable row level security;
alter table if exists public.post_semantic_features enable row level security;
alter table if exists public.creator_semantic_profiles enable row level security;
alter table if exists public.predictive_scores enable row level security;

do $$
begin
  -- users: only allow each user to read/write their own membership row.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_self_access') then
    execute 'create policy users_self_access on public.users for all using (id = auth.uid()) with check (id = auth.uid())';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'organizations_org_isolation') then
    execute 'create policy organizations_org_isolation on public.organizations for all using (id = public.requesting_user_org_id()) with check (id = public.requesting_user_org_id())';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campaigns' and policyname = 'campaigns_org_isolation_v2') then
    execute 'create policy campaigns_org_isolation_v2 on public.campaigns for all using (org_id = public.requesting_user_org_id()) with check (org_id = public.requesting_user_org_id())';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'creators' and policyname = 'creators_org_isolation_v2') then
    execute 'create policy creators_org_isolation_v2 on public.creators for all using (org_id = public.requesting_user_org_id()) with check (org_id = public.requesting_user_org_id())';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'alerts' and policyname = 'alerts_org_isolation_v2') then
    execute 'create policy alerts_org_isolation_v2 on public.alerts for all using (org_id = public.requesting_user_org_id()) with check (org_id = public.requesting_user_org_id())';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campaign_creators' and policyname = 'campaign_creators_org_isolation') then
    execute 'create policy campaign_creators_org_isolation on public.campaign_creators for all using (
      exists (
        select 1
        from public.campaigns c
        where c.id = campaign_creators.campaign_id
          and c.org_id = public.requesting_user_org_id()
      )
      and exists (
        select 1
        from public.creators cr
        where cr.id = campaign_creators.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.campaigns c
        where c.id = campaign_creators.campaign_id
          and c.org_id = public.requesting_user_org_id()
      )
      and exists (
        select 1
        from public.creators cr
        where cr.id = campaign_creators.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_org_isolation') then
    execute 'create policy posts_org_isolation on public.posts for all using (
      exists (
        select 1
        from public.creators cr
        where cr.id = posts.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.creators cr
        where cr.id = posts.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'revenue_estimates' and policyname = 'revenue_estimates_org_isolation') then
    execute 'create policy revenue_estimates_org_isolation on public.revenue_estimates for all using (
      exists (
        select 1
        from public.campaigns c
        where c.id = revenue_estimates.campaign_id
          and c.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.campaigns c
        where c.id = revenue_estimates.campaign_id
          and c.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'performance_scores' and policyname = 'performance_scores_org_isolation') then
    execute 'create policy performance_scores_org_isolation on public.performance_scores for all using (
      exists (
        select 1
        from public.campaigns c
        where c.id = performance_scores.campaign_id
          and c.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.campaigns c
        where c.id = performance_scores.campaign_id
          and c.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scrape_log' and policyname = 'scrape_log_org_isolation') then
    execute 'create policy scrape_log_org_isolation on public.scrape_log for all using (
      exists (
        select 1
        from public.creators cr
        where cr.id = scrape_log.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.creators cr
        where cr.id = scrape_log.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if to_regclass('public.post_semantic_features') is not null
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'post_semantic_features' and policyname = 'post_semantic_features_org_isolation') then
    execute 'create policy post_semantic_features_org_isolation on public.post_semantic_features for all using (
      exists (
        select 1
        from public.creators cr
        where cr.id = post_semantic_features.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.creators cr
        where cr.id = post_semantic_features.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if to_regclass('public.creator_semantic_profiles') is not null
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'creator_semantic_profiles' and policyname = 'creator_semantic_profiles_org_isolation') then
    execute 'create policy creator_semantic_profiles_org_isolation on public.creator_semantic_profiles for all using (
      exists (
        select 1
        from public.creators cr
        where cr.id = creator_semantic_profiles.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.creators cr
        where cr.id = creator_semantic_profiles.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    )';
  end if;

  if to_regclass('public.predictive_scores') is not null
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'predictive_scores' and policyname = 'predictive_scores_org_isolation') then
    execute 'create policy predictive_scores_org_isolation on public.predictive_scores for all using (
      exists (
        select 1
        from public.creators cr
        where cr.id = predictive_scores.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    ) with check (
      exists (
        select 1
        from public.creators cr
        where cr.id = predictive_scores.creator_id
          and cr.org_id = public.requesting_user_org_id()
      )
    )';
  end if;
end $$;
