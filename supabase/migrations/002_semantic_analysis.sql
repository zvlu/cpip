-- 002_semantic_analysis.sql
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists post_semantic_features (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  creator_id uuid not null references creators(id) on delete cascade,
  campaign_id text,
  topic_labels text[] default '{}',
  hook_type text,
  cta_strength numeric(5,2) default 0,
  sentiment_score numeric(5,2) default 50,
  brand_safety_score numeric(5,2) default 100,
  audience_intent text,
  semantic_summary text,
  model_provider text,
  model_name text,
  confidence numeric(5,2) default 0,
  raw_response jsonb default '{}',
  analyzed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(post_id)
);

create index if not exists idx_post_semantic_creator on post_semantic_features(creator_id);
create index if not exists idx_post_semantic_campaign on post_semantic_features(campaign_id);

create table if not exists creator_semantic_profiles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  campaign_id text not null,
  top_topics text[] default '{}',
  content_consistency numeric(5,2) default 0,
  average_sentiment numeric(5,2) default 0,
  audience_demographic_match numeric(5,2) default 50,
  recommendations text[] default '{}',
  metadata jsonb default '{}',
  analyzed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(creator_id, campaign_id)
);

create index if not exists idx_creator_semantic_profiles_campaign on creator_semantic_profiles(campaign_id);
