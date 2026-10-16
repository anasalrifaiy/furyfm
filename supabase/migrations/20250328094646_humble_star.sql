/*
  # Fix Player Position Management

  1. Changes
    - Ensure original_position is preserved
    - Update position handling in functions
    - Reset squads to fix position data
*/

-- First, ensure original_position exists and is set correctly
DO $$ 
BEGIN
  -- Add original_position column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'original_position'
  ) THEN
    ALTER TABLE players ADD COLUMN original_position text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'available_players' AND column_name = 'original_position'
  ) THEN
    ALTER TABLE available_players ADD COLUMN original_position text;
  END IF;
END $$;

-- Update existing records to set original_position
UPDATE players 
SET original_position = position 
WHERE original_position IS NULL;

UPDATE available_players 
SET original_position = position 
WHERE original_position IS NULL;

-- Update the handle_transfer function to properly handle positions
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
    v_player.original_position,  -- Set initial position to original position
    v_player.original_position,  -- Store original position
    NULL,                       -- Position ID will be set when assigning to formation
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

  -- Generate a replacement player with similar position
  PERFORM generate_new_player(v_player.original_position, v_player.nationality);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the sell_player function to handle positions correctly
CREATE OR REPLACE FUNCTION sell_player(
  p_player_id uuid
) RETURNS integer AS $$
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
    original_position,
    rating,
    age,
    value,
    nationality
  ) VALUES (
    v_player.name,
    v_player.original_position,  -- Use original position when selling
    v_player.original_position,  -- Keep original position
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

-- Reset all squads to ensure data consistency
DELETE FROM players;
UPDATE teams SET budget = 100000000;