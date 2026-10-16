/*
  # Update team budget and transfer market improvements

  1. Changes
    - Update default team budget to 100M
    - Add indexes for better transfer market filtering
*/

-- Update default budget for teams table
ALTER TABLE teams ALTER COLUMN budget SET DEFAULT 100000000;

-- Add indexes for better transfer market filtering
CREATE INDEX IF NOT EXISTS idx_available_players_position ON available_players (position);
CREATE INDEX IF NOT EXISTS idx_available_players_rating ON available_players (rating);
CREATE INDEX IF NOT EXISTS idx_available_players_value ON available_players (value);
CREATE INDEX IF NOT EXISTS idx_available_players_nationality ON available_players (nationality);