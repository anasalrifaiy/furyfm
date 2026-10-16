/*
  # Fix Position ID Column

  1. Changes
    - Add position_id column to players table
    - Update existing functions to handle position_id
    - Add indexes for better performance
*/

-- Add position_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'position_id'
  ) THEN
    ALTER TABLE players ADD COLUMN position_id text;
  END IF;
END $$;

-- Add index for position_id
CREATE INDEX IF NOT EXISTS idx_players_position_id ON players (position_id);

-- Update handle_transfer function to handle position_id
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
    position_id,
    rating,
    age,
    value,
    team_id,
    nationality
  ) VALUES (
    v_player.name,
    NULL,
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

-- Update the sell_player function to handle position_id
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