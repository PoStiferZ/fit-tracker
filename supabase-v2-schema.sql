-- ============================================================
-- Fitrack v2 — Full schema migration
-- Run this in Supabase SQL Editor
-- ⚠️ This drops exercises, workout_sessions, workout_sets, exercise_load_history
-- ============================================================

-- 1. Drop old tables
DROP TABLE IF EXISTS workout_sets CASCADE;
DROP TABLE IF EXISTS workout_sessions CASCADE;
DROP TABLE IF EXISTS exercise_load_history CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;

-- 2. Global exercise library (read-only for users)
CREATE TABLE IF NOT EXISTS exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  muscles_primary TEXT[] NOT NULL DEFAULT '{}',
  muscles_secondary TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT NOT NULL DEFAULT 'bodyweight', -- barbell|dumbbell|cable|machine|bodyweight|cardio
  exercise_type TEXT NOT NULL DEFAULT 'strength', -- strength|cardio
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Custom exercises (per user, private)
CREATE TABLE IF NOT EXISTS custom_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscles_primary TEXT[] NOT NULL DEFAULT '{}',
  muscles_secondary TEXT[] NOT NULL DEFAULT '{}',
  equipment TEXT NOT NULL DEFAULT 'bodyweight',
  exercise_type TEXT NOT NULL DEFAULT 'strength',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Workouts (séances) — belong to a program
CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Exercises within a workout (config per user)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  library_exercise_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL,
  custom_exercise_id UUID REFERENCES custom_exercises(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'library', -- library|custom
  order_index INTEGER NOT NULL DEFAULT 0,
  superset_with UUID REFERENCES workout_exercises(id) ON DELETE SET NULL,
  -- Work sets
  work_sets INTEGER NOT NULL DEFAULT 3,
  work_reps_per_set INTEGER[] NOT NULL DEFAULT '{}',
  work_loads NUMERIC[] NOT NULL DEFAULT '{}',
  work_rest_seconds INTEGER[] NOT NULL DEFAULT '{}',
  -- Warmup sets
  warmup_sets INTEGER NOT NULL DEFAULT 0,
  warmup_reps_per_set INTEGER[] NOT NULL DEFAULT '{}',
  warmup_loads NUMERIC[] NOT NULL DEFAULT '{}',
  warmup_rest_seconds INTEGER[] NOT NULL DEFAULT '{}',
  -- Cardio
  cardio_sets INTEGER NOT NULL DEFAULT 0,
  cardio_durations NUMERIC[] NOT NULL DEFAULT '{}',
  cardio_inclines NUMERIC[] NOT NULL DEFAULT '{}',
  cardio_speeds NUMERIC[] NOT NULL DEFAULT '{}',
  cardio_rest_seconds INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. History of config changes (auto-saved before update)
CREATE TABLE IF NOT EXISTS workout_exercise_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  work_sets INTEGER,
  work_reps_per_set INTEGER[],
  work_loads NUMERIC[],
  work_rest_seconds INTEGER[],
  warmup_sets INTEGER,
  warmup_reps_per_set INTEGER[],
  warmup_loads NUMERIC[],
  warmup_rest_seconds INTEGER[],
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Modify programs: add recurrence (in weeks, null = off)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS recurrence_weeks INTEGER;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS recurrence_until DATE;

-- 8. Modify weekly_plan: use workout_id instead of program_id for day assignment
ALTER TABLE weekly_plan ADD COLUMN IF NOT EXISTS workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL;
ALTER TABLE weekly_plan ADD COLUMN IF NOT EXISTS is_override BOOLEAN NOT NULL DEFAULT false;
-- program_id stays for context

-- 9. RLS policies (enable if using RLS)
-- ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Library is public" ON exercise_library FOR SELECT USING (true);
-- ALTER TABLE custom_exercises ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users own custom exercises" ON custom_exercises USING (profile_id = current_setting('app.profile_id')::uuid);
