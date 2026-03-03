-- 007_scrape_jobs.sql
-- Adds async scrape job queue and richer scrape logging fields.

alter table if exists public.scrape_log
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists scrape_job_id uuid,
  add column if not exists request_id text,
  add column if not exists details jsonb default '{}'::jsonb;

create index if not exists idx_scrape_log_org_scraped_at
  on public.scrape_log(org_id, scraped_at desc);

create table if not exists public.scrape_jobs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  requested_by uuid references public.users(id) on delete set null,
  request_id text,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  priority integer not null default 100,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  lock_token text,
  lock_expires_at timestamptz,
  error_message text,
  result jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_scrape_jobs_active_creator
  on public.scrape_jobs(org_id, creator_id, campaign_id)
  where status in ('queued', 'running');

create index if not exists idx_scrape_jobs_status_available
  on public.scrape_jobs(status, available_at asc, priority asc, created_at asc);

alter table if exists public.scrape_jobs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scrape_jobs'
      and policyname = 'scrape_jobs_org_isolation'
  ) then
    execute 'create policy scrape_jobs_org_isolation on public.scrape_jobs for all
      using (org_id = public.requesting_user_org_id())
      with check (org_id = public.requesting_user_org_id())';
  end if;
end $$;
