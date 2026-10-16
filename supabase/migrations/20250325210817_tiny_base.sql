/*
  # Adjust Player Values and Reset Squads

  1. Changes
    - Reset all team squads
    - Update player values to be more affordable
    - Maintain budget at 100M
    - Keep player ratings and positions intact
*/

-- First, delete all existing players from teams
DELETE FROM players;

-- Reset all team budgets to 100M
UPDATE teams SET budget = 100000000;

-- Update available players' values to be more affordable
UPDATE available_players
SET value = 
  CASE 
    WHEN rating >= 90 THEN rating * 500000  -- 90+ rated players: 45-50M
    WHEN rating >= 85 THEN rating * 400000  -- 85-89 rated players: 34-40M
    WHEN rating >= 80 THEN rating * 300000  -- 80-84 rated players: 24-30M
    WHEN rating >= 75 THEN rating * 200000  -- 75-79 rated players: 15-20M
    ELSE rating * 100000                    -- Others: 5-10M
  END;

-- Add comment explaining the value adjustments
COMMENT ON TABLE available_players IS 'Contains available players with adjusted values to match 100M team budget';

-- Update the handle_transfer function to maintain the original position
CREATE OR REPLACE FUNCTION handle_transfer(
  p_player_id uuid,
  p_to_team_id uuid,
  p_amount integer
) RETURNS void AS $$
DECLARE
  v_player record;
  v_buyer_budget integer;
  v_new_player_id uuid;
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Verify team ownership
  PERFORM 1 FROM teams
  WHERE id = p_to_team_id
  AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to make transfers for this team';
  END IF;

  -- Get player from available_players
  SELECT * INTO v_player
  FROM available_players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found or no longer available';
  END IF;

  -- Get and lock buyer's team row
  SELECT budget INTO v_buyer_budget
  FROM teams
  WHERE id = p_to_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- Validate transfer
  IF v_buyer_budget < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Create new player in team's squad with original position
  INSERT INTO players (
    name,
    position,
    position_id,
    rating,
    age,
    value,
    team_id,
    nationality
  ) VALUES (
    v_player.name,
    v_player.position,  -- Keep original position
    NULL,              -- Position ID will be set when assigning to formation
    v_player.rating,
    v_player.age,
    v_player.value,
    p_to_team_id,
    v_player.nationality
  ) RETURNING id INTO v_new_player_id;

  -- Update team budget
  UPDATE teams
  SET budget = budget - p_amount
  WHERE id = p_to_team_id;

  -- Record transfer in history
  INSERT INTO transfer_history (
    player_id,
    to_team_id,
    amount,
    source_table
  ) VALUES (
    v_new_player_id,
    p_to_team_id,
    p_amount,
    'players'
  );

  -- Remove from available players
  DELETE FROM available_players
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;