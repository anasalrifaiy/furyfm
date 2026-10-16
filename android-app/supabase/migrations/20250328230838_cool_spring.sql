/*
  # Reset friend requests and update function

  1. Changes
    - Truncate friend_requests table
    - Recreate send_friend_request function with improved error handling
  
  2. Security
    - Temporarily disable RLS for truncate
    - Re-enable RLS after truncate
*/

-- First disable RLS temporarily to allow the truncate
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- Truncate the table
TRUNCATE TABLE friend_requests;

-- Re-enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS send_friend_request;

-- Recreate the function with improved logic
CREATE OR REPLACE FUNCTION send_friend_request(p_receiver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
  v_existing_request UUID;
BEGIN
  -- Get the sender's team ID
  SELECT id INTO v_sender_id
  FROM teams
  WHERE user_id = auth.uid();

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Sender team not found';
  END IF;

  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check for existing requests in either direction
  SELECT id INTO v_existing_request
  FROM friend_requests
  WHERE (sender_id = v_sender_id AND receiver_id = p_receiver_id)
     OR (sender_id = p_receiver_id AND receiver_id = v_sender_id);

  IF v_existing_request IS NOT NULL THEN
    RAISE EXCEPTION 'A friend request already exists between these teams';
  END IF;

  -- Insert the new request
  INSERT INTO friend_requests (sender_id, receiver_id, status)
  VALUES (v_sender_id, p_receiver_id, 'pending');

END;
$$;