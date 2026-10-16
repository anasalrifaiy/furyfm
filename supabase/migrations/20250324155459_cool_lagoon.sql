/*
  # Fix transfer function and RLS policies

  1. Changes
    - Simplify transfer function to handle only available players
    - Update RLS policies to properly handle transfers
    - Add proper error handling
*/

-- Drop existing function
DROP FUNCTION IF EXISTS handle_transfer;

-- Create simplified transfer function
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
  FOR UPDATE;  -- Lock the row

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

  -- Start making changes

  -- 1. Create new player in team's squad
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

  -- 2. Update team budget
  UPDATE teams
  SET budget = budget - p_amount
  WHERE id = p_to_team_id;

  -- 3. Record transfer in history
  INSERT INTO transfer_history (
    player_id,
    to_team_id,
    amount
  ) VALUES (
    v_new_player_id,
    p_to_team_id,
    p_amount
  );

  -- 4. Remove from available players
  DELETE FROM available_players
  WHERE id = p_player_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for transfer_history
DROP POLICY IF EXISTS "Users can read all transfer history" ON transfer_history;
DROP POLICY IF EXISTS "Users can record transfers for their team" ON transfer_history;

-- Simplified RLS policies
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

-- Add comment explaining the function
COMMENT ON FUNCTION handle_transfer IS 'Handles the transfer of a player from the available players pool to a team''s squad';