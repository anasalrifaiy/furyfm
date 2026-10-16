/*
  # Add More Players with Unique Names

  1. Changes
    - Clear existing available players
    - Add ~1000 new players with unique names
    - Maintain current value structure (max 20M)
    - Keep realistic ratings and positions
*/

-- First, clear the available_players table
TRUNCATE available_players;

-- Create a sequence for unique player numbers
CREATE SEQUENCE IF NOT EXISTS player_number_seq;

-- Function to generate unique player names
CREATE OR REPLACE FUNCTION generate_unique_player_name(
  p_nationality text,
  p_number integer
) RETURNS text AS $$
DECLARE
  v_first_names text[];
  v_last_names text[];
BEGIN
  -- Set names based on nationality
  CASE p_nationality
    WHEN 'England' THEN
      v_first_names := ARRAY['James', 'Harry', 'Jack', 'George', 'William', 'Oliver', 'Charlie', 'Thomas', 'Jacob', 'Ethan'];
      v_last_names := ARRAY['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson'];
    WHEN 'Spain' THEN
      v_first_names := ARRAY['Alejandro', 'Carlos', 'David', 'Fernando', 'Gabriel', 'Hugo', 'Ivan', 'Javier', 'Luis', 'Miguel'];
      v_last_names := ARRAY['Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Sanchez', 'Perez', 'Gomez', 'Martin', 'Jimenez', 'Ruiz'];
    WHEN 'Germany' THEN
      v_first_names := ARRAY['Alexander', 'Felix', 'Jonas', 'Leon', 'Lukas', 'Maximilian', 'Niklas', 'Paul', 'Tim', 'Tobias'];
      v_last_names := ARRAY['Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'];
    WHEN 'France' THEN
      v_first_names := ARRAY['Antoine', 'Hugo', 'Jules', 'Leo', 'Lucas', 'Mathis', 'Nathan', 'Theo', 'Thomas', 'Victor'];
      v_last_names := ARRAY['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau'];
    WHEN 'Italy' THEN
      v_first_names := ARRAY['Alessandro', 'Andrea', 'Federico', 'Francesco', 'Giorgio', 'Giovanni', 'Lorenzo', 'Marco', 'Matteo', 'Roberto'];
      v_last_names := ARRAY['Rossi', 'Ferrari', 'Russo', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo'];
    ELSE
      v_first_names := ARRAY['Alex', 'Daniel', 'John', 'Michael', 'Peter', 'Robert', 'Steven', 'Thomas', 'William', 'David'];
      v_last_names := ARRAY['Silva', 'Santos', 'Costa', 'Pereira', 'Oliveira', 'Rodrigues', 'Ferreira', 'Alves', 'Sousa', 'Fernandes'];
  END CASE;

  -- Generate name with number to ensure uniqueness
  RETURN v_first_names[1 + floor(random() * array_length(v_first_names, 1))] || ' ' ||
         v_last_names[1 + floor(random() * array_length(v_last_names, 1))] || ' ' ||
         p_number::text;
END;
$$ LANGUAGE plpgsql;

-- Function to generate players
CREATE OR REPLACE FUNCTION generate_players(
  p_count integer,
  p_nationality text,
  p_position text,
  p_min_rating integer,
  p_max_rating integer
) RETURNS void AS $$
DECLARE
  v_rating integer;
  v_age integer;
  v_value integer;
  v_name text;
  v_number integer;
BEGIN
  FOR i IN 1..p_count LOOP
    -- Get next unique number
    SELECT nextval('player_number_seq') INTO v_number;
    
    -- Generate random rating within range
    v_rating := p_min_rating + floor(random() * (p_max_rating - p_min_rating + 1));
    
    -- Generate random age (17-35)
    v_age := 17 + floor(random() * 19);
    
    -- Calculate value based on rating (using existing scale)
    v_value := CASE 
      WHEN v_rating >= 90 THEN 20000000
      WHEN v_rating >= 85 THEN v_rating * 180000
      WHEN v_rating >= 80 THEN v_rating * 120000
      WHEN v_rating >= 75 THEN v_rating * 80000
      ELSE v_rating * 40000
    END;

    -- Generate unique name
    v_name := generate_unique_player_name(p_nationality, v_number);

    -- Insert player
    INSERT INTO available_players (
      name,
      position,
      rating,
      age,
      value,
      nationality
    ) VALUES (
      v_name,
      p_position,
      v_rating,
      v_age,
      v_value,
      p_nationality
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate players for each position and nationality
DO $$ 
DECLARE
  v_nationalities text[] := ARRAY['England', 'Spain', 'Germany', 'France', 'Italy', 'Brazil', 'Argentina', 'Portugal', 'Netherlands', 'Belgium'];
  v_nationality text;
BEGIN
  -- Reset the sequence
  ALTER SEQUENCE player_number_seq RESTART WITH 1;

  FOREACH v_nationality IN ARRAY v_nationalities LOOP
    -- Goalkeepers (fewer)
    PERFORM generate_players(10, v_nationality, 'GK', 75, 89);
    
    -- Defenders
    PERFORM generate_players(20, v_nationality, 'CB', 75, 87);
    PERFORM generate_players(10, v_nationality, 'LB', 75, 86);
    PERFORM generate_players(10, v_nationality, 'RB', 75, 86);
    
    -- Midfielders
    PERFORM generate_players(15, v_nationality, 'CDM', 75, 88);
    PERFORM generate_players(20, v_nationality, 'CM', 75, 89);
    PERFORM generate_players(15, v_nationality, 'CAM', 75, 89);
    
    -- Wingers
    PERFORM generate_players(10, v_nationality, 'LW', 75, 89);
    PERFORM generate_players(10, v_nationality, 'RW', 75, 89);
    
    -- Strikers
    PERFORM generate_players(15, v_nationality, 'ST', 75, 89);
  END LOOP;
END $$;

-- Drop the sequence as we don't need it anymore
DROP SEQUENCE player_number_seq;