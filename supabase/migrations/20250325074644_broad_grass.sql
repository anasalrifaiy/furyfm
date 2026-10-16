/*
  # Update Players Database

  1. Changes
    - Remove "Jr." suffix from player names
    - Add more players from top 5 leagues
    - Implement a consistent profile picture system based on position
    - Update player values and ratings to be more realistic

  2. Details
    - Clear existing players and add new ones
    - Use position-based profile pictures
    - Maintain realistic player statistics
*/

-- First, clear the available_players table
TRUNCATE available_players;

-- Insert players from top leagues
INSERT INTO available_players (name, position, rating, age, value, nationality) VALUES
  -- Premier League Stars
  ('Mohamed Salah', 'RW', 89, 31, 100000000, 'Egypt'),
  ('Kevin De Bruyne', 'CAM', 91, 32, 110000000, 'Belgium'),
  ('Erling Haaland', 'ST', 91, 23, 180000000, 'Norway'),
  ('Bruno Fernandes', 'CAM', 88, 29, 85000000, 'Portugal'),
  ('Virgil van Dijk', 'CB', 89, 32, 75000000, 'Netherlands'),
  ('Rodri', 'CDM', 89, 27, 110000000, 'Spain'),
  ('Bukayo Saka', 'RW', 86, 22, 120000000, 'England'),
  ('Phil Foden', 'CAM', 85, 23, 110000000, 'England'),
  
  -- La Liga Stars
  ('Jude Bellingham', 'CM', 86, 20, 150000000, 'England'),
  ('Robert Lewandowski', 'ST', 90, 35, 45000000, 'Poland'),
  ('Vinicius Junior', 'LW', 89, 23, 150000000, 'Brazil'),
  ('Antoine Griezmann', 'CF', 88, 32, 35000000, 'France'),
  ('Thibaut Courtois', 'GK', 90, 31, 60000000, 'Belgium'),
  ('Pedri', 'CM', 86, 21, 100000000, 'Spain'),
  ('Jan Oblak', 'GK', 88, 30, 45000000, 'Slovenia'),
  
  -- Serie A Stars
  ('Victor Osimhen', 'ST', 88, 25, 120000000, 'Nigeria'),
  ('Rafael Leao', 'LW', 86, 24, 90000000, 'Portugal'),
  ('Lautaro Martinez', 'ST', 87, 26, 110000000, 'Argentina'),
  ('Khvicha Kvaratskhelia', 'LW', 86, 23, 85000000, 'Georgia'),
  ('Federico Chiesa', 'RW', 84, 26, 65000000, 'Italy'),
  ('Mike Maignan', 'GK', 87, 28, 45000000, 'France'),
  ('Nicolo Barella', 'CM', 86, 27, 75000000, 'Italy'),
  
  -- Bundesliga Stars
  ('Harry Kane', 'ST', 90, 30, 95000000, 'England'),
  ('Jamal Musiala', 'CAM', 86, 20, 110000000, 'Germany'),
  ('Florian Wirtz', 'CAM', 85, 20, 85000000, 'Germany'),
  ('Joshua Kimmich', 'CDM', 88, 28, 75000000, 'Germany'),
  ('Leroy Sane', 'RW', 85, 28, 65000000, 'Germany'),
  ('Matthijs de Ligt', 'CB', 85, 24, 70000000, 'Netherlands'),
  
  -- Ligue 1 Stars
  ('Kylian Mbappe', 'ST', 91, 25, 180000000, 'France'),
  ('Ousmane Dembele', 'RW', 86, 26, 60000000, 'France'),
  ('Gianluigi Donnarumma', 'GK', 88, 24, 55000000, 'Italy'),
  ('Lucas Hernandez', 'CB', 84, 27, 45000000, 'France'),
  ('Marquinhos', 'CB', 87, 29, 60000000, 'Brazil');

-- Update the getPlayerImage function to return position-specific images
CREATE OR REPLACE FUNCTION get_player_image(player_pos text)
RETURNS text AS $$
BEGIN
  CASE player_pos
    WHEN 'GK' THEN
      RETURN 'https://images.unsplash.com/photo-1628891890467-b79de80b8c1f?w=300';
    WHEN 'CB', 'LB', 'RB' THEN
      RETURN 'https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?w=300';
    WHEN 'CDM', 'CM' THEN
      RETURN 'https://images.unsplash.com/photo-1631495634750-0c507026b3c8?w=300';
    WHEN 'CAM', 'LW', 'RW' THEN
      RETURN 'https://images.unsplash.com/photo-1605129742404-a1bfa891b4ea?w=300';
    WHEN 'ST', 'CF' THEN
      RETURN 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=300';
    ELSE
      RETURN 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=300';
  END CASE;
END;
$$ LANGUAGE plpgsql;