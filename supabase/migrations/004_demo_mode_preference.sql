-- 004_demo_mode_preference.sql
-- Store per-user demo mode preferences and onboarding state.

alter table if exists public.users
  add column if not exists use_demo_data boolean not null default false;

alter table if exists public.users
  add column if not exists demo_mode_prompt_seen boolean not null default false;
