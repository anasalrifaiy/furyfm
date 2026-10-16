/*
  # Add Player Generation System

  1. Changes
    - Add function to generate new players with unique names
    - Update transfer function to generate replacement players
    - Maintain balanced player pool
*/

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
  v_attempts integer := 0;
  v_suffix integer;
BEGIN
  -- Set available nationalities if not provided
  v_nationalities := ARRAY['England', 'Spain', 'Germany', 'France', 'Italy'];
  
  -- Set names based on nationality
  CASE COALESCE(p_nationality, v_nationalities[1 + floor(random() * array_length(v_nationalities, 1))])
    WHEN 'England' THEN
      v_first_names := ARRAY['James', 'Harry', 'Jack', 'George', 'William', 'Oliver', 'Charlie', 'Thomas', 'Jacob', 'Ethan'];
      v_last_names := ARRAY['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson'];
      v_nationality := 'England';
    WHEN 'Spain' THEN
      v_first_names := ARRAY['Alejandro', 'Carlos', 'David', 'Fernando', 'Gabriel', 'Hugo', 'Ivan', 'Javier', 'Luis', 'Miguel'];
      v_last_names := ARRAY['Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Sanchez', 'Perez', 'Gomez', 'Martin', 'Jimenez', 'Ruiz'];
      v_nationality := 'Spain';
    WHEN 'Germany' THEN
      v_first_names := ARRAY['Alexander', 'Felix', 'Jonas', 'Leon', 'Lukas', 'Maximilian', 'Niklas', 'Paul', 'Tim', 'Tobias'];
      v_last_names := ARRAY['Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann'];
      v_nationality := 'Germany';
    WHEN 'France' THEN
      v_first_names := ARRAY['Antoine', 'Hugo', 'Jules', 'Leo', 'Lucas', 'Mathis', 'Nathan', 'Theo', 'Thomas', 'Victor'];
      v_last_names := ARRAY['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau'];
      v_nationality := 'France';
    WHEN 'Italy' THEN
      v_first_names := ARRAY['Alessandro', 'Andrea', 'Federico', 'Francesco', 'Giorgio', 'Giovanni', 'Lorenzo', 'Marco', 'Matteo', 'Roberto'];
      v_last_names := ARRAY['Rossi', 'Ferrari', 'Russo', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo'];
      v_nationality := 'Italy';
    ELSE
      v_first_names := ARRAY['Alex', 'Daniel', 'John', 'Michael', 'Peter', 'Robert', 'Steven', 'Thomas', 'William', 'David'];
      v_last_names := ARRAY['Silva', 'Santos', 'Costa', 'Pereira', 'Oliveira', 'Rodrigues', 'Ferreira', 'Alves', 'Sousa', 'Fernandes'];
      v_nationality := p_nationality;
  END CASE;

  -- Get the next available suffix number for this nationality
  SELECT COALESCE(MAX(REGEXP_REPLACE(name, '^.*?(\d+)$', '\1')::integer), 0) + 1
  INTO v_suffix
  FROM available_players
  WHERE nationality = v_nationality
  AND name ~ '\d+$';

  -- Generate name with suffix
  v_name := v_first_names[1 + floor(random() * array_length(v_first_names, 1))] || ' ' ||
            v_last_names[1 + floor(random() * array_length(v_last_names, 1))] || ' ' ||
            v_suffix::text;

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
    v_nationality
  ) RETURNING id INTO v_new_player_id;

  RETURN v_new_player_id;
END;
$$ LANGUAGE plpgsql;

-- Update handle_transfer function to generate replacement player
CREATE OR REPLACE FUNCTION handle_transfer(
  p_player_id uuid,
  p_to_team_id uuid,
  p_amount integer
) RETURNS void AS $$
DECLARE
  v_player record;
  v_buyer_budget integer;
  v_new_player_id uuid;
  v_user_id uuid;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  -- Verify team ownership
  PERFORM 1 FROM teams
  WHERE id = p_to_team_id
  AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to make transfers for this team';
  END IF;

  -- Get player from available_players
  SELECT * INTO v_player
  FROM available_players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found or no longer available';
  END IF;

  -- Get and lock buyer's team row
  SELECT budget INTO v_buyer_budget
  FROM teams
  WHERE id = p_to_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- Validate transfer
  IF v_buyer_budget < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Create new player in team's squad
  INSERT INTO players (
    name,
    position,
    original_position,
    position_id,
    rating,
    age,
    value,
    team_id,
    nationality
  ) VALUES (
    v_player.name,
    v_player.position,
    v_player.position,
    NULL,
    v_player.rating,
    v_player.age,
    v_player.value,
    p_to_team_id,
    v_player.nationality
  ) RETURNING id INTO v_new_player_id;

  -- Update team budget
  UPDATE teams
  SET budget = budget - p_amount
  WHERE id = p_to_team_id;

  -- Record transfer in history
  INSERT INTO transfer_history (
    player_id,
    to_team_id,
    amount,
    source_table
  ) VALUES (
    v_new_player_id,
    p_to_team_id,
    p_amount,
    'players'
  );

  -- Remove the bought player
  DELETE FROM available_players
  WHERE id = p_player_id;

  -- Generate a replacement player with similar position
  PERFORM generate_new_player(v_player.position, v_player.nationality);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset available players and generate initial pool
DELETE FROM available_players;

-- Generate initial player pool
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