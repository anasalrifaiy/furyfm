-- Drop existing functions that we'll update
DROP FUNCTION IF EXISTS calculate_team_strength;
DROP FUNCTION IF EXISTS calculate_team_strenght;
DROP FUNCTION IF EXISTS generate_match_event;
DROP FUNCTION IF EXISTS simulate_match;
DROP FUNCTION IF EXISTS start_match;

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
    SELECT p.position, p.rating
    FROM players p
    WHERE p.team_id = p_team_id
    AND p.position_id IS NOT NULL
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
  attack := COALESCE(attack / CASE
    WHEN v_formation = '4-3-3' THEN 3
    WHEN v_formation = '4-4-2' THEN 2
    WHEN v_formation = '4-2-3-1' THEN 1
    ELSE 2
  END, 75);

  midfield := COALESCE(midfield / CASE
    WHEN v_formation = '4-3-3' THEN 3
    WHEN v_formation = '4-4-2' THEN 4
    WHEN v_formation = '4-2-3-1' THEN 6
    ELSE 4
  END, 75);

  defense := COALESCE(defense / 5, 75); -- Always 4 defenders + 1 goalkeeper

  -- For computer team, use fixed values
  IF p_team_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    attack := 75;
    midfield := 75;
    defense := 75;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- [Rest of the functions remain the same as in the previous migration]