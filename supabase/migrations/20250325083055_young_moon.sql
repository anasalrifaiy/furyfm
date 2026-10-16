/*
  # Fix Transfer History Null Constraint

  1. Changes
    - Update sell_player function to handle transfer history correctly
    - Ensure player_id is properly set in transfer history
    - Fix order of operations to prevent null constraint violation
*/

-- Drop existing function
DROP FUNCTION IF EXISTS sell_player;

-- Create updated sell_player function
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

  -- Create transfer history record with the new player ID
  INSERT INTO transfer_history (
    player_id,
    from_team_id,
    amount,
    completed_at
  ) VALUES (
    v_new_player_id,
    v_team_id,
    v_sale_amount,
    now()
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