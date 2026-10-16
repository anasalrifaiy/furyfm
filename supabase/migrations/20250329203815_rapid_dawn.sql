/*
  # Add Team Rating and Player Development System

  1. Changes
    - Add player development tracking
    - Add team rating calculation
    - Add player performance tracking
    - Add experience points system
*/

-- Add columns for player development
ALTER TABLE players ADD COLUMN IF NOT EXISTS experience integer DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS potential integer DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS form integer DEFAULT 100;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_match_rating integer DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS matches_played integer DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS goals_scored integer DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS assists integer DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS clean_sheets integer DEFAULT 0;

-- Function to calculate team rating based on player ratings and form
CREATE OR REPLACE FUNCTION calculate_team_rating(p_team_id uuid)
RETURNS integer AS $$
DECLARE
  v_total_rating integer := 0;
  v_player_count integer := 0;
  v_formation text;
  v_player record;
BEGIN
  -- Get team formation
  SELECT formation INTO v_formation
  FROM teams
  WHERE id = p_team_id;

  -- Calculate average rating of positioned players
  FOR v_player IN (
    SELECT 
      position,
      rating,
      form,
      experience
    FROM players
    WHERE team_id = p_team_id
    AND position_id IS NOT NULL
  ) LOOP
    -- Calculate player's effective rating based on form and experience
    v_total_rating := v_total_rating + (
      v_player.rating + 
      (v_player.form - 100) / 10 +  -- Form impact (-2 to +2)
      LEAST(v_player.experience / 1000, 5)  -- Experience bonus (max +5)
    );
    v_player_count := v_player_count + 1;
  END LOOP;

  -- Return average rating, ensuring at least 70
  RETURN GREATEST(
    70,
    CASE
      WHEN v_player_count > 0 THEN v_total_rating / v_player_count
      ELSE 70
    END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to update player development after a match
CREATE OR REPLACE FUNCTION update_player_development(
  p_player_id uuid,
  p_match_rating integer
) RETURNS void AS $$
DECLARE
  v_player record;
  v_age_factor float;
  v_potential_factor float;
  v_experience_gain integer;
  v_rating_change integer;
BEGIN
  -- Get player info
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  -- Calculate age factor (younger players develop faster)
  v_age_factor := CASE
    WHEN v_player.age < 21 THEN 1.5
    WHEN v_player.age < 24 THEN 1.2
    WHEN v_player.age < 28 THEN 1.0
    WHEN v_player.age < 32 THEN 0.8
    ELSE 0.5
  END;

  -- Calculate potential factor
  IF v_player.potential IS NULL THEN
    -- Set initial potential (75-95)
    v_player.potential := GREATEST(75, LEAST(95, v_player.rating + floor(random() * 10)));
  END IF;
  v_potential_factor := GREATEST(0.1, (v_player.potential - v_player.rating) / 20.0);

  -- Calculate experience gain
  v_experience_gain := floor(
    50 * v_age_factor * 
    CASE
      WHEN p_match_rating >= 8 THEN 1.5  -- Excellent performance
      WHEN p_match_rating >= 7 THEN 1.2  -- Good performance
      WHEN p_match_rating >= 6 THEN 1.0  -- Average performance
      ELSE 0.8                           -- Poor performance
    END
  );

  -- Calculate rating change (can be positive or negative)
  v_rating_change := CASE
    WHEN p_match_rating >= 8 THEN floor(random() * 2)  -- Possible +1
    WHEN p_match_rating <= 5 THEN -floor(random() * 2) -- Possible -1
    ELSE 0
  END;

  -- Update player stats
  UPDATE players
  SET
    experience = experience + v_experience_gain,
    rating = GREATEST(60, LEAST(99, rating + v_rating_change)),
    form = GREATEST(50, LEAST(150, 
      form + (p_match_rating - 6) * 10  -- Form changes based on performance
    )),
    last_match_rating = p_match_rating,
    matches_played = matches_played + 1
  WHERE id = p_player_id;

  -- Update team rating
  UPDATE teams
  SET rating = calculate_team_rating(v_player.team_id)
  WHERE id = v_player.team_id;
END;
$$ LANGUAGE plpgsql;

-- Function to simulate player match rating
CREATE OR REPLACE FUNCTION simulate_player_match_rating(
  p_player_id uuid,
  p_team_won boolean
) RETURNS integer AS $$
DECLARE
  v_player record;
  v_base_rating integer;
  v_form_factor float;
BEGIN
  -- Get player info
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id;

  -- Calculate base rating (6-8)
  v_base_rating := 6 + floor(random() * 3);
  
  -- Apply form factor
  v_form_factor := (v_player.form - 100) / 100.0;  -- -0.5 to +0.5
  v_base_rating := v_base_rating + floor(v_form_factor * 2);  -- Form impact: ±1

  -- Adjust for team result
  IF p_team_won THEN
    v_base_rating := v_base_rating + 1;
  END IF;

  -- Ensure rating is between 1 and 10
  RETURN GREATEST(1, LEAST(10, v_base_rating));
END;
$$ LANGUAGE plpgsql;

-- Update simulate_match function to include player development
CREATE OR REPLACE FUNCTION simulate_match(p_match_id uuid)
RETURNS void AS $$
DECLARE
  -- [Previous variable declarations remain the same]
BEGIN
  -- [Previous match simulation logic remains the same]

  -- After match is complete, update player development
  FOR v_player IN (
    SELECT p.id, p.team_id
    FROM players p
    WHERE p.team_id IN (v_match.home_team_id, v_match.away_team_id)
    AND p.position_id IS NOT NULL
  ) LOOP
    -- Simulate match rating and update development
    PERFORM update_player_development(
      v_player.id,
      simulate_player_match_rating(
        v_player.id,
        CASE
          WHEN v_player.team_id = v_match.home_team_id THEN v_home_score > v_away_score
          ELSE v_away_score > v_home_score
        END
      )
    );
  END LOOP;

  -- [Rest of the function remains the same]
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN players.experience IS 'Player experience points gained from matches';
COMMENT ON COLUMN players.potential IS 'Maximum potential rating the player can achieve';
COMMENT ON COLUMN players.form IS 'Current form (50-150, 100 is normal)';
COMMENT ON COLUMN players.last_match_rating IS 'Rating from the last match (1-10)';
