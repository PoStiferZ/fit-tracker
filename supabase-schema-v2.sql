-- À exécuter dans Supabase SQL Editor
-- https://supabase.com/dashboard/project/ycnhfxuwqtwnnjgzniwmw/sql/new

create table if not exists active_program (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade not null,
  program_id uuid references programs(id) on delete cascade not null,
  recurrence_months integer not null default 1 check (recurrence_months in (1,2,3,4,6)),
  started_at date not null default current_date,
  created_at timestamptz default now(),
  unique(profile_id)
);

alter table active_program disable row level security;
