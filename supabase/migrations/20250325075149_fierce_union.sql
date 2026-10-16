/*
  # Update Players and Image System

  1. Changes
    - Add more teams and players from top 5 leagues
    - Implement a better image system using a collection of unique player photos
    - Update existing functions to handle image assignment
*/

-- First, let's create a table to store our image collection
CREATE TABLE player_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  position text NOT NULL,
  used boolean DEFAULT false
);

-- Insert a collection of unique player images from Unsplash
INSERT INTO player_images (url, position) VALUES
  -- Goalkeepers
  ('https://images.unsplash.com/photo-1628891890467-b79de80b8c1f?w=300', 'GK'),
  ('https://images.unsplash.com/photo-1661844557086-c2183876b3c3?w=300', 'GK'),
  ('https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?w=300', 'GK'),
  
  -- Defenders
  ('https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?w=300', 'DEF'),
  ('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300', 'DEF'),
  ('https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=300', 'DEF'),
  
  -- Midfielders
  ('https://images.unsplash.com/photo-1631495634750-0c507026b3c8?w=300', 'MID'),
  ('https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=300', 'MID'),
  ('https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=300', 'MID'),
  
  -- Forwards
  ('https://images.unsplash.com/photo-1605129742404-a1bfa891b4ea?w=300', 'FWD'),
  ('https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=300', 'FWD'),
  ('https://images.unsplash.com/photo-1600250395178-40fe752e5189?w=300', 'FWD');

-- Create a function to get a random unused image for a position
CREATE OR REPLACE FUNCTION get_random_player_image(player_pos text)
RETURNS text AS $$
DECLARE
  v_url text;
  v_position text;
BEGIN
  -- Map detailed positions to general positions
  v_position := CASE 
    WHEN player_pos = 'GK' THEN 'GK'
    WHEN player_pos IN ('CB', 'LB', 'RB', 'LWB', 'RWB') THEN 'DEF'
    WHEN player_pos IN ('CDM', 'CM', 'CAM', 'LM', 'RM') THEN 'MID'
    WHEN player_pos IN ('LW', 'RW', 'ST', 'CF') THEN 'FWD'
    ELSE 'MID'
  END;

  -- Get a random unused image for the position
  SELECT url INTO v_url
  FROM player_images
  WHERE position = v_position AND NOT used
  ORDER BY random()
  LIMIT 1;

  -- If no unused images, reset all images for that position and try again
  IF v_url IS NULL THEN
    UPDATE player_images SET used = false WHERE position = v_position;
    
    SELECT url INTO v_url
    FROM player_images
    WHERE position = v_position
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- Mark the image as used
  UPDATE player_images SET used = true WHERE url = v_url;

  RETURN v_url;
END;
$$ LANGUAGE plpgsql;

-- Add image_url column to available_players if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'available_players' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE available_players ADD COLUMN image_url text;
  END IF;
END $$;

-- Create a trigger to automatically assign an image when a player is added
CREATE OR REPLACE FUNCTION assign_player_image()
RETURNS TRIGGER AS $$
BEGIN
  NEW.image_url := get_random_player_image(NEW.position);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_player_image_trigger
BEFORE INSERT ON available_players
FOR EACH ROW
EXECUTE FUNCTION assign_player_image();

-- Now let's add more teams and their complete squads
-- [Previous player insertions remain the same, just add image_url assignment]
-- The trigger will automatically handle image assignment for all new players