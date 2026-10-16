/*
  # Add All Players from Top 5 Leagues

  1. Changes
    - Add complete squads from top teams in:
      - Premier League
      - La Liga
      - Serie A
      - Bundesliga
      - Ligue 1
    - Use realistic ratings and values
    - Keep position-based profile pictures
*/

-- First, clear the available_players table
TRUNCATE available_players;

-- Insert players from top leagues
INSERT INTO available_players (name, position, rating, age, value, nationality) VALUES
  -- Manchester City
  ('Ederson', 'GK', 88, 30, 45000000, 'Brazil'),
  ('Kyle Walker', 'RB', 84, 33, 25000000, 'England'),
  ('Ruben Dias', 'CB', 87, 26, 80000000, 'Portugal'),
  ('John Stones', 'CB', 85, 29, 45000000, 'England'),
  ('Josko Gvardiol', 'CB', 84, 21, 75000000, 'Croatia'),
  ('Rodri', 'CDM', 89, 27, 110000000, 'Spain'),
  ('Kevin De Bruyne', 'CAM', 91, 32, 110000000, 'Belgium'),
  ('Bernardo Silva', 'CAM', 88, 29, 80000000, 'Portugal'),
  ('Phil Foden', 'LW', 85, 23, 110000000, 'England'),
  ('Jack Grealish', 'LW', 84, 28, 65000000, 'England'),
  ('Erling Haaland', 'ST', 91, 23, 180000000, 'Norway'),
  ('Julian Alvarez', 'ST', 83, 23, 60000000, 'Argentina'),

  -- Liverpool
  ('Alisson', 'GK', 89, 31, 50000000, 'Brazil'),
  ('Trent Alexander-Arnold', 'RB', 86, 25, 65000000, 'England'),
  ('Virgil van Dijk', 'CB', 89, 32, 75000000, 'Netherlands'),
  ('Ibrahima Konate', 'CB', 83, 24, 45000000, 'France'),
  ('Andy Robertson', 'LB', 85, 29, 45000000, 'Scotland'),
  ('Dominik Szoboszlai', 'CM', 84, 23, 70000000, 'Hungary'),
  ('Alexis Mac Allister', 'CM', 83, 25, 65000000, 'Argentina'),
  ('Mohamed Salah', 'RW', 89, 31, 100000000, 'Egypt'),
  ('Darwin Nunez', 'ST', 82, 24, 65000000, 'Uruguay'),
  ('Luis Diaz', 'LW', 84, 26, 75000000, 'Colombia'),
  ('Diogo Jota', 'ST', 84, 27, 55000000, 'Portugal'),

  -- Arsenal
  ('David Raya', 'GK', 84, 28, 40000000, 'Spain'),
  ('William Saliba', 'CB', 84, 22, 80000000, 'France'),
  ('Gabriel', 'CB', 83, 26, 55000000, 'Brazil'),
  ('Ben White', 'RB', 82, 26, 45000000, 'England'),
  ('Oleksandr Zinchenko', 'LB', 83, 27, 40000000, 'Ukraine'),
  ('Declan Rice', 'CDM', 85, 24, 100000000, 'England'),
  ('Martin Odegaard', 'CAM', 87, 25, 100000000, 'Norway'),
  ('Bukayo Saka', 'RW', 86, 22, 120000000, 'England'),
  ('Gabriel Martinelli', 'LW', 84, 22, 85000000, 'Brazil'),
  ('Gabriel Jesus', 'ST', 84, 26, 75000000, 'Brazil'),
  ('Kai Havertz', 'CAM', 82, 24, 60000000, 'Germany'),

  -- Real Madrid
  ('Thibaut Courtois', 'GK', 90, 31, 60000000, 'Belgium'),
  ('Dani Carvajal', 'RB', 84, 32, 20000000, 'Spain'),
  ('Antonio Rudiger', 'CB', 85, 30, 35000000, 'Germany'),
  ('David Alaba', 'CB', 85, 31, 40000000, 'Austria'),
  ('Ferland Mendy', 'LB', 83, 28, 30000000, 'France'),
  ('Eduardo Camavinga', 'CM', 83, 21, 90000000, 'France'),
  ('Aurelien Tchouameni', 'CDM', 84, 23, 90000000, 'France'),
  ('Luka Modric', 'CM', 87, 38, 10000000, 'Croatia'),
  ('Jude Bellingham', 'CM', 86, 20, 150000000, 'England'),
  ('Vinicius Junior', 'LW', 89, 23, 150000000, 'Brazil'),
  ('Rodrygo', 'RW', 85, 22, 100000000, 'Brazil'),

  -- Barcelona
  ('Marc-Andre ter Stegen', 'GK', 88, 31, 45000000, 'Germany'),
  ('Jules Kounde', 'CB', 85, 25, 60000000, 'France'),
  ('Ronald Araujo', 'CB', 85, 24, 70000000, 'Uruguay'),
  ('Andreas Christensen', 'CB', 83, 27, 40000000, 'Denmark'),
  ('Joao Cancelo', 'RB', 85, 29, 50000000, 'Portugal'),
  ('Frenkie de Jong', 'CM', 87, 26, 100000000, 'Netherlands'),
  ('Pedri', 'CM', 86, 21, 100000000, 'Spain'),
  ('Gavi', 'CM', 83, 19, 90000000, 'Spain'),
  ('Robert Lewandowski', 'ST', 90, 35, 45000000, 'Poland'),
  ('Raphinha', 'RW', 83, 27, 50000000, 'Brazil'),
  ('Joao Felix', 'LW', 83, 24, 65000000, 'Portugal'),

  -- Bayern Munich
  ('Manuel Neuer', 'GK', 87, 37, 15000000, 'Germany'),
  ('Dayot Upamecano', 'CB', 83, 25, 60000000, 'France'),
  ('Matthijs de Ligt', 'CB', 85, 24, 70000000, 'Netherlands'),
  ('Alphonso Davies', 'LB', 85, 23, 70000000, 'Canada'),
  ('Joshua Kimmich', 'CDM', 88, 28, 75000000, 'Germany'),
  ('Leon Goretzka', 'CM', 85, 28, 45000000, 'Germany'),
  ('Leroy Sane', 'RW', 85, 28, 65000000, 'Germany'),
  ('Jamal Musiala', 'CAM', 86, 20, 110000000, 'Germany'),
  ('Kingsley Coman', 'LW', 84, 27, 55000000, 'France'),
  ('Harry Kane', 'ST', 90, 30, 95000000, 'England'),
  ('Thomas Muller', 'CAM', 84, 34, 15000000, 'Germany'),

  -- PSG
  ('Gianluigi Donnarumma', 'GK', 88, 24, 55000000, 'Italy'),
  ('Achraf Hakimi', 'RB', 84, 25, 65000000, 'Morocco'),
  ('Marquinhos', 'CB', 87, 29, 60000000, 'Brazil'),
  ('Milan Skriniar', 'CB', 85, 28, 45000000, 'Slovakia'),
  ('Lucas Hernandez', 'CB', 84, 27, 45000000, 'France'),
  ('Warren Zaire-Emery', 'CM', 78, 17, 40000000, 'France'),
  ('Vitinha', 'CM', 82, 23, 45000000, 'Portugal'),
  ('Kylian Mbappe', 'ST', 91, 25, 180000000, 'France'),
  ('Ousmane Dembele', 'RW', 86, 26, 60000000, 'France'),
  ('Bradley Barcola', 'LW', 77, 21, 35000000, 'France'),
  ('Randal Kolo Muani', 'ST', 82, 25, 45000000, 'France'),

  -- Inter Milan
  ('Yann Sommer', 'GK', 84, 35, 5000000, 'Switzerland'),
  ('Benjamin Pavard', 'CB', 83, 27, 35000000, 'France'),
  ('Francesco Acerbi', 'CB', 82, 35, 5000000, 'Italy'),
  ('Alessandro Bastoni', 'CB', 85, 24, 60000000, 'Italy'),
  ('Federico Dimarco', 'LWB', 83, 26, 45000000, 'Italy'),
  ('Nicolo Barella', 'CM', 86, 27, 75000000, 'Italy'),
  ('Hakan Calhanoglu', 'CM', 84, 29, 35000000, 'Turkey'),
  ('Henrikh Mkhitaryan', 'CAM', 81, 34, 8000000, 'Armenia'),
  ('Marcus Thuram', 'ST', 83, 26, 45000000, 'France'),
  ('Lautaro Martinez', 'ST', 87, 26, 110000000, 'Argentina'),
  ('Marko Arnautovic', 'ST', 79, 34, 5000000, 'Austria'),

  -- Atletico Madrid
  ('Jan Oblak', 'GK', 88, 30, 45000000, 'Slovenia'),
  ('Nahuel Molina', 'RB', 82, 25, 35000000, 'Argentina'),
  ('Jose Maria Gimenez', 'CB', 84, 28, 40000000, 'Uruguay'),
  ('Mario Hermoso', 'CB', 82, 28, 25000000, 'Spain'),
  ('Samuel Lino', 'LM', 80, 24, 30000000, 'Brazil'),
  ('Marcos Llorente', 'CM', 83, 28, 40000000, 'Spain'),
  ('Rodrigo De Paul', 'CM', 83, 29, 35000000, 'Argentina'),
  ('Koke', 'CM', 83, 32, 15000000, 'Spain'),
  ('Antoine Griezmann', 'CF', 88, 32, 35000000, 'France'),
  ('Alvaro Morata', 'ST', 83, 31, 25000000, 'Spain'),
  ('Memphis Depay', 'ST', 82, 29, 20000000, 'Netherlands'),

  -- AC Milan
  ('Mike Maignan', 'GK', 87, 28, 45000000, 'France'),
  ('Davide Calabria', 'RB', 81, 27, 25000000, 'Italy'),
  ('Fikayo Tomori', 'CB', 83, 25, 50000000, 'England'),
  ('Malick Thiaw', 'CB', 78, 22, 30000000, 'Germany'),
  ('Theo Hernandez', 'LB', 85, 26, 60000000, 'France'),
  ('Ismael Bennacer', 'CM', 83, 26, 40000000, 'Algeria'),
  ('Ruben Loftus-Cheek', 'CM', 80, 27, 25000000, 'England'),
  ('Christian Pulisic', 'RW', 82, 25, 35000000, 'United States'),
  ('Rafael Leao', 'LW', 86, 24, 90000000, 'Portugal'),
  ('Olivier Giroud', 'ST', 82, 37, 5000000, 'France'),
  ('Noah Okafor', 'ST', 78, 23, 25000000, 'Switzerland');

-- Update the getPlayerImage function to return position-specific images
CREATE OR REPLACE FUNCTION get_player_image(player_pos text)
RETURNS text AS $$
BEGIN
  CASE player_pos
    WHEN 'GK' THEN
      RETURN 'https://images.unsplash.com/photo-1628891890467-b79de80b8c1f?w=300';
    WHEN 'CB', 'LB', 'RB', 'LWB', 'RWB' THEN
      RETURN 'https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?w=300';
    WHEN 'CDM', 'CM' THEN
      RETURN 'https://images.unsplash.com/photo-1631495634750-0c507026b3c8?w=300';
    WHEN 'CAM', 'LW', 'RW', 'LM', 'RM' THEN
      RETURN 'https://images.unsplash.com/photo-1605129742404-a1bfa891b4ea?w=300';
    WHEN 'ST', 'CF' THEN
      RETURN 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=300';
    ELSE
      RETURN 'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=300';
  END CASE;
END;
$$ LANGUAGE plpgsql;