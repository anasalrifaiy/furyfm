/*
  # Fix Transfer History Foreign Key Constraints

  1. Changes
    - Drop existing foreign key constraint for player_id in transfer_history
    - Recreate the constraint with ON DELETE SET NULL
    - This allows players to be deleted while preserving transfer history
*/

-- Drop existing foreign key constraint
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

-- Recreate the constraint with ON DELETE SET NULL
ALTER TABLE transfer_history
  ADD CONSTRAINT transfer_history_player_id_fkey 
  FOREIGN KEY (player_id) 
  REFERENCES players(id) 
  ON DELETE SET NULL;