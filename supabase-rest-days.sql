-- Add rest_days column to active_program
-- rest_days: array of ints, 1=Monday … 7=Sunday
ALTER TABLE active_program
  ADD COLUMN IF NOT EXISTS rest_days integer[] NOT NULL DEFAULT '{}';
