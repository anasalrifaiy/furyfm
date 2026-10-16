/*
  # Update Player Display System

  1. Changes
    - Remove image-related functionality
    - Reset all squads
    - Update transfer functions
*/

-- First, clear all existing players
DELETE FROM players;

-- Reset team budgets
UPDATE teams SET budget = 100000000;

-- Drop image-related columns and functions
DO $$ 
BEGIN
  -- Drop column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'available_players' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE available_players DROP COLUMN image_url;
  END IF;

  -- Drop table if it exists
  DROP TABLE IF EXISTS player_images;

  -- Drop functions if they exist
  DROP FUNCTION IF EXISTS get_player_image CASCADE;
  DROP FUNCTION IF EXISTS get_random_player_image CASCADE;
  DROP FUNCTION IF EXISTS assign_player_image CASCADE;
END $$;

-- Update handle_transfer function
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

  -- Create new player in team's squad
  INSERT INTO players (
    name,
    position,
    original_position,
    position_id,
    rating,
    age,
    value,
    team_id,
    nationality
  ) VALUES (
    v_player.name,
    v_player.position,
    v_player.position,
    NULL,
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

-- Add comment explaining the changes
COMMENT ON TABLE players IS 'Players table with position-based display system';