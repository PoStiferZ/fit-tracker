-- Add profile_id to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Add profile_id to programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Add profile_id to weekly_plan
ALTER TABLE weekly_plan ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Add profile_id to supplements
ALTER TABLE supplements ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Add profile_id to exercise_load_history
ALTER TABLE exercise_load_history ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Drop old unique constraint on weekly_plan and recreate with profile_id
ALTER TABLE weekly_plan DROP CONSTRAINT IF EXISTS weekly_plan_day_of_week_week_start_key;
ALTER TABLE weekly_plan ADD CONSTRAINT weekly_plan_profile_day_week_unique UNIQUE (profile_id, day_of_week, week_start);
