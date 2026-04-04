-- Run this in the Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/ycnhfxuwqtwnnjgzniwmw/sql/new

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text not null unique,
  birth_date date not null,
  height_cm integer not null,
  weight_kg numeric(5,2) not null,
  created_at timestamptz default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  muscles text[] not null default '{}',
  work_sets integer not null default 3,
  work_reps integer not null default 10,
  warmup_sets integer not null default 2,
  warmup_reps integer not null default 15,
  work_loads numeric[] not null default '{}',
  warmup_loads numeric[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  exercise_ids uuid[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists weekly_plan (
  id serial primary key,
  day_of_week integer not null check (day_of_week between 1 and 7),
  program_id uuid references programs(id) on delete set null,
  completed boolean not null default false,
  week_start date not null,
  unique(day_of_week, week_start)
);

-- Disable RLS for personal use
alter table profiles disable row level security;
alter table exercises disable row level security;
alter table programs disable row level security;
alter table weekly_plan disable row level security;

-- Storage bucket for exercise images (run separately if needed)
-- insert into storage.buckets (id, name, public) values ('exercise-images', 'exercise-images', true)
-- on conflict do nothing;
