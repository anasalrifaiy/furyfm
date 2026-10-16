/*
  # Add Match Simulation System

  1. Changes
    - Add match simulation functions
    - Add player performance calculations
    - Add event generation system
    - Add real-time match updates

  2. Details
    - Calculate match events based on player ratings and positions
    - Generate realistic match commentary
    - Track player statistics
*/

-- Function to calculate team strength based on formation and player positions
CREATE OR REPLACE FUNCTION calculate_team_strength(
  p_team_id uuid,
  OUT attack numeric,
  OUT midfield numeric,
  OUT defense numeric
) AS $$
DECLARE
  v_formation text;
  v_players record;
BEGIN
  -- Get team formation
  SELECT formation INTO v_formation
  FROM teams
  WHERE id = p_team_id;

  -- Initialize values
  attack := 0;
  midfield := 0;
  defense := 0;

  -- Calculate strengths based on positioned players
  FOR v_players IN (
    SELECT position, rating
    FROM players
    WHERE team_id = p_team_id
    AND position_id IS NOT NULL
  ) LOOP
    CASE
      WHEN v_players.position IN ('ST', 'CF', 'LW', 'RW') THEN
        attack := attack + v_players.rating;
      WHEN v_players.position IN ('CAM', 'CM', 'CDM', 'LM', 'RM') THEN
        midfield := midfield + v_players.rating;
      WHEN v_players.position IN ('CB', 'LB', 'RB', 'GK') THEN
        defense := defense + v_players.rating;
    END CASE;
  END LOOP;

  -- Normalize values
  attack := attack / CASE
    WHEN v_formation = '4-3-3' THEN 3
    WHEN v_formation = '4-4-2' THEN 2
    WHEN v_formation = '4-2-3-1' THEN 1
    ELSE 2
  END;

  midfield := midfield / CASE
    WHEN v_formation = '4-3-3' THEN 3
    WHEN v_formation = '4-4-2' THEN 4
    WHEN v_formation = '4-2-3-1' THEN 6
    ELSE 4
  END;

  defense := defense / 5; -- Always 4 defenders + 1 goalkeeper
END;
$$ LANGUAGE plpgsql;

-- Function to generate match events
CREATE OR REPLACE FUNCTION generate_match_event(
  p_match_id uuid,
  p_minute integer,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_home_attack numeric,
  p_home_midfield numeric,
  p_home_defense numeric,
  p_away_attack numeric,
  p_away_midfield numeric,
  p_away_defense numeric
) RETURNS TABLE (
  event_type text,
  team_id uuid,
  player_id uuid,
  description text
) AS $$
DECLARE
  v_random float;
  v_attacking_team_id uuid;
  v_defending_team_id uuid;
  v_attack_strength numeric;
  v_defense_strength numeric;
  v_selected_player record;
BEGIN
  -- Determine which team is attacking
  v_random := random();
  IF v_random < (p_home_midfield / (p_home_midfield + p_away_midfield)) THEN
    v_attacking_team_id := p_home_team_id;
    v_defending_team_id := p_away_team_id;
    v_attack_strength := p_home_attack;
    v_defense_strength := p_away_defense;
  ELSE
    v_attacking_team_id := p_away_team_id;
    v_defending_team_id := p_home_team_id;
    v_attack_strength := p_away_attack;
    v_defense_strength := p_home_defense;
  END IF;

  -- Calculate shot probability
  v_random := random();
  IF v_random < (v_attack_strength / (v_attack_strength + v_defense_strength)) THEN
    -- Select attacking player
    SELECT id, name, position
    INTO v_selected_player
    FROM players
    WHERE team_id = v_attacking_team_id
    AND position IN ('ST', 'CF', 'LW', 'RW', 'CAM')
    ORDER BY random()
    LIMIT 1;

    -- Calculate goal probability
    v_random := random();
    IF v_random < 0.3 THEN -- 30% chance of goal
      RETURN QUERY SELECT
        'goal'::text,
        v_attacking_team_id,
        v_selected_player.id,
        v_selected_player.name || ' scores a goal!'::text;
    ELSE
      -- Select defending goalkeeper
      SELECT id, name
      INTO v_selected_player
      FROM players
      WHERE team_id = v_defending_team_id
      AND position = 'GK'
      LIMIT 1;

      RETURN QUERY SELECT
        'save'::text,
        v_defending_team_id,
        v_selected_player.id,
        'Great save by ' || v_selected_player.name || '!'::text;
    END IF;
  ELSE
    -- Select midfielder for possession
    SELECT id, name, position
    INTO v_selected_player
    FROM players
    WHERE team_id = v_attacking_team_id
    AND position IN ('CM', 'CDM', 'CAM', 'LM', 'RM')
    ORDER BY random()
    LIMIT 1;

    RETURN QUERY SELECT
      'possession'::text,
      v_attacking_team_id,
      v_selected_player.id,
      v_selected_player.name || ' controls the midfield'::text;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to simulate match
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
    -- Generate event every ~5 minutes
    IF random() < 0.2 THEN
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

    -- Simulate time passing
    PERFORM pg_sleep(0.1); -- 0.1 second per minute
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
    SELECT id FROM match_rooms
    WHERE host_team_id = v_match.home_team_id
    AND guest_team_id = v_match.away_team_id
    AND status = 'in_progress'
  );
END;
$$ LANGUAGE plpgsql;

-- Update start_match function to trigger simulation
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

  -- Start match simulation in background
  PERFORM simulate_match(v_match_id);

  RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;