/*
  # Add player selling functionality

  1. Changes
    - Add function to handle selling players
    - Calculate sell value based on player rating
    - Move player back to available_players pool
*/

-- Create function to calculate sell value
CREATE OR REPLACE FUNCTION calculate_sell_value(
  p_original_value integer,
  p_original_rating integer,
  p_current_rating integer
) RETURNS integer AS $$
BEGIN
  -- Calculate value change based on rating difference
  -- Value increases/decreases by 10% for each point of rating change
  RETURN p_original_value * (1 + (p_current_rating - p_original_rating) * 0.1);
END;
$$ LANGUAGE plpgsql;

-- Create function to handle selling players
CREATE OR REPLACE FUNCTION sell_player(
  p_player_id uuid
) RETURNS integer AS $$
DECLARE
  v_player record;
  v_user_id uuid;
  v_sell_value integer;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Get and lock the player row
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  AND team_id IN (SELECT id FROM teams WHERE user_id = v_user_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found or not owned by you';
  END IF;

  -- Calculate sell value (80% of current value as base)
  v_sell_value := (v_player.value * 0.8)::integer;

  -- Insert into available_players
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
    v_sell_value,
    'Unknown' -- Since we don't store nationality in players table
  );

  -- Update team's budget
  UPDATE teams
  SET budget = budget + v_sell_value
  WHERE id = v_player.team_id;

  -- Record in transfer history
  INSERT INTO transfer_history (
    player_id,
    from_team_id,
    amount
  ) VALUES (
    v_player.id,
    v_player.team_id,
    v_sell_value
  );

  -- Delete the player from the squad
  DELETE FROM players
  WHERE id = p_player_id;

  -- Return the amount received
  RETURN v_sell_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;