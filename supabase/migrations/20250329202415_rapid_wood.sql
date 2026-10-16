-- Update the generate_match_event function to ensure descriptions are never null
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
  v_team_name text;
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

  -- Get team name for computer team
  IF v_attacking_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    v_team_name := 'Computer';
  ELSE
    SELECT name INTO v_team_name
    FROM teams
    WHERE id = v_attacking_team_id;
  END IF;

  -- Calculate shot probability
  v_random := random();
  IF v_random < (v_attack_strength / (v_attack_strength + v_defense_strength)) THEN
    -- For computer team, generate generic events
    IF v_attacking_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
      IF v_random < 0.3 THEN -- 30% chance of goal
        RETURN QUERY SELECT
          'goal'::text,
          v_attacking_team_id,
          NULL::uuid,
          'The Computer team launches a powerful attack and scores!'::text;
      ELSE
        RETURN QUERY SELECT
          'save'::text,
          v_defending_team_id,
          NULL::uuid,
          'Excellent defensive play stops the Computer team''s attack'::text;
      END IF;
    ELSE
      -- Select attacking player
      SELECT p.id, p.name, p.position
      INTO v_selected_player
      FROM players p
      WHERE p.team_id = v_attacking_team_id
      AND p.position IN ('ST', 'CF', 'LW', 'RW', 'CAM')
      ORDER BY random()
      LIMIT 1;

      -- Calculate goal probability
      v_random := random();
      IF v_random < 0.3 THEN -- 30% chance of goal
        RETURN QUERY SELECT
          'goal'::text,
          v_attacking_team_id,
          v_selected_player.id,
          COALESCE(v_selected_player.name || ' makes a brilliant run and scores!', v_team_name || ' scores a fantastic goal!')::text;
      ELSE
        -- Select defending goalkeeper
        SELECT p.id, p.name
        INTO v_selected_player
        FROM players p
        WHERE p.team_id = v_defending_team_id
        AND p.position = 'GK'
        LIMIT 1;

        RETURN QUERY SELECT
          'save'::text,
          v_defending_team_id,
          v_selected_player.id,
          COALESCE('Amazing save by ' || v_selected_player.name || '!', 'The goalkeeper makes a crucial save!')::text;
      END IF;
    END IF;
  ELSE
    -- For computer team, generate generic possession event
    IF v_attacking_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
      RETURN QUERY SELECT
        'possession'::text,
        v_attacking_team_id,
        NULL::uuid,
        'The Computer team maintains possession and builds up play'::text;
    ELSE
      -- Select midfielder for possession
      SELECT p.id, p.name, p.position
      INTO v_selected_player
      FROM players p
      WHERE p.team_id = v_attacking_team_id
      AND p.position IN ('CM', 'CDM', 'CAM', 'LM', 'RM')
      ORDER BY random()
      LIMIT 1;

      RETURN QUERY SELECT
        'possession'::text,
        v_attacking_team_id,
        v_selected_player.id,
        COALESCE(v_selected_player.name || ' controls the midfield with excellent passing', v_team_name || ' dominates possession')::text;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
