/*
  # Fix Friend Request Notifications

  1. Changes
    - Add updated_at trigger for friend_requests
    - Update friend request functions to better handle notifications
    - Add indexes for better performance
*/

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to friend_requests table
DROP TRIGGER IF EXISTS set_friend_requests_updated_at ON friend_requests;
CREATE TRIGGER set_friend_requests_updated_at
  BEFORE UPDATE ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Drop existing functions
DROP FUNCTION IF EXISTS send_friend_request;
DROP FUNCTION IF EXISTS handle_friend_request;

-- Create improved send_friend_request function
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
) RETURNS uuid AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_exists boolean;
  v_existing_request record;
  v_request_id uuid;
BEGIN
  -- Get sender's team ID
  SELECT id INTO v_sender_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;

  -- Check if receiver exists and is not the computer team
  SELECT EXISTS (
    SELECT 1 FROM teams 
    WHERE id = p_receiver_id 
    AND user_id IS NOT NULL
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
    CASE v_existing_request.status
      WHEN 'pending' THEN
        RAISE EXCEPTION 'A friend request is already pending';
      WHEN 'accepted' THEN
        RAISE EXCEPTION 'You are already friends with this team';
      WHEN 'rejected' THEN
        -- If rejected, delete old request
        DELETE FROM friend_requests WHERE id = v_existing_request.id;
    END CASE;
  END IF;

  -- Insert new friend request
  INSERT INTO friend_requests (
    sender_id,
    receiver_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_sender_id,
    p_receiver_id,
    'pending',
    now(),
    now()
  ) RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved handle_friend_request function
CREATE OR REPLACE FUNCTION handle_friend_request(
  p_request_id uuid,
  p_accept boolean
) RETURNS void AS $$
DECLARE
  v_request record;
  v_team_id uuid;
BEGIN
  -- Get user's team ID
  SELECT id INTO v_team_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;
  
  -- Get and lock the request
  SELECT * INTO v_request
  FROM friend_requests
  WHERE id = p_request_id
  AND receiver_id = v_team_id
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

  -- Notify the sender about the response
  PERFORM pg_notify(
    'friend_request_update',
    json_build_object(
      'request_id', p_request_id,
      'status', CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      'sender_id', v_request.sender_id,
      'receiver_id', v_request.receiver_id
    )::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_updated_at ON friend_requests(updated_at);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_sender ON friend_requests(status, sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_receiver ON friend_requests(status, receiver_id);

-- Add comments
COMMENT ON FUNCTION send_friend_request IS 'Sends a friend request and returns the request ID for real-time updates';
COMMENT ON FUNCTION handle_friend_request IS 'Handles friend request response with real-time notifications';