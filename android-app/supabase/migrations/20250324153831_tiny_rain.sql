/*
  # Fix player transfer function

  1. Changes
    - Update handle_transfer function to properly handle transfers from available_players
    - Add proper error handling and validation
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS handle_transfer;

-- Create the updated function
CREATE OR REPLACE FUNCTION handle_transfer(
  p_player_id uuid,
  p_to_team_id uuid,
  p_amount integer
) RETURNS void AS $$
DECLARE
  v_player record;
  v_buyer_budget integer;
  v_new_player_id uuid;
BEGIN
  -- Get player from available_players
  SELECT * INTO v_player
  FROM available_players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Get buyer's budget
  SELECT budget INTO v_buyer_budget
  FROM teams
  WHERE id = p_to_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- Validate transfer
  IF v_buyer_budget < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Insert into players table
  INSERT INTO players (
    name,
    position,
    rating,
    age,
    value,
    team_id
  ) VALUES (
    v_player.name,
    v_player.position,
    v_player.rating,
    v_player.age,
    v_player.value,
    p_to_team_id
  ) RETURNING id INTO v_new_player_id;

  -- Update team budget
  UPDATE teams
  SET budget = budget - p_amount
  WHERE id = p_to_team_id;

  -- Record transfer in history
  INSERT INTO transfer_history (
    player_id,
    to_team_id,
    amount
  ) VALUES (
    v_new_player_id,
    p_to_team_id,
    p_amount
  );

  -- Remove from available players
  DELETE FROM available_players
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;