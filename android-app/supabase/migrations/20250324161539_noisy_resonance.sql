/*
  # Update Player Names and Add Nationality

  1. Changes
    - Add nationality column to players table
    - Update default player names to be more realistic with unique names
    - Add function to generate unique player names with nationality
*/

-- Add nationality column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'nationality'
  ) THEN
    ALTER TABLE players ADD COLUMN nationality text DEFAULT 'England';
  END IF;
END $$;

-- Function to generate a unique player name
CREATE OR REPLACE FUNCTION generate_unique_player_name(
  p_first_names text[],
  p_last_names text[]
) RETURNS text AS $$
DECLARE
  v_name text;
  v_attempts integer := 0;
  v_max_attempts integer := 100;
BEGIN
  LOOP
    -- Generate a random name
    v_name := p_first_names[1 + floor(random() * array_length(p_first_names, 1))] || ' ' ||
              p_last_names[1 + floor(random() * array_length(p_last_names, 1))];
    
    -- Check if name exists
    IF NOT EXISTS (SELECT 1 FROM players WHERE name = v_name) THEN
      RETURN v_name;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      -- If we can't find a unique name, append a number
      v_name := v_name || ' ' || v_attempts::text;
      RETURN v_name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update player names
CREATE OR REPLACE FUNCTION update_default_player_names()
RETURNS void AS $$
DECLARE
  v_first_names text[] := ARRAY[
    'James', 'John', 'David', 'Michael', 'William', 'Robert', 'Thomas', 'Daniel',
    'Paul', 'Mark', 'Steven', 'Andrew', 'Richard', 'Charles', 'Joseph', 'Christopher',
    'Daniel', 'Matthew', 'Anthony', 'Donald', 'Kevin', 'Jason', 'Jeff', 'Brian',
    'George', 'Edward', 'Ronald', 'Timothy', 'Ryan', 'Gary'
  ];
  v_last_names text[] := ARRAY[
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Moore', 'Jackson',
    'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker',
    'Hall', 'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Scott'
  ];
  v_nationalities text[] := ARRAY[
    'England', 'Spain', 'France', 'Germany', 'Italy', 'Brazil', 'Argentina',
    'Portugal', 'Netherlands', 'Belgium', 'Croatia', 'Uruguay', 'Colombia'
  ];
  v_player record;
  v_new_name text;
  v_nationality text;
BEGIN
  FOR v_player IN 
    SELECT * FROM players 
    WHERE name LIKE 'Player %'
  LOOP
    -- Generate unique name
    v_new_name := generate_unique_player_name(v_first_names, v_last_names);
    
    -- Generate random nationality
    v_nationality := v_nationalities[1 + floor(random() * array_length(v_nationalities, 1))];
    
    -- Update player
    UPDATE players 
    SET name = v_new_name,
        nationality = v_nationality
    WHERE id = v_player.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to update names
SELECT update_default_player_names();