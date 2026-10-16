/*
  # Update Friend Requests System

  1. Changes
    - Add safety checks for existing objects
    - Update functions for friend request management
    - Ensure RLS policies are properly set

  2. Security
    - Maintain RLS policies for friend requests
    - Update security functions with proper checks
*/

-- Only create the table if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'friend_requests') THEN
    CREATE TABLE friend_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id uuid REFERENCES teams NOT NULL,
      receiver_id uuid REFERENCES teams NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz DEFAULT now(),
      CONSTRAINT friend_requests_unique UNIQUE (sender_id, receiver_id),
      CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected'))
    );

    -- Enable RLS
    ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policy if it exists and create new one
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage their friend requests" ON friend_requests;
END $$;

CREATE POLICY "Users can manage their friend requests"
  ON friend_requests
  FOR ALL
  TO authenticated
  USING (
    sender_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    receiver_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  )
  WITH CHECK (
    sender_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Update the send friend request function
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
) RETURNS void AS $$
DECLARE
  v_sender_id uuid;
BEGIN
  -- Get sender's team ID
  SELECT id INTO v_sender_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
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
  INSERT INTO friend_requests (sender_id, receiver_id)
  VALUES (v_sender_id, p_receiver_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the handle friend request function
CREATE OR REPLACE FUNCTION handle_friend_request(
  p_request_id uuid,
  p_accept boolean
) RETURNS void AS $$
DECLARE
  v_request record;
BEGIN
  -- Get and lock the request
  SELECT * INTO v_request
  FROM friend_requests
  WHERE id = p_request_id
  AND receiver_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already handled';
  END IF;

  -- Update request status
  UPDATE friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;