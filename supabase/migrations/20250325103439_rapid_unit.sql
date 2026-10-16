/*
  # Fix Player Position Management

  1. Changes
    - Make position column nullable in players table
    - Update position handling in functions
    - Add proper validation for position changes
*/

-- First, make the position column nullable in players table
ALTER TABLE players ALTER COLUMN position DROP NOT NULL;

-- Update the handle_transfer function to handle positions correctly
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

  -- Create new player in team's squad with null position initially
  INSERT INTO players (
    name,
    position,
    rating,
    age,
    value,
    team_id,
    nationality
  ) VALUES (
    v_player.name,
    NULL, -- Start with null position
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

-- Update the updatePlayerPosition function to handle null positions
CREATE OR REPLACE FUNCTION update_player_position(
  p_player_id uuid,
  p_position text
) RETURNS void AS $$
DECLARE
  v_team_id uuid;
BEGIN
  -- Get the player's team_id
  SELECT team_id INTO v_team_id
  FROM players
  WHERE id = p_player_id
  AND team_id IN (SELECT id FROM teams WHERE user_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found or not owned by you';
  END IF;

  -- If setting a new position, clear any existing player in that position
  IF p_position IS NOT NULL THEN
    UPDATE players
    SET position = NULL
    WHERE team_id = v_team_id
    AND position = p_position
    AND id != p_player_id;
  END IF;

  -- Update the player's position
  UPDATE players
  SET position = p_position
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;