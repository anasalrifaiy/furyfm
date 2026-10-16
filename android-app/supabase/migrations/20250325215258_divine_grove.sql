/*
  # Add Team Customization Features

  1. Changes
    - Add nickname column to teams table
    - Add storage for team logos and profile pictures
    - Update team update function
*/

-- Add nickname column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS nickname text;

-- Create a function to update team details
CREATE OR REPLACE FUNCTION update_team_details(
  p_team_id uuid,
  p_name text DEFAULT NULL,
  p_nickname text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_profile_picture_url text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Verify team ownership
  IF NOT EXISTS (
    SELECT 1 FROM teams 
    WHERE id = p_team_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this team';
  END IF;

  -- Update team details
  UPDATE teams 
  SET
    name = COALESCE(p_name, name),
    nickname = COALESCE(p_nickname, nickname),
    logo_url = COALESCE(p_logo_url, logo_url),
    profile_picture_url = COALESCE(p_profile_picture_url, profile_picture_url)
  WHERE id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;