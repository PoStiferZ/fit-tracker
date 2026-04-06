-- ============================================================
-- Fitrack — Live session tracking
-- ============================================================

-- Table session active
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active|finished|abandoned
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des séries effectuées
CREATE TABLE IF NOT EXISTS live_session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL, -- 0-based index dans la série
  set_type TEXT NOT NULL DEFAULT 'work', -- work|warmup|cardio
  reps INTEGER,
  weight_kg NUMERIC,
  rest_seconds INTEGER,
  duration_seconds INTEGER, -- pour cardio
  skipped BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
