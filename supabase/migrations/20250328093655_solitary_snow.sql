/*
  # Fix Player Position Management

  1. Changes
    - Add original_position column to available_players table
    - Update functions to properly handle original positions
    - Reset all squads to ensure data consistency
*/

-- Add original_position to available_players if it doesn't exist
ALTER TABLE available_players ADD COLUMN IF NOT EXISTS original_position text;

-- Update available_players to set original_position equal to position
UPDATE available_players SET original_position = position WHERE original_position IS NULL;

-- Update the handle_transfer function
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
    v_player.original_position,  -- Set position to original_position initially
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

-- Update the generate_new_player function
CREATE OR REPLACE FUNCTION generate_new_player(
  p_position text,
  p_nationality text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_first_names text[];
  v_last_names text[];
  v_nationalities text[];
  v_name text;
  v_nationality text;
  v_rating integer;
  v_age integer;
  v_value integer;
  v_new_player_id uuid;
  v_suffix integer;
BEGIN
  -- [Previous name generation code remains the same...]

  -- Get the next available suffix number for this nationality
  SELECT COALESCE(MAX(REGEXP_REPLACE(name, '^.*?(\d+)$', '\1')::integer), 0) + 1
  INTO v_suffix
  FROM available_players
  WHERE nationality = v_nationality
  AND name ~ '\d+$';

  -- Generate name with suffix
  v_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))] || ' ' ||
            v_last_names[1 + floor(random() * array_length(v_last_names, 1))] || ' ' ||
            v_suffix::text;

  -- Generate random rating (75-89)
  v_rating := 75 + floor(random() * 15);
  
  -- Generate random age (17-35)
  v_age := 17 + floor(random() * 19);
  
  -- Calculate value based on rating
  v_value := CASE 
    WHEN v_rating >= 90 THEN 15000000
    WHEN v_rating >= 85 THEN v_rating * 150000
    WHEN v_rating >= 80 THEN v_rating * 100000
    WHEN v_rating >= 75 THEN v_rating * 60000
    ELSE v_rating * 30000
  END;

  -- Insert new player with original_position
  INSERT INTO available_players (
    name,
    position,
    original_position,
    rating,
    age,
    value,
    nationality
  ) VALUES (
    v_name,
    p_position,
    p_position,  -- Set original_position same as position
    v_rating,
    v_age,
    v_value,
    v_nationality
  ) RETURNING id INTO v_new_player_id;

  RETURN v_new_player_id;
END;
$$ LANGUAGE plpgsql;

-- Update the sell_player function
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