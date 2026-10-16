/*
  # Fix Friend Request System

  1. Changes
    - Add better error handling for friend requests
    - Add validation for duplicate requests
    - Add proper status updates
*/

-- Drop existing function
DROP FUNCTION IF EXISTS send_friend_request;

-- Create improved send_friend_request function
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
) RETURNS void AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_exists boolean;
  v_existing_request record;
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

  -- Check for existing requests in either direction
  SELECT * INTO v_existing_request
  FROM friend_requests
  WHERE (sender_id = v_sender_id AND receiver_id = p_receiver_id)
     OR (sender_id = p_receiver_id AND receiver_id = v_sender_id);

  IF FOUND THEN
    -- Handle different cases based on existing request status
    CASE v_existing_request.status
      WHEN 'pending' THEN
        RAISE EXCEPTION 'A friend request is already pending';
      WHEN 'accepted' THEN
        RAISE EXCEPTION 'You are already friends with this team';
      WHEN 'rejected' THEN
        -- If the old request was rejected, allow a new one
        DELETE FROM friend_requests WHERE id = v_existing_request.id;
    END CASE;
  END IF;

  -- Insert new friend request
  INSERT INTO friend_requests (
    sender_id,
    receiver_id,
    status,
    created_at
  ) VALUES (
    v_sender_id,
    p_receiver_id,
    'pending',
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing handle_friend_request function
DROP FUNCTION IF EXISTS handle_friend_request;

-- Create improved handle_friend_request function
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
  SET 
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    updated_at = now()
  WHERE id = p_request_id;

  -- If rejected, allow new requests in the future
  IF NOT p_accept THEN
    -- Wait 5 seconds before allowing new requests
    PERFORM pg_sleep(5);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- Add comments
COMMENT ON FUNCTION send_friend_request IS 'Sends a friend request to another team with proper validation';
COMMENT ON FUNCTION handle_friend_request IS 'Handles accepting or rejecting a friend request';