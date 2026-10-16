/*
  # Reset Match History

  1. Changes
    - Clear all match-related data
    - Reset match rooms
    - Keep team and player data intact
*/

-- First disable RLS temporarily to allow truncation
ALTER TABLE match_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_rooms DISABLE ROW LEVEL SECURITY;

-- Truncate match-related tables in the correct order
TRUNCATE TABLE match_events CASCADE;
TRUNCATE TABLE matches CASCADE;
TRUNCATE TABLE match_rooms CASCADE;

-- Re-enable RLS
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rooms ENABLE ROW LEVEL SECURITY;

-- Add comment explaining the reset
COMMENT ON TABLE matches IS 'Stores match results between teams';
COMMENT ON TABLE match_events IS 'Stores match events like goals, shots, saves, etc.';
COMMENT ON TABLE match_rooms IS 'Stores match rooms for live matches between teams';
