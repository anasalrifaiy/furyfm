/*
  # Update team budgets to 100M

  1. Changes
    - Update all existing teams to have 100M budget
    - Ensure new teams start with 100M budget
*/

-- Update all existing teams to have 100M budget
UPDATE teams SET budget = 100000000;

-- Make sure the default is set to 100M for new teams
ALTER TABLE teams ALTER COLUMN budget SET DEFAULT 100000000;

-- Add a comment to explain the budget value
COMMENT ON COLUMN teams.budget IS 'Team budget in currency units (default: 100M)';