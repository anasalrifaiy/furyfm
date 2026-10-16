/*
  # FM Fury - Season Reset
  Optimized version of your working reset script
  with added safety checks
*/

BEGIN; -- Wrap in transaction

-- Safety check: Only allow reset in non-production
DO $$
BEGIN
  IF current_setting('app.env') = 'production' THEN
    RAISE EXCEPTION 'Reset blocked in production!';
  END IF;
END $$;

-- Disable RLS (slightly faster than individual toggles)
SET LOCAL row_level_security = off;

-- Clear all data (using faster TRUNCATE)
TRUNCATE TABLE 
  match_events,
  matches,
  match_rooms,
  trade_offers,
  transfer_history,
  friend_requests,
  players
RESTART IDENTITY; -- Reset auto-increment counters

-- Reset game state
UPDATE teams SET 
  budget = 100000000,
  formation = '4-4-2'; -- Optional formation reset

-- Log the reset
INSERT INTO admin_logs (action, details) VALUES (
  'season_reset',
  json_build_object(
    'reset_by', current_user,
    'reset_at', NOW() 
  )
);

COMMIT; -- End transaction

-- Re-enable RLS (automatic when session ends)