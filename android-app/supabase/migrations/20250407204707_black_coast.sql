/*
  # Reset All Game Data

  1. Changes
    - Delete all existing players from teams
    - Reset all team budgets to 100M
    - Clear all friend requests
    - Clear all trade offers
    - Clear all transfer history
    - Clear all matches and match events
    - Clear all match rooms
*/

-- First, disable RLS temporarily for all tables
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE match_rooms DISABLE ROW LEVEL SECURITY;

-- Clear all game data
DELETE FROM match_events;
DELETE FROM matches;
DELETE FROM match_rooms;
DELETE FROM trade_offers;
DELETE FROM transfer_history;
DELETE FROM friend_requests;
DELETE FROM players;

-- Reset all team budgets to 100M
UPDATE teams SET budget = 100000000;

-- Re-enable RLS for all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rooms ENABLE ROW LEVEL SECURITY;

-- Add comment explaining the reset
COMMENT ON TABLE teams IS 'Teams start with 100M budget and 4-4-2 formation by default';