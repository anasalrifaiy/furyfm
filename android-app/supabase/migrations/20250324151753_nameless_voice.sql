/*
  # Add team customization fields

  1. Changes
    - Add profile_picture_url to teams table
    - Add unique constraint to player names in players table
*/

-- Add profile picture URL to teams table
ALTER TABLE teams
ADD COLUMN profile_picture_url text;

-- Add unique constraint to player names
ALTER TABLE players
ADD CONSTRAINT players_name_unique UNIQUE (name);

-- Add comment to explain the uniqueness requirement
COMMENT ON CONSTRAINT players_name_unique ON players IS 'Ensures each player name is unique across all teams';