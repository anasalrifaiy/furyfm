/*
  # Reset Friend Request System

  1. Changes
    - Delete all existing friend requests
    - Reset friend request sequence
    - Update friend request functions
*/

-- Delete all existing friend requests
TRUNCATE friend_requests;

-- Create or replace the send_friend_request function with better error handling
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
) RETURNS void AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_exists boolean;
BEGIN
  -- Get sender's team ID
  SELECT id INTO v_sender_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;

  -- Check if receiver exists
  SELECT EXISTS (
    SELECT 1 FROM teams WHERE id = p_receiver_id
  ) INTO v_receiver_exists;

  IF NOT v_receiver_exists THEN
    RAISE EXCEPTION 'Receiver team not found';
  END IF;

  -- Check if trying to send request to self
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check if request already exists
  IF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE (sender_id = v_sender_id AND receiver_id = p_receiver_id)
    OR (sender_id = p_receiver_id AND receiver_id = v_sender_id)
  ) THEN
    RAISE EXCEPTION 'Friend request already exists';
  END IF;

  -- Insert friend request
  INSERT INTO friend_requests (
    sender_id,
    receiver_id,
    status
  ) VALUES (
    v_sender_id,
    p_receiver_id,
    'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the handle_friend_request function with better error handling
CREATE OR REPLACE FUNCTION handle_friend_request(
  p_request_id uuid,
  p_accept boolean
) RETURNS void AS $$
DECLARE
  v_request record;
  v_user_id uuid;
BEGIN
  -- Get user ID
  v_user_id := auth.uid();
  
  -- Get and lock the request
  SELECT * INTO v_request
  FROM friend_requests
  WHERE id = p_request_id
  AND receiver_id IN (SELECT id FROM teams WHERE user_id = v_user_id)
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already handled';
  END IF;

  -- Update request status
  UPDATE friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      updated_at = now()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the reset
COMMENT ON TABLE friend_requests IS 'Stores friend requests between teams with status tracking';