/*
  # Add Team Profile Columns

  1. Changes
    - Add logo_url column to teams table
    - Add profile_picture_url column to teams table
    - Add formation column to teams table

  2. Notes
    - All columns are nullable to maintain compatibility with existing data
    - Uses text type for URL storage
*/

-- Add logo_url and profile_picture_url columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE teams ADD COLUMN logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE teams ADD COLUMN profile_picture_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' AND column_name = 'formation'
  ) THEN
    ALTER TABLE teams ADD COLUMN formation text DEFAULT '4-4-2';
  END IF;
END $$;