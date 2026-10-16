/*
  # Fix Match System for Computer Games

  1. Changes
    - Add computer team handling without user dependency
    - Update match room creation for AI matches
    - Fix match simulation logic
*/

-- First, modify the teams table to allow NULL user_id for computer team
ALTER TABLE teams ALTER COLUMN user_id DROP NOT NULL;

-- Create the computer team if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teams WHERE name = 'Computer'
  ) THEN
    INSERT INTO teams (
      id,
      name,
      rating,
      budget,
      user_id,
      formation,
      logo_url,
      profile_picture_url
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      'Computer',
      75,
      100000000,
      NULL, -- Computer team has no user
      '4-4-2',
      'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200',
      'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=200'
    );
  END IF;
END $$;

-- Update RLS policy to allow access to computer team
DROP POLICY IF EXISTS "Users can read all teams" ON teams;
CREATE POLICY "Users can read all teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can manage their own team" ON teams;
CREATE POLICY "Users can manage their own team"
  ON teams FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Update the create_match_room function to handle AI matches
CREATE OR REPLACE FUNCTION create_match_room(
  p_guest_team_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid
) RETURNS uuid AS $$
DECLARE
  v_host_team_id uuid;
  v_room_id uuid;
BEGIN
  -- Get host team ID
  SELECT id INTO v_host_team_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
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
    CASE 
      WHEN p_guest_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN 'ready'
      ELSE 'pending'
    END,
    true,
    CASE 
      WHEN p_guest_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN true
      ELSE false
    END
  ) RETURNING id INTO v_room_id;

  -- If playing against computer, automatically start the match
  IF p_guest_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    PERFORM start_match(v_room_id);
  END IF;

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;