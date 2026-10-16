/*
  # Fix Transfer System

  1. Changes
    - Fix handle_transfer function to properly handle transfers from available_players
    - Add proper validation and error handling
    - Fix money transfer between teams
*/

-- Drop existing function
DROP FUNCTION IF EXISTS handle_transfer;

-- Create improved handle_transfer function
CREATE OR REPLACE FUNCTION handle_transfer(
  p_player_id uuid,
  p_to_team_id uuid,
  p_amount integer
) RETURNS void AS $$
DECLARE
  v_available_player record;
  v_to_team record;
  v_new_player_id uuid;
BEGIN
  -- Get and lock the available player
  SELECT * INTO v_available_player
  FROM available_players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found in transfer market';
  END IF;

  -- Get and lock the buying team
  SELECT * INTO v_to_team
  FROM teams
  WHERE id = p_to_team_id
  AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found or not authorized';
  END IF;

  -- Validate the transfer
  IF v_to_team.budget < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Create new player in team's squad
  INSERT INTO players (
    name,
    position,
    original_position,
    rating,
    age,
    value,
    team_id,
    nationality,
    potential,
    growth_rate,
    matches_played,
    goals,
    assists,
    clean_sheets,
    minutes_played,
    last_rating_update,
    form_rating
  ) VALUES (
    v_available_player.name,
    v_available_player.original_position,  -- Set initial position to original position
    v_available_player.original_position,  -- Store original position
    v_available_player.rating,
    v_available_player.age,
    v_available_player.value,
    p_to_team_id,
    v_available_player.nationality,
    COALESCE(v_available_player.rating + 5, 85),  -- Set initial potential
    0.1,  -- Initial growth rate
    0,    -- No matches played yet
    0,    -- No goals yet
    0,    -- No assists yet
    0,    -- No clean sheets yet
    0,    -- No minutes played yet
    now(),
    0     -- Initial form rating
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
    completed_at,
    source_table
  ) VALUES (
    v_new_player_id,
    p_to_team_id,
    p_amount,
    now(),
    'available_players'
  );

  -- Remove from available players
  DELETE FROM available_players
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION handle_transfer IS 'Handles player transfers from the transfer market to a team';