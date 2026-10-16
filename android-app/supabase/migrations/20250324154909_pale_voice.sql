/*
  # Fix transfer history RLS policies

  1. Changes
    - Add RLS policy for inserting into transfer_history table
    - Update handle_transfer function to handle RLS
*/

-- Drop existing RLS policies for transfer_history
DROP POLICY IF EXISTS "Users can read all transfer history" ON transfer_history;

-- Create comprehensive RLS policies for transfer_history
CREATE POLICY "Users can read all transfer history"
  ON transfer_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can record transfers for their team"
  ON transfer_history FOR INSERT
  TO authenticated
  WITH CHECK (
    to_team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Update the transfer function to work with RLS
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
  IF NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_to_team_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to make transfers for this team';
  END IF;

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

  -- Commit the transaction
  -- Note: This is handled automatically by Supabase
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;