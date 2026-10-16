/*
  # Add Automatic Player Assignment

  1. Changes
    - Add function to find best player for a position
    - Update formation change logic to auto-assign players
    - Add position compatibility mapping
*/

-- Create a function to check position compatibility
CREATE OR REPLACE FUNCTION is_position_compatible(
  p_player_position text,
  p_target_position text
) RETURNS boolean AS $$
BEGIN
  RETURN CASE
    -- Goalkeepers
    WHEN p_target_position = 'GK' THEN 
      p_player_position = 'GK'
    
    -- Defenders
    WHEN p_target_position = 'CB' THEN 
      p_player_position IN ('CB')
    WHEN p_target_position = 'LB' THEN 
      p_player_position IN ('LB', 'LWB')
    WHEN p_target_position = 'RB' THEN 
      p_player_position IN ('RB', 'RWB')
    WHEN p_target_position = 'LWB' THEN 
      p_player_position IN ('LB', 'LWB', 'LM')
    WHEN p_target_position = 'RWB' THEN 
      p_player_position IN ('RB', 'RWB', 'RM')
    
    -- Midfielders
    WHEN p_target_position = 'CDM' THEN 
      p_player_position IN ('CDM', 'CM')
    WHEN p_target_position = 'CM' THEN 
      p_player_position IN ('CM', 'CDM', 'CAM')
    WHEN p_target_position = 'CAM' THEN 
      p_player_position IN ('CAM', 'CM')
    WHEN p_target_position = 'LM' THEN 
      p_player_position IN ('LM', 'LW', 'LWB')
    WHEN p_target_position = 'RM' THEN 
      p_player_position IN ('RM', 'RW', 'RWB')
    
    -- Forwards
    WHEN p_target_position = 'LW' THEN 
      p_player_position IN ('LW', 'LM')
    WHEN p_target_position = 'RW' THEN 
      p_player_position IN ('RW', 'RM')
    WHEN p_target_position = 'ST' THEN 
      p_player_position IN ('ST', 'CF')
    WHEN p_target_position = 'CF' THEN 
      p_player_position IN ('CF', 'ST')
    
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to find the best player for a position
CREATE OR REPLACE FUNCTION find_best_player_for_position(
  p_team_id uuid,
  p_position text,
  p_exclude_position_id text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_player_id uuid;
BEGIN
  -- First try to find a player with matching position
  SELECT id INTO v_player_id
  FROM players
  WHERE team_id = p_team_id
    AND position = p_position
    AND (position_id IS NULL OR position_id != p_exclude_position_id)
  ORDER BY rating DESC
  LIMIT 1;

  -- If no exact match, try compatible positions
  IF v_player_id IS NULL THEN
    SELECT id INTO v_player_id
    FROM players
    WHERE team_id = p_team_id
      AND is_position_compatible(position, p_position)
      AND (position_id IS NULL OR position_id != p_exclude_position_id)
    ORDER BY rating DESC
    LIMIT 1;
  END IF;

  -- If still no match, get highest rated available player
  IF v_player_id IS NULL THEN
    SELECT id INTO v_player_id
    FROM players
    WHERE team_id = p_team_id
      AND position_id IS NULL
    ORDER BY rating DESC
    LIMIT 1;
  END IF;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql;

-- Update the formation change function to automatically assign players
CREATE OR REPLACE FUNCTION update_team_formation(
  p_team_id uuid,
  p_formation text
) RETURNS void AS $$
DECLARE
  v_positions text[];
  v_position_ids text[];
  v_position text;
  v_position_id text;
  v_player_id uuid;
  v_i integer;
BEGIN
  -- Verify team ownership
  IF NOT EXISTS (
    SELECT 1 FROM teams 
    WHERE id = p_team_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this team''s formation';
  END IF;

  -- Set positions based on formation
  CASE p_formation
    WHEN '4-4-2' THEN
      v_positions := ARRAY['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'];
      v_position_ids := ARRAY['gk', 'lb', 'cb1', 'cb2', 'rb', 'lm', 'cm1', 'cm2', 'rm', 'st1', 'st2'];
    WHEN '4-3-3' THEN
      v_positions := ARRAY['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'];
      v_position_ids := ARRAY['gk', 'lb', 'cb1', 'cb2', 'rb', 'cdm', 'cm1', 'cm2', 'lw', 'st', 'rw'];
    WHEN '3-5-2' THEN
      v_positions := ARRAY['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CDM', 'CM', 'RM', 'ST', 'ST'];
      v_position_ids := ARRAY['gk', 'cb1', 'cb2', 'cb3', 'lm', 'cm1', 'cdm', 'cm2', 'rm', 'st1', 'st2'];
    WHEN '4-2-3-1' THEN
      v_positions := ARRAY['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LW', 'RW', 'ST'];
      v_position_ids := ARRAY['gk', 'lb', 'cb1', 'cb2', 'rb', 'cdm1', 'cdm2', 'cam', 'lw', 'rw', 'st'];
    ELSE
      RAISE EXCEPTION 'Invalid formation: %', p_formation;
  END CASE;

  -- Clear all position assignments
  UPDATE players 
  SET position_id = NULL 
  WHERE team_id = p_team_id;

  -- Assign players to positions
  FOR v_i IN 1..array_length(v_positions, 1) LOOP
    v_position := v_positions[v_i];
    v_position_id := v_position_ids[v_i];
    
    -- Find best player for this position
    v_player_id := find_best_player_for_position(p_team_id, v_position);
    
    -- If a player was found, assign them to the position
    IF v_player_id IS NOT NULL THEN
      UPDATE players 
      SET position_id = v_position_id,
          position = v_position
      WHERE id = v_player_id;
    END IF;
  END LOOP;

  -- Update team formation
  UPDATE teams 
  SET formation = p_formation 
  WHERE id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;