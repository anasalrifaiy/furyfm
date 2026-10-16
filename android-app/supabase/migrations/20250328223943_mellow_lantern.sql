-- First, clear all existing friend requests
TRUNCATE friend_requests;

-- Create a function to reset friend request status
CREATE OR REPLACE FUNCTION reset_friend_request_status(
  p_sender_id uuid,
  p_receiver_id uuid
) RETURNS void AS $$
BEGIN
  -- Delete any existing requests between these teams
  DELETE FROM friend_requests
  WHERE (sender_id = p_sender_id AND receiver_id = p_receiver_id)
     OR (sender_id = p_receiver_id AND receiver_id = p_sender_id);

  -- Create a new pending request
  INSERT INTO friend_requests (
    sender_id,
    receiver_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_sender_id,
    p_receiver_id,
    'pending',
    now(),
    now()
  );
END;
$$ LANGUAGE plpgsql;

-- Update the send_friend_request function to use the reset function
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

  -- Reset and create new request
  PERFORM reset_friend_request_status(v_sender_id, p_receiver_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- Add comment explaining the changes
COMMENT ON FUNCTION reset_friend_request_status IS 'Resets friend request status between two teams by removing existing requests and creating a new one';