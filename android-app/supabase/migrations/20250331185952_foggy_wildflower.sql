/*
  # Reset Data and Update Market Positions

  1. Changes
    - Delete all existing players from teams
    - Reset team budgets to 100M
    - Remove CF position from market
    - Add LM and RM positions to market
    - Reset all friend requests
    - Update available players with new position rules
*/

-- First, disable RLS temporarily
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE available_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- Delete all existing players from teams
DELETE FROM players;

-- Reset all team budgets to 100M
UPDATE teams SET budget = 100000000;

-- Clear friend requests
TRUNCATE friend_requests;

-- Clear available players
TRUNCATE available_players;

-- Re-enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Function to generate new players with updated positions
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
  v_attempts integer := 0;
BEGIN
  -- Set available nationalities if not provided
  v_nationalities := ARRAY['England', 'Spain', 'Germany', 'France', 'Italy'];
  
  -- Set nationality
  v_nationality := COALESCE(p_nationality, v_nationalities[1 + floor(random() * array_length(v_nationalities, 1))]);

  -- Set names based on nationality
  CASE v_nationality
    WHEN 'England' THEN
      v_first_names := ARRAY[
        'James', 'Harry', 'Jack', 'George', 'William', 'Oliver', 'Charlie', 'Thomas', 'Jacob', 'Ethan',
        'Alexander', 'Daniel', 'Joseph', 'Samuel', 'Benjamin', 'Edward', 'Henry', 'Arthur', 'Michael', 'David'
      ];
      v_last_names := ARRAY[
        'Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson',
        'Roberts', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Lewis'
      ];
    WHEN 'Spain' THEN
      v_first_names := ARRAY[
        'Alejandro', 'Carlos', 'David', 'Fernando', 'Gabriel', 'Hugo', 'Ivan', 'Javier', 'Luis', 'Miguel',
        'Adrian', 'Diego', 'Eduardo', 'Francisco', 'Guillermo', 'Hector', 'Ignacio', 'Jorge', 'Manuel', 'Pablo'
      ];
      v_last_names := ARRAY[
        'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Sanchez', 'Perez', 'Gomez', 'Martin', 'Jimenez', 'Ruiz',
        'Hernandez', 'Diaz', 'Moreno', 'Alvarez', 'Romero', 'Alonso', 'Gutierrez', 'Navarro', 'Torres', 'Dominguez'
      ];
    WHEN 'Germany' THEN
      v_first_names := ARRAY[
        'Alexander', 'Felix', 'Jonas', 'Leon', 'Lukas', 'Maximilian', 'Niklas', 'Paul', 'Tim', 'Tobias',
        'Andreas', 'Benjamin', 'Christian', 'Daniel', 'Erik', 'Florian', 'Gustav', 'Henrik', 'Jan', 'Karl'
      ];
      v_last_names := ARRAY[
        'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
        'Schaefer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Schwarz', 'Zimmermann'
      ];
    WHEN 'France' THEN
      v_first_names := ARRAY[
        'Antoine', 'Hugo', 'Jules', 'Leo', 'Lucas', 'Mathis', 'Nathan', 'Theo', 'Thomas', 'Victor',
        'Alexandre', 'Baptiste', 'Clement', 'Damien', 'Etienne', 'Fabien', 'Gabriel', 'Henri', 'Jean', 'Kevin'
      ];
      v_last_names := ARRAY[
        'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
        'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'
      ];
    WHEN 'Italy' THEN
      v_first_names := ARRAY[
        'Alessandro', 'Andrea', 'Federico', 'Francesco', 'Giorgio', 'Giovanni', 'Lorenzo', 'Marco', 'Matteo', 'Roberto',
        'Alberto', 'Bruno', 'Carlo', 'Dario', 'Emilio', 'Fabio', 'Gianni', 'Luigi', 'Mario', 'Paolo'
      ];
      v_last_names := ARRAY[
        'Rossi', 'Ferrari', 'Russo', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo',
        'Conti', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro'
      ];
    ELSE
      v_first_names := ARRAY[
        'Alex', 'Daniel', 'John', 'Michael', 'Peter', 'Robert', 'Steven', 'Thomas', 'William', 'David',
        'Adam', 'Brian', 'Chris', 'Donald', 'Eric', 'Frank', 'Gary', 'Henry', 'Ian', 'Jason'
      ];
      v_last_names := ARRAY[
        'Silva', 'Santos', 'Costa', 'Pereira', 'Oliveira', 'Rodrigues', 'Ferreira', 'Alves', 'Sousa', 'Fernandes',
        'Carvalho', 'Gomes', 'Martins', 'Araujo', 'Ribeiro', 'Pinto', 'Cunha', 'Reis', 'Rocha', 'Correia'
      ];
  END CASE;

  -- Try to generate a unique name
  LOOP
    -- Generate random name
    v_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))] || ' ' ||
              v_last_names[1 + floor(random() * array_length(v_last_names, 1))];
    
    -- Check if name exists
    IF NOT EXISTS (
      SELECT 1 
      FROM available_players 
      WHERE name = v_name
      UNION
      SELECT 1 
      FROM players 
      WHERE name = v_name
    ) THEN
      EXIT; -- Found a unique name
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= 100 THEN
      -- If we can't find a unique name, add nationality as suffix
      v_name := v_name || ' (' || v_nationality || ')';
      EXIT;
    END IF;
  END LOOP;

  -- Generate random rating (75-89)
  v_rating := 75 + floor(random() * 15);
  
  -- Generate random age (17-35)
  v_age := 17 + floor(random() * 19);
  
  -- Calculate value based on rating (max 12M)
  v_value := CASE 
    WHEN v_rating >= 90 THEN 12000000
    WHEN v_rating >= 85 THEN v_rating * 120000
    WHEN v_rating >= 80 THEN v_rating * 80000
    WHEN v_rating >= 75 THEN v_rating * 50000
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
    p_position,
    v_rating,
    v_age,
    v_value,
    v_nationality
  ) RETURNING id INTO v_new_player_id;

  RETURN v_new_player_id;
END;
$$ LANGUAGE plpgsql;

-- Generate initial player pool with updated positions
DO $$ 
DECLARE
  v_nationalities text[] := ARRAY['England', 'Spain', 'Germany', 'France', 'Italy'];
  v_nationality text;
BEGIN
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
    FOR i IN 1..15 LOOP
      PERFORM generate_new_player('LM', v_nationality);
    END LOOP;
    FOR i IN 1..15 LOOP
      PERFORM generate_new_player('RM', v_nationality);
    END LOOP;
    
    -- Forwards
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('LW', v_nationality);
    END LOOP;
    FOR i IN 1..10 LOOP
      PERFORM generate_new_player('RW', v_nationality);
    END LOOP;
    FOR i IN 1..15 LOOP
      PERFORM generate_new_player('ST', v_nationality);
    END LOOP;
  END LOOP;
END $$;

-- Add comment explaining the changes
COMMENT ON TABLE available_players IS 'Contains available players with adjusted values (max 12M) to match 100M team budget';