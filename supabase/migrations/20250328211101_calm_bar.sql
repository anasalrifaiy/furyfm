/*
  # Add Match Room System

  1. New Tables
    - match_rooms
      - id (uuid, primary key)
      - host_team_id (uuid, references teams)
      - guest_team_id (uuid, references teams)
      - status (text: pending, ready, in_progress, completed)
      - host_ready (boolean)
      - guest_ready (boolean)
      - created_at (timestamp)
      - started_at (timestamp)
      - completed_at (timestamp)
    
    - match_events
      - id (uuid, primary key)
      - match_id (uuid, references matches)
      - event_type (text: goal, shot, save, foul, etc.)
      - minute (integer)
      - player_id (uuid, references players)
      - team_id (uuid, references teams)
      - description (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create match_rooms table
CREATE TABLE match_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_team_id uuid REFERENCES teams NOT NULL,
  guest_team_id uuid REFERENCES teams NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  host_ready boolean DEFAULT false,
  guest_ready boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'ready', 'in_progress', 'completed')),
  CONSTRAINT different_teams CHECK (host_team_id != guest_team_id)
);

-- Create match_events table
CREATE TABLE match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches NOT NULL,
  event_type text NOT NULL,
  minute integer NOT NULL,
  player_id uuid REFERENCES players,
  team_id uuid REFERENCES teams NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_minute CHECK (minute >= 0 AND minute <= 90)
);

-- Enable RLS
ALTER TABLE match_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for match_rooms
CREATE POLICY "Users can read all match rooms"
  ON match_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their match rooms"
  ON match_rooms FOR ALL
  TO authenticated
  USING (
    host_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    guest_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  )
  WITH CHECK (
    host_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    guest_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Create RLS policies for match_events
CREATE POLICY "Users can read all match events"
  ON match_events FOR SELECT
  TO authenticated
  USING (true);

-- Function to create a match room
CREATE OR REPLACE FUNCTION create_match_room(
  p_guest_team_id uuid
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

  -- Check if guest team exists
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_guest_team_id) THEN
    RAISE EXCEPTION 'Guest team not found';
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
    guest_team_id
  ) VALUES (
    v_host_team_id,
    p_guest_team_id
  ) RETURNING id INTO v_room_id;

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set ready status
CREATE OR REPLACE FUNCTION set_match_ready(
  p_room_id uuid,
  p_ready boolean
) RETURNS void AS $$
DECLARE
  v_room record;
  v_team_id uuid;
BEGIN
  -- Get team ID
  SELECT id INTO v_team_id
  FROM teams
  WHERE user_id = auth.uid();

  -- Get and lock the room
  SELECT * INTO v_room
  FROM match_rooms
  WHERE id = p_room_id
  AND (host_team_id = v_team_id OR guest_team_id = v_team_id)
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match room not found or already started';
  END IF;

  -- Update ready status
  IF v_team_id = v_room.host_team_id THEN
    UPDATE match_rooms
    SET host_ready = p_ready
    WHERE id = p_room_id;
  ELSE
    UPDATE match_rooms
    SET guest_ready = p_ready
    WHERE id = p_room_id;
  END IF;

  -- If both teams are ready, update status
  IF EXISTS (
    SELECT 1 FROM match_rooms
    WHERE id = p_room_id
    AND host_ready = true
    AND guest_ready = true
  ) THEN
    UPDATE match_rooms
    SET status = 'ready'
    WHERE id = p_room_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start match
CREATE OR REPLACE FUNCTION start_match(
  p_room_id uuid
) RETURNS uuid AS $$
DECLARE
  v_room record;
  v_match_id uuid;
BEGIN
  -- Get and lock the room
  SELECT * INTO v_room
  FROM match_rooms
  WHERE id = p_room_id
  AND host_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  AND status = 'ready'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match room not found or not ready';
  END IF;

  -- Create match record
  INSERT INTO matches (
    home_team_id,
    away_team_id,
    played_at
  ) VALUES (
    v_room.host_team_id,
    v_room.guest_team_id,
    now()
  ) RETURNING id INTO v_match_id;

  -- Update room status
  UPDATE match_rooms
  SET 
    status = 'in_progress',
    started_at = now()
  WHERE id = p_room_id;

  RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX idx_match_rooms_host_team ON match_rooms(host_team_id);
CREATE INDEX idx_match_rooms_guest_team ON match_rooms(guest_team_id);
CREATE INDEX idx_match_rooms_status ON match_rooms(status);
CREATE INDEX idx_match_events_match ON match_events(match_id);

-- Add comments
COMMENT ON TABLE match_rooms IS 'Stores match rooms for live matches between teams';
COMMENT ON TABLE match_events IS 'Stores match events like goals, shots, saves, etc.';