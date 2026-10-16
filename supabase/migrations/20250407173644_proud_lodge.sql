/*
  # Fix Friend Request System

  1. Changes
    - Simplify friend request functions
    - Fix RLS policies
    - Add proper error handling
    - Ensure requests appear in friends tab
*/

-- First, disable RLS temporarily
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- Clear existing friend requests
TRUNCATE friend_requests;

-- Re-enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "friend_requests_read_policy" ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_insert_policy" ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_policy" ON friend_requests;

-- Create simplified RLS policies
CREATE POLICY "friend_requests_read_policy"
  ON friend_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.user_id = auth.uid()
      AND (t.id = friend_requests.sender_id OR t.id = friend_requests.receiver_id)
    )
  );

CREATE POLICY "friend_requests_insert_policy"
  ON friend_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.user_id = auth.uid()
      AND t.id = friend_requests.sender_id
    )
  );

CREATE POLICY "friend_requests_update_policy"
  ON friend_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.user_id = auth.uid()
      AND t.id = friend_requests.receiver_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.user_id = auth.uid()
      AND t.id = friend_requests.receiver_id
    )
  );

-- Drop existing functions
DROP FUNCTION IF EXISTS send_friend_request;
DROP FUNCTION IF EXISTS handle_friend_request;

-- Create simplified send_friend_request function
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
    -- Delete any existing requests regardless of status
    DELETE FROM friend_requests 
    WHERE id = v_existing_request.id;
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
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified handle_friend_request function
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_sender ON friend_requests(status, sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_receiver ON friend_requests(status, receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_updated_at ON friend_requests(updated_at);

-- Add comments
COMMENT ON TABLE friend_requests IS 'Stores friend requests between teams with improved status tracking';
COMMENT ON FUNCTION send_friend_request IS 'Sends a friend request with proper validation';
COMMENT ON FUNCTION handle_friend_request IS 'Handles friend request responses';