/*
  # Add team customization fields

  1. Changes
    - Add formation field to teams table
    - Add logo_url field to teams table
*/

-- Add new columns to teams table
ALTER TABLE teams
ADD COLUMN formation text DEFAULT '4-4-2',
ADD COLUMN logo_url text DEFAULT 'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200';

-- Add comment to explain the fields
COMMENT ON COLUMN teams.formation IS 'The team''s preferred formation (e.g., 4-4-2, 4-3-3)';
COMMENT ON COLUMN teams.logo_url IS 'URL to the team''s logo image';