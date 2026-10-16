/*
  # Fix duplicate players

  1. Changes
    - Remove duplicate players keeping only one instance of each name
    - Add unique constraint on player names
    - Add comment explaining uniqueness requirement
*/

-- Create a temporary table to store unique players
CREATE TEMP TABLE temp_unique_players AS
SELECT DISTINCT ON (name) *
FROM available_players
ORDER BY name, created_at ASC;

-- Delete all records from the original table
TRUNCATE available_players;

-- Reinsert the unique records
INSERT INTO available_players
SELECT *
FROM temp_unique_players;

-- Drop the temporary table
DROP TABLE temp_unique_players;

-- Add a unique constraint on the name column to prevent future duplicates
ALTER TABLE available_players
ADD CONSTRAINT available_players_name_unique UNIQUE (name);

-- Add a comment to explain the uniqueness requirement
COMMENT ON CONSTRAINT available_players_name_unique ON available_players IS 'Ensures each player name is unique in the available players pool';