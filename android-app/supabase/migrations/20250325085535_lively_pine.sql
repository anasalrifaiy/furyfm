/*
  # Fix Transfer History Table Structure

  1. Changes
    - Drop existing foreign key constraints
    - Modify transfer_history table to properly handle both players and available_players
    - Update sell_player function to work with the new structure
*/

-- First, drop the existing foreign key constraint
ALTER TABLE transfer_history DROP CONSTRAINT IF EXISTS transfer_history_player_id_fkey;

-- Add source_table column to track where the player ID comes from
ALTER TABLE transfer_history ADD COLUMN IF NOT EXISTS source_table text;

-- Update the sell_player function to work with the new structure
CREATE OR REPLACE FUNCTION sell_player(p_player_id uuid)
RETURNS integer AS $$
DECLARE
  v_player record;
  v_team_id uuid;
  v_sale_amount integer;
  v_new_player_id uuid;
BEGIN
  -- Get player and team information
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  AND team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found or does not belong to your team';
  END IF;

  -- Store team_id for later use
  v_team_id := v_player.team_id;

  -- Calculate sale amount (80% of player value)
  v_sale_amount := (v_player.value * 0.8)::integer;

  -- First, insert into available_players and get the new ID
  INSERT INTO available_players (
    name,
    position,
    rating,
    age,
    value,
    nationality
  ) VALUES (
    v_player.name,
    v_player.position,
    v_player.rating,
    v_player.age,
    v_sale_amount,
    COALESCE(v_player.nationality, 'Unknown')
  ) RETURNING id INTO v_new_player_id;

  -- Create transfer history record
  INSERT INTO transfer_history (
    player_id,
    from_team_id,
    amount,
    completed_at,
    source_table
  ) VALUES (
    v_new_player_id,
    v_team_id,
    v_sale_amount,
    now(),
    'available_players'
  );

  -- Update team budget
  UPDATE teams
  SET budget = budget + v_sale_amount
  WHERE id = v_team_id;

  -- Finally, delete the player from the team
  DELETE FROM players
  WHERE id = p_player_id;

  RETURN v_sale_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION sell_player IS 'Handles selling a player from a team back to the available players pool';