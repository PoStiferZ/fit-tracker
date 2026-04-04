-- Per-set reps for strength exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS work_reps_per_set INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS warmup_reps_per_set INTEGER[] NOT NULL DEFAULT '{}';
-- Rest times in seconds between sets (length = sets - 1, or sets for simplicity)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS work_rest_seconds INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS warmup_rest_seconds INTEGER[] NOT NULL DEFAULT '{}';
-- Cardio rest too
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS cardio_rest_seconds INTEGER[] NOT NULL DEFAULT '{}';
