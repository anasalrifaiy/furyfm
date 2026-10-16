-- Create new migration file: supabase/migrations/20250404191515_remove_computer_team.sql

-- Delete the computer team and its related data
DELETE FROM matches WHERE home_team_id = '00000000-0000-0000-0000-000000000000' OR away_team_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM match_rooms WHERE host_team_id = '00000000-0000-0000-0000-000000000000' OR guest_team_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM teams WHERE id = '00000000-0000-0000-0000-000000000000';

-- Update create_match_room function to handle only player vs player matches
CREATE OR REPLACE FUNCTION create_match_room(
  p_guest_team_id uuid
) RETURNS uuid AS $$
DECLARE
  v_host_team_id uuid;
  v_room_id uuid;
  v_guest_user_id uuid;
  v_are_friends boolean;
BEGIN
  -- Get host team ID
  SELECT id INTO v_host_team_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;

  -- Verify guest team exists and has a user
  SELECT user_id INTO v_guest_user_id
  FROM teams
  WHERE id = p_guest_team_id;

  IF NOT FOUND OR v_guest_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid guest team';
  END IF;

  -- Check if teams are friends
  SELECT EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'accepted'
    AND ((sender_id = v_host_team_id AND receiver_id = p_guest_team_id)
    OR (sender_id = p_guest_team_id AND receiver_id = v_host_team_id))
  ) INTO v_are_friends;

  IF NOT v_are_friends THEN
    RAISE EXCEPTION 'You must be friends with a team to play against them';
  END IF;

  -- Check if there's already an active room
  IF EXISTS (
    SELECT 1 FROM match_rooms
    WHERE (host_team_id = v_host_team_id OR guest_team_id = v_host_team_id)
    AND status IN ('pending', 'ready', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'You already have an active match room';
  END IF;

  -- Create match room
  INSERT INTO match_rooms (
    host_team_id,
    guest_team_id,
    status,
    host_ready,
    guest_ready
  ) VALUES (
    v_host_team_id,
    p_guest_team_id,
    'pending',
    false,
    false
  ) RETURNING id INTO v_room_id;

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the changes
COMMENT ON FUNCTION create_match_room IS 'Creates a match room for player vs player matches between friends';
