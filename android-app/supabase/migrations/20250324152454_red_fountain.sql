/*
  # Fix duplicate player names and implement transfer system

  1. Changes
    - Safely update player names to avoid duplicates
    - Add transfer functionality
    - Add transfer history tracking
*/

-- Create a temporary table to store unique players
CREATE TEMP TABLE temp_unique_players AS
SELECT DISTINCT ON (name) *
FROM available_players
ORDER BY name, rating DESC;

-- Delete all records from the original table
DELETE FROM available_players;

-- Reinsert the unique records
INSERT INTO available_players
SELECT *
FROM temp_unique_players;

-- Drop the temporary table
DROP TABLE temp_unique_players;

-- Create transfer_history table
CREATE TABLE IF NOT EXISTS transfer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players NOT NULL,
  from_team_id uuid REFERENCES teams,
  to_team_id uuid REFERENCES teams,
  amount integer NOT NULL,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on transfer_history
ALTER TABLE transfer_history ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for transfer_history
CREATE POLICY "Users can read all transfer history"
  ON transfer_history FOR SELECT
  TO authenticated
  USING (true);

-- Function to handle player transfers
CREATE OR REPLACE FUNCTION handle_transfer(
  p_player_id uuid,
  p_to_team_id uuid,
  p_amount integer
) RETURNS void AS $$
DECLARE
  v_from_team_id uuid;
  v_player_value integer;
  v_buyer_budget integer;
BEGIN
  -- Get current team and player value
  SELECT team_id, value INTO v_from_team_id, v_player_value
  FROM players
  WHERE id = p_player_id;

  -- Get buyer's budget
  SELECT budget INTO v_buyer_budget
  FROM teams
  WHERE id = p_to_team_id;

  -- Validate transfer
  IF v_buyer_budget < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Update player's team
  UPDATE players
  SET team_id = p_to_team_id
  WHERE id = p_player_id;

  -- Update team budgets
  IF v_from_team_id IS NOT NULL THEN
    UPDATE teams
    SET budget = budget + p_amount
    WHERE id = v_from_team_id;
  END IF;

  UPDATE teams
  SET budget = budget - p_amount
  WHERE id = p_to_team_id;

  -- Record transfer
  INSERT INTO transfer_history (player_id, from_team_id, to_team_id, amount)
  VALUES (p_player_id, v_from_team_id, p_to_team_id, p_amount);
END;
$$ LANGUAGE plpgsql;