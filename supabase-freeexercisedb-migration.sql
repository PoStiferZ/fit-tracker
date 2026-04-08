ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS source_id TEXT UNIQUE;
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS instructions TEXT;
