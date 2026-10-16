/*
  # Fix Player Name Generation

  1. Changes
    - Improve name generation to avoid duplicates
    - Add sequence for unique player IDs
    - Update functions to handle positions correctly
*/

-- Create a sequence for unique player IDs
CREATE SEQUENCE IF NOT EXISTS player_id_seq;

-- Function to generate a new player
CREATE OR REPLACE FUNCTION generate_new_player(
  p_position text,
  p_nationality text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_first_names text[];
  v_last_names text[];
  v_nationalities text[];
  v_name text;
  v_nationality text;
  v_rating integer;
  v_age integer;
  v_value integer;
  v_new_player_id uuid;
  v_player_number integer;
BEGIN
  -- Set available nationalities if not provided
  v_nationalities := ARRAY['England', 'Spain', 'Germany', 'France', 'Italy'];
  
  -- Set nationality
  v_nationality := COALESCE(p_nationality, v_nationalities[1 + floor(random() * array_length(v_nationalities, 1))]);

  -- Set names based on nationality
  CASE v_nationality
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

  -- Get next unique number
  v_player_number := nextval('player_id_seq');

  -- Generate name with unique number
  v_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))] || ' ' ||
            v_last_names[1 + floor(random() * array_length(v_last_names, 1))] || ' ' ||
            v_player_number::text;

  -- Generate random rating (75-89)
  v_rating := 75 + floor(random() * 15);
  
  -- Generate random age (17-35)
  v_age := 17 + floor(random() * 19);
  
  -- Calculate value based on rating
  v_value := CASE 
    WHEN v_rating >= 90 THEN 15000000
    WHEN v_rating >= 85 THEN v_rating * 150000
    WHEN v_rating >= 80 THEN v_rating * 100000
    WHEN v_rating >= 75 THEN v_rating * 60000
    ELSE v_rating * 30000
  END;

  -- Insert new player
  INSERT INTO available_players (
    name,
    position,
    original_position,
    rating,
    age,
    value,
    nationality
  ) VALUES (
    v_name,
    p_position,
    p_position,  -- Set original_position same as position
    v_rating,
    v_age,
    v_value,
    v_nationality
  ) RETURNING id INTO v_new_player_id;

  RETURN v_new_player_id;
END;
$$ LANGUAGE plpgsql;

-- Reset available players and generate initial pool
DELETE FROM available_players;

-- Generate initial player pool
DO $$ 
DECLARE
  v_nationalities text[] := ARRAY['England', 'Spain', 'Germany', 'France', 'Italy'];
  v_nationality text;
BEGIN
  -- Reset the sequence
  ALTER SEQUENCE player_id_seq RESTART WITH 1;

  FOREACH v_nationality IN ARRAY v_nationalities LOOP
    -- Goalkeepers (fewer)
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('GK', v_nationality);
    END LOOP;
    
    -- Defenders
    FOR i IN 1..20 LOOP
      PERFORM generate_new_player('CB', v_nationality);
    END LOOP;
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('LB', v_nationality);
    END LOOP;
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('RB', v_nationality);
    END LOOP;
    
    -- Midfielders
    FOR i IN 1..15 LOOP
      PERFORM generate_new_player('CDM', v_nationality);
    END LOOP;
    FOR i IN 1..20 LOOP
      PERFORM generate_new_player('CM', v_nationality);
    END LOOP;
    FOR i IN 1..15 LOOP
      PERFORM generate_new_player('CAM', v_nationality);
    END LOOP;
    
    -- Wingers
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('LW', v_nationality);
    END LOOP;
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('RW', v_nationality);
    END LOOP;
    
    -- Strikers
    FOR i IN 1..15 LOOP
      PERFORM generate_new_player('ST', v_nationality);
    END LOOP;
  END LOOP;
END $$;