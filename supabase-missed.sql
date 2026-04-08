-- Add missed column to weekly_plan
ALTER TABLE weekly_plan
  ADD COLUMN IF NOT EXISTS missed boolean NOT NULL DEFAULT false;
