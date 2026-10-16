/*
  # Add Player Development System

  1. Changes
    - Add player development tracking
    - Add performance statistics
    - Add automatic rating updates based on matches
    - Add potential and growth rate calculations
    - Add age-based development factors

  2. Details
    - Track matches played, goals, assists, etc.
    - Calculate development rate based on age and performance
    - Update ratings periodically based on performance
*/

-- Add development tracking columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS potential integer,
ADD COLUMN IF NOT EXISTS growth_rate numeric,
ADD COLUMN IF NOT EXISTS matches_played integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS goals integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS assists integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS clean_sheets integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS minutes_played integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rating_update timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS form_rating numeric DEFAULT 0;

-- Create function to calculate player potential
CREATE OR REPLACE FUNCTION calculate_player_potential(
  p_age integer,
  p_rating integer,
  p_performance numeric
) RETURNS integer AS $$
DECLARE
  v_potential integer;
  v_age_factor numeric;
BEGIN
  -- Age factor decreases as player gets older
  v_age_factor := GREATEST(0, (35 - p_age::numeric) / 18);
  
  -- Calculate potential based on current rating, age, and performance
  v_potential := p_rating + (
    ROUND(
      (v_age_factor * 10) + -- Age-based growth potential
      (p_performance * 2) + -- Performance impact
      (RANDOM() * 5)       -- Random factor
    )
  )::integer;

  -- Cap potential between 75 and 99
  RETURN GREATEST(75, LEAST(99, v_potential));
END;
$$ LANGUAGE plpgsql;

-- Create function to update player ratings based on performance
CREATE OR REPLACE FUNCTION update_player_rating(
  p_player_id uuid
) RETURNS void AS $$
DECLARE
  v_player record;
  v_performance numeric;
  v_rating_change integer;
  v_age_factor numeric;
BEGIN
  -- Get player data
  SELECT * INTO v_player
  FROM players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Calculate performance score (0-1)
  v_performance := CASE
    WHEN v_player.matches_played = 0 THEN 0
    ELSE (
      (v_player.goals * 3 + v_player.assists * 2 + 
       CASE WHEN v_player.position = 'GK' THEN v_player.clean_sheets * 5 ELSE 0 END)::numeric / 
      GREATEST(v_player.matches_played, 1)
    )
  END;

  -- Age factor for development
  v_age_factor := CASE
    WHEN v_player.age < 23 THEN 1.2  -- Young players develop faster
    WHEN v_player.age < 28 THEN 1.0  -- Prime age
    WHEN v_player.age < 32 THEN 0.8  -- Slowing down
    ELSE 0.6                         -- Veterans develop slowly
  END;

  -- Calculate rating change
  v_rating_change := ROUND(
    v_performance * v_age_factor * 
    (v_player.potential - v_player.rating)::numeric / 10
  )::integer;

  -- Update player rating
  UPDATE players
  SET 
    rating = GREATEST(75, LEAST(99, rating + v_rating_change)),
    form_rating = v_performance * 100,
    last_rating_update = now()
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to update all players' development
CREATE OR REPLACE FUNCTION update_all_players_development()
RETURNS void AS $$
DECLARE
  v_player record;
BEGIN
  -- Update each player's development
  FOR v_player IN
    SELECT id, age, rating
    FROM players
    WHERE last_rating_update < now() - interval '1 week'
  LOOP
    -- Update player's rating
    PERFORM update_player_rating(v_player.id);
    
    -- Update potential
    UPDATE players
    SET potential = calculate_player_potential(age, rating, form_rating / 100)
    WHERE id = v_player.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update player stats after matches
CREATE OR REPLACE FUNCTION update_player_stats_after_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Update player statistics based on match events
  WITH match_stats AS (
    SELECT 
      player_id,
      COUNT(*) FILTER (WHERE event_type = 'goal') as goals,
      COUNT(*) FILTER (WHERE event_type = 'assist') as assists,
      COUNT(*) FILTER (WHERE event_type = 'clean_sheet') as clean_sheets,
      90 as minutes -- Assuming full match participation
    FROM match_events
    WHERE match_id = NEW.id
    GROUP BY player_id
  )
  UPDATE players p
  SET 
    matches_played = matches_played + 1,
    goals = goals + COALESCE(ms.goals, 0),
    assists = assists + COALESCE(ms.assists, 0),
    clean_sheets = clean_sheets + COALESCE(ms.clean_sheets, 0),
    minutes_played = minutes_played + COALESCE(ms.minutes, 0)
  FROM match_stats ms
  WHERE p.id = ms.player_id;

  -- Trigger rating updates for involved players
  PERFORM update_player_rating(player_id)
  FROM match_events
  WHERE match_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on matches table
DROP TRIGGER IF EXISTS update_player_stats_trigger ON matches;
CREATE TRIGGER update_player_stats_trigger
  AFTER UPDATE OF home_score, away_score
  ON matches
  FOR EACH ROW
  WHEN (OLD.home_score IS NULL AND NEW.home_score IS NOT NULL)
  EXECUTE FUNCTION update_player_stats_after_match();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_last_rating_update ON players(last_rating_update);
CREATE INDEX IF NOT EXISTS idx_players_potential ON players(potential);
CREATE INDEX IF NOT EXISTS idx_players_form_rating ON players(form_rating);

-- Add comments
COMMENT ON FUNCTION calculate_player_potential IS 'Calculates player potential based on age, current rating, and performance';
COMMENT ON FUNCTION update_player_rating IS 'Updates player rating based on match performance and development factors';
COMMENT ON FUNCTION update_all_players_development IS 'Periodically updates all players development and ratings';