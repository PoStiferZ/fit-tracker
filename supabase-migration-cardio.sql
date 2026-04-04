-- Cardio fields on exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'strength';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS cardio_sets INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS cardio_durations NUMERIC[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS cardio_inclines NUMERIC[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS cardio_speeds NUMERIC[] NOT NULL DEFAULT '{}';

-- Supersets in programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS superset_pairs JSONB NOT NULL DEFAULT '[]';
