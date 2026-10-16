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

-- Function to generate unique player names
CREATE OR REPLACE FUNCTION generate_unique_player_name(
  p_nationality text
) RETURNS text AS $$
DECLARE
  v_first_names text[];
  v_last_names text[];
  v_name text;
  v_attempts integer := 0;
BEGIN
  -- Set names based on nationality
  CASE p_nationality
    WHEN 'England' THEN
      v_first_names := ARRAY[
        'James', 'Harry', 'Jack', 'George', 'William', 'Oliver', 'Charlie', 'Thomas', 'Jacob', 'Ethan',
        'Alexander', 'Daniel', 'Joseph', 'Samuel', 'Benjamin', 'Edward', 'Henry', 'Arthur', 'Michael', 'David',
        'Frederick', 'Christopher', 'Matthew', 'Andrew', 'Richard', 'Charles', 'Philip', 'Peter', 'Robert', 'Stephen'
      ];
      v_last_names := ARRAY[
        'Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson',
        'Roberts', 'Walker', 'Wright', 'Robinson', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Lewis',
        'Wood', 'Harris', 'Martin', 'Jackson', 'Clarke', 'James', 'Phillips', 'Lee', 'Baker', 'Parker'
      ];
    WHEN 'Spain' THEN
      v_first_names := ARRAY[
        'Alejandro', 'Carlos', 'David', 'Fernando', 'Gabriel', 'Hugo', 'Ivan', 'Javier', 'Luis', 'Miguel',
        'Adrian', 'Diego', 'Eduardo', 'Francisco', 'Guillermo', 'Hector', 'Ignacio', 'Jorge', 'Manuel', 'Pablo',
        'Rafael', 'Santiago', 'Victor', 'Xavier', 'Alberto', 'Cesar', 'Emilio', 'Felix', 'Lorenzo', 'Marco'
      ];
      v_last_names := ARRAY[
        'Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Sanchez', 'Perez', 'Gomez', 'Martin', 'Jimenez', 'Ruiz',
        'Hernandez', 'Diaz', 'Moreno', 'Alvarez', 'Romero', 'Alonso', 'Gutierrez', 'Navarro', 'Torres', 'Dominguez',
        'Vazquez', 'Ramos', 'Gil', 'Ramirez', 'Serrano', 'Blanco', 'Suarez', 'Molina', 'Morales', 'Ortega'
      ];
    WHEN 'Germany' THEN
      v_first_names := ARRAY[
        'Alexander', 'Felix', 'Jonas', 'Leon', 'Lukas', 'Maximilian', 'Niklas', 'Paul', 'Tim', 'Tobias',
        'Andreas', 'Benjamin', 'Christian', 'Daniel', 'Erik', 'Florian', 'Gustav', 'Henrik', 'Jan', 'Karl',
        'Lars', 'Martin', 'Nils', 'Oliver', 'Peter', 'Robert', 'Sebastian', 'Thomas', 'Ulf', 'Wolfgang'
      ];
      v_last_names := ARRAY[
        'Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann',
        'Schaefer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Schwarz', 'Zimmermann',
        'Braun', 'Krueger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt', 'Werner', 'Schmitz', 'Krause', 'Meier'
      ];
    WHEN 'France' THEN
      v_first_names := ARRAY[
        'Antoine', 'Hugo', 'Jules', 'Leo', 'Lucas', 'Mathis', 'Nathan', 'Theo', 'Thomas', 'Victor',
        'Alexandre', 'Baptiste', 'Clement', 'Damien', 'Etienne', 'Fabien', 'Gabriel', 'Henri', 'Jean', 'Kevin',
        'Laurent', 'Maxime', 'Nicolas', 'Olivier', 'Pierre', 'Quentin', 'Romain', 'Simon', 'Vincent', 'Yann'
      ];
      v_last_names := ARRAY[
        'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
        'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
        'Morel', 'Girard', 'Andre', 'Lefevre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez'
      ];
    WHEN 'Italy' THEN
      v_first_names := ARRAY[
        'Alessandro', 'Andrea', 'Federico', 'Francesco', 'Giorgio', 'Giovanni', 'Lorenzo', 'Marco', 'Matteo', 'Roberto',
        'Alberto', 'Bruno', 'Carlo', 'Dario', 'Emilio', 'Fabio', 'Gianni', 'Luigi', 'Mario', 'Paolo',
        'Pietro', 'Riccardo', 'Salvatore', 'Stefano', 'Tommaso', 'Umberto', 'Valentino', 'Vincenzo', 'Antonio', 'Domenico'
      ];
      v_last_names := ARRAY[
        'Rossi', 'Ferrari', 'Russo', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo',
        'Conti', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro',
        'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo', 'Gentile', 'Vitale'
      ];
    ELSE
      v_first_names := ARRAY[
        'Alex', 'Daniel', 'John', 'Michael', 'Peter', 'Robert', 'Steven', 'Thomas', 'William', 'David',
        'Adam', 'Brian', 'Chris', 'Donald', 'Eric', 'Frank', 'Gary', 'Henry', 'Ian', 'Jason',
        'Kevin', 'Larry', 'Mark', 'Nathan', 'Oscar', 'Paul', 'Quinn', 'Ryan', 'Scott', 'Tony'
      ];
      v_last_names := ARRAY[
        'Silva', 'Santos', 'Costa', 'Pereira', 'Oliveira', 'Rodrigues', 'Ferreira', 'Alves', 'Sousa', 'Fernandes',
        'Carvalho', 'Gomes', 'Martins', 'Araujo', 'Ribeiro', 'Pinto', 'Cunha', 'Reis', 'Rocha', 'Correia',
        'Nunes', 'Marques', 'Lopes', 'Mendes', 'Castro', 'Teixeira', 'Dias', 'Cruz', 'Lima', 'Moreira'
      ];
  END CASE;

  LOOP
    -- Generate a random name
    v_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))] || ' ' ||
              v_last_names[1 + floor(random() * array_length(v_last_names, 1))];
    
    -- Check if name exists
    IF NOT EXISTS (SELECT 1 FROM available_players WHERE name = v_name) THEN
      RETURN v_name;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= 100 THEN
      -- If we can't find a unique name after 100 attempts, add nationality as suffix
      v_name := v_name || ' (' || p_nationality || ')';
      RETURN v_name;
    END IF;
  END LOOP;
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
BEGIN
  FOR i IN 1..p_count LOOP
    -- Generate random rating within range
    v_rating := p_min_rating + floor(random() * (p_max_rating - p_min_rating + 1));
    
    -- Generate random age (17-35)
    v_age := 17 + floor(random() * 19);
    
    -- Calculate value based on rating (max 20M)
    v_value := CASE 
      WHEN v_rating >= 90 THEN 20000000
      WHEN v_rating >= 85 THEN v_rating * 180000
      WHEN v_rating >= 80 THEN v_rating * 120000
      WHEN v_rating >= 75 THEN v_rating * 80000
      ELSE v_rating * 40000
    END;

    -- Generate unique name
    v_name := generate_unique_player_name(p_nationality);

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