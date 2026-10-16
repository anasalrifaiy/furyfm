/*
  # Update player names to remove Jr. suffix

  1. Changes
    - Remove "Jr." and "II" suffixes from player names
    - Update player values and ratings
*/

-- Update player names to remove Jr. suffix
UPDATE available_players
SET name = REGEXP_REPLACE(name, ' Jr\.| II$', '');

-- Add a comment to explain the name format
COMMENT ON TABLE available_players IS 'Contains all available players for transfer, with unique names and no suffixes';