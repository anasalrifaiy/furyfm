/*
  # Fix Player Transfer System

  1. Changes
    - Update handle_transfer function to properly transfer money between teams
    - Fix player ownership transfer
    - Add proper validation and error handling
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
  v_player record;
  v_from_team record;
  v_to_team record;
BEGIN
  -- Get and lock the player and teams
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Get and lock the selling team
  SELECT * INTO v_from_team
  FROM teams
  WHERE id = v_player.team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selling team not found';
  END IF;

  -- Get and lock the buying team
  SELECT * INTO v_to_team
  FROM teams
  WHERE id = p_to_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buying team not found';
  END IF;

  -- Validate the transfer
  IF v_to_team.budget < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Transfer the money
  UPDATE teams
  SET budget = budget - p_amount
  WHERE id = p_to_team_id;

  UPDATE teams
  SET budget = budget + p_amount
  WHERE id = v_player.team_id;

  -- Transfer the player
  UPDATE players
  SET 
    team_id = p_to_team_id,
    position_id = NULL -- Reset position in new team
  WHERE id = p_player_id;

  -- Record the transfer
  INSERT INTO transfer_history (
    player_id,
    from_team_id,
    to_team_id,
    amount,
    completed_at,
    source_table
  ) VALUES (
    p_player_id,
    v_player.team_id,
    p_to_team_id,
    p_amount,
    now(),
    'transfers'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION handle_transfer IS 'Handles player transfers between teams including money transfer';