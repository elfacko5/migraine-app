-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- to create the tables this app syncs to. Mirrors the local Attack/Snapshot
-- shape in src/types/index.ts — snapshots stay a jsonb array rather than
-- their own table, since they're always read/written as a whole with their
-- parent attack, never queried independently.

create table if not exists attacks (
  id bigint primary key,                        -- matches the client's Date.now() id
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  snapshots jsonb not null default '[]'::jsonb,
  end_time timestamptz,                          -- null while ongoing
  triggers text[] not null default '{}',
  notification_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists attacks_user_id_idx on attacks (user_id);

alter table attacks enable row level security;

create policy "Users manage their own attacks"
  on attacks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per user: trigger/symptom/relief lists + saved settings.
create table if not exists user_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  triggers text[] not null default '{}',
  symptoms text[] not null default '{}',
  reliefs text[] not null default '{}',
  notification_default jsonb,
  text_scale text,
  brightness numeric,
  updated_at timestamptz not null default now()
);

alter table user_prefs enable row level security;

create policy "Users manage their own prefs"
  on user_prefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
