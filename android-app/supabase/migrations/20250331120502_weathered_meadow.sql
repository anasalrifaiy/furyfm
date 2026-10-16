-- Drop existing functions that we'll update
DROP FUNCTION IF EXISTS calculate_team_strength;
DROP FUNCTION IF EXISTS generate_match_event;
DROP FUNCTION IF EXISTS simulate_match;
DROP FUNCTION IF EXISTS start_match;

-- [Previous calculate_team_strength and generate_match_event functions remain the same...]

-- Updated simulate_match function without sleep delays
CREATE OR REPLACE FUNCTION simulate_match(
  p_match_id uuid
) RETURNS void AS $$
DECLARE
  v_match record;
  v_home_attack numeric;
  v_home_midfield numeric;
  v_home_defense numeric;
  v_away_attack numeric;
  v_away_midfield numeric;
  v_away_defense numeric;
  v_minute integer;
  v_event record;
  v_home_score integer := 0;
  v_away_score integer := 0;
  v_event_chance numeric := 0.2; -- 20% chance of event per minute
BEGIN
  -- Get match details
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  -- Calculate team strengths
  SELECT * INTO v_home_attack, v_home_midfield, v_home_defense
  FROM calculate_team_strength(v_match.home_team_id);
  
  SELECT * INTO v_away_attack, v_away_midfield, v_away_defense
  FROM calculate_team_strength(v_match.away_team_id);

  -- Simulate match events
  FOR v_minute IN 1..90 LOOP
    -- Generate event based on probability
    IF random() < v_event_chance THEN
      FOR v_event IN
        SELECT * FROM generate_match_event(
          p_match_id,
          v_minute,
          v_match.home_team_id,
          v_match.away_team_id,
          v_home_attack,
          v_home_midfield,
          v_home_defense,
          v_away_attack,
          v_away_midfield,
          v_away_defense
        )
      LOOP
        -- Record event
        INSERT INTO match_events (
          match_id,
          event_type,
          minute,
          player_id,
          team_id,
          description
        ) VALUES (
          p_match_id,
          v_event.event_type,
          v_minute,
          v_event.player_id,
          v_event.team_id,
          v_event.description
        );

        -- Update score
        IF v_event.event_type = 'goal' THEN
          IF v_event.team_id = v_match.home_team_id THEN
            v_home_score := v_home_score + 1;
          ELSE
            v_away_score := v_away_score + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Update match result
  UPDATE matches
  SET
    home_score = v_home_score,
    away_score = v_away_score
  WHERE id = p_match_id;

  -- Update match room status
  UPDATE match_rooms
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = (
    SELECT mr.id 
    FROM match_rooms mr
    WHERE mr.host_team_id = v_match.home_team_id
    AND mr.guest_team_id = v_match.away_team_id
    AND mr.status = 'in_progress'
  );
END;
$$ LANGUAGE plpgsql;

-- Update start_match function to handle simulation
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

  -- Simulate match immediately
  PERFORM simulate_match(v_match_id);

  RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;