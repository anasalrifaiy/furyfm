/*
  # Fix Transfer History Constraints

  1. Changes
    - Modify transfer_history table to handle player deletion
    - Update sell_player function to handle transfer history properly
    - Add cascade delete for player transfers

  2. Details
    - Remove existing foreign key constraint
    - Add new constraint with ON DELETE SET NULL
    - Update sell_player function to create transfer history record before deleting player
*/

-- First ensure the transfer_history table exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'transfer_history') THEN
    CREATE TABLE transfer_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id uuid,
      from_team_id uuid REFERENCES teams,
      to_team_id uuid REFERENCES teams,
      amount integer NOT NULL,
      completed_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE transfer_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'transfer_history_player_id_fkey'
  ) THEN
    ALTER TABLE transfer_history DROP CONSTRAINT transfer_history_player_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint with ON DELETE SET NULL
ALTER TABLE transfer_history
  ADD CONSTRAINT transfer_history_player_id_fkey 
  FOREIGN KEY (player_id) 
  REFERENCES players(id) 
  ON DELETE SET NULL;

-- Update the sell_player function to handle transfer history properly
CREATE OR REPLACE FUNCTION sell_player(p_player_id uuid)
RETURNS integer AS $$
DECLARE
  v_player record;
  v_team record;
  v_sale_amount integer;
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

  SELECT * INTO v_team
  FROM teams
  WHERE id = v_player.team_id
  FOR UPDATE;

  -- Calculate sale amount (80% of player value)
  v_sale_amount := (v_player.value * 0.8)::integer;

  -- Create transfer history record
  INSERT INTO transfer_history (
    player_id,
    from_team_id,
    amount
  ) VALUES (
    v_player.id,
    v_player.team_id,
    v_sale_amount
  );

  -- Update team budget
  UPDATE teams
  SET budget = budget + v_sale_amount
  WHERE id = v_player.team_id;

  -- Delete the player
  DELETE FROM players
  WHERE id = p_player_id;

  RETURN v_sale_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;