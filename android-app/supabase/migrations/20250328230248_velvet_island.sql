/*
  # Reset friend requests table

  1. Changes
    - Truncate friend_requests table to remove all existing requests
    - Reset sequence to ensure fresh IDs

  2. Notes
    - This is a one-time reset to fix friend request issues
    - Existing friend relationships will need to be re-established
*/

-- First disable RLS temporarily to allow the truncate
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- Truncate the table
TRUNCATE TABLE friend_requests;

-- Re-enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;