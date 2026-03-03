-- 006 recommendation tasks and alert rules
-- Adds workflow tracking for dashboard recommendations.

create table if not exists public.recommendation_tasks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  recommendation_id text not null,
  action text not null check (action in ('scale','watch','pause','investigate')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  title text not null,
  reason text,
  status text not null default 'open' check (status in ('open','in_progress','done','dismissed')),
  owner text,
  notes text,
  due_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_reco_tasks_unique_open
  on public.recommendation_tasks(org_id, campaign_id, recommendation_id)
  where status in ('open', 'in_progress');

create index if not exists idx_reco_tasks_org_created
  on public.recommendation_tasks(org_id, created_at desc);

alter table if exists public.recommendation_tasks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recommendation_tasks'
      and policyname = 'recommendation_tasks_org_isolation'
  ) then
    execute 'create policy recommendation_tasks_org_isolation on public.recommendation_tasks for all
      using (org_id = public.requesting_user_org_id())
      with check (org_id = public.requesting_user_org_id())';
  end if;
end $$;
