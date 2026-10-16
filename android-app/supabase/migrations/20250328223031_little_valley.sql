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

  -- Notify the receiver (placeholder for future notification system)
  -- You can add notification logic here when implementing a notification system
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;