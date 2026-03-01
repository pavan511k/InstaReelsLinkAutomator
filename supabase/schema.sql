-- =============================================
-- AutoDM Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Connected accounts (Instagram / Facebook / Both)
create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null check (platform in ('instagram', 'facebook', 'both')),
  -- Meta/Facebook fields
  meta_user_id text,
  access_token text not null,
  token_expires_at timestamptz,
  -- Instagram fields
  ig_user_id text,
  ig_username text,
  ig_profile_picture_url text,
  -- Facebook fields
  fb_page_id text,
  fb_page_name text,
  fb_page_access_token text,
  -- Metadata
  scopes text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table connected_accounts enable row level security;

-- Users can only see/edit their own accounts
create policy "Users can view own accounts"
  on connected_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert own accounts"
  on connected_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own accounts"
  on connected_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete own accounts"
  on connected_accounts for delete
  using (auth.uid() = user_id);

-- Instagram posts table
create table if not exists instagram_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references connected_accounts(id) on delete cascade not null,
  ig_post_id text not null unique,
  media_type text,
  media_url text,
  thumbnail_url text,
  caption text,
  permalink text,
  timestamp timestamptz,
  is_story boolean default false,
  story_expires_at timestamptz,
  is_skipped boolean default false,
  synced_at timestamptz default now()
);

alter table instagram_posts enable row level security;

create policy "Users can view own posts"
  on instagram_posts for select
  using (
    account_id in (
      select id from connected_accounts where user_id = auth.uid()
    )
  );

create policy "Users can manage own posts"
  on instagram_posts for all
  using (
    account_id in (
      select id from connected_accounts where user_id = auth.uid()
    )
  );

-- DM Automations
create table if not exists dm_automations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references instagram_posts(id) on delete cascade not null,
  dm_type text not null check (dm_type in ('button_template', 'message_template', 'post_reels')),
  config jsonb not null default '{}',
  trigger_type text default 'keywords',
  trigger_keywords text[] default '{}',
  exclude_keywords boolean default false,
  send_once_per_user boolean default true,
  exclude_mentions boolean default false,
  delay_message boolean default false,
  disable_universal_triggers boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table dm_automations enable row level security;

create policy "Users can manage own automations"
  on dm_automations for all
  using (
    post_id in (
      select ip.id from instagram_posts ip
      join connected_accounts ca on ip.account_id = ca.id
      where ca.user_id = auth.uid()
    )
  );

-- Analytics events
create table if not exists dm_analytics (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references dm_automations(id) on delete cascade not null,
  event_type text not null check (event_type in ('sent', 'opened', 'clicked', 'comment')),
  ig_user_id text,
  created_at timestamptz default now()
);

alter table dm_analytics enable row level security;

create policy "Users can view own analytics"
  on dm_analytics for select
  using (
    automation_id in (
      select da.id from dm_automations da
      join instagram_posts ip on da.post_id = ip.id
      join connected_accounts ca on ip.account_id = ca.id
      where ca.user_id = auth.uid()
    )
  );
