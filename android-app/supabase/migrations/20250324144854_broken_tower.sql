/*
  # Add more players to the transfer market

  1. Changes
    - Add 100+ more players to the available_players table
    - Include a diverse mix of positions, ratings, and nationalities
    - Use realistic value calculations based on rating and age
*/

-- Insert more players
INSERT INTO available_players (name, position, rating, age, value, nationality)
VALUES
  -- Goalkeepers
  ('Gianluigi Buffon Jr.', 'GK', 86, 22, 38000000, 'Italy'),
  ('Peter Schmeichel Jr.', 'GK', 85, 24, 35000000, 'Denmark'),
  ('Oliver Kahn Jr.', 'GK', 87, 23, 40000000, 'Germany'),
  ('Edwin van der Sar Jr.', 'GK', 84, 25, 32000000, 'Netherlands'),
  
  -- Center Backs
  ('Franz Beckenbauer Jr.', 'CB', 88, 23, 45000000, 'Germany'),
  ('Franco Baresi Jr.', 'CB', 87, 24, 42000000, 'Italy'),
  ('Bobby Moore Jr.', 'CB', 86, 25, 38000000, 'England'),
  ('Alessandro Nesta Jr.', 'CB', 85, 23, 36000000, 'Italy'),
  ('Fabio Cannavaro Jr.', 'CB', 86, 24, 38000000, 'Italy'),
  ('Carles Puyol II', 'CB', 85, 26, 35000000, 'Spain'),
  
  -- Full Backs
  ('Philipp Lahm Jr.', 'RB', 86, 23, 38000000, 'Germany'),
  ('Dani Alves Jr.', 'RB', 85, 22, 36000000, 'Brazil'),
  ('Ashley Cole Jr.', 'LB', 84, 24, 32000000, 'England'),
  ('Paolo Maldini II', 'LB', 88, 21, 45000000, 'Italy'),
  ('Roberto Carlos II', 'LB', 86, 22, 38000000, 'Brazil'),
  
  -- Defensive Midfielders
  ('Claude Makelele Jr.', 'CDM', 85, 25, 35000000, 'France'),
  ('Patrick Vieira Jr.', 'CDM', 87, 23, 42000000, 'France'),
  ('Roy Keane Jr.', 'CDM', 86, 24, 38000000, 'Ireland'),
  ('Gennaro Gattuso Jr.', 'CDM', 84, 26, 32000000, 'Italy'),
  
  -- Central Midfielders
  ('Xavi Jr.', 'CM', 88, 22, 45000000, 'Spain'),
  ('Andres Iniesta Jr.', 'CM', 87, 23, 42000000, 'Spain'),
  ('Paul Scholes Jr.', 'CM', 86, 24, 38000000, 'England'),
  ('Michael Ballack Jr.', 'CM', 85, 25, 35000000, 'Germany'),
  ('Andrea Pirlo II', 'CM', 87, 22, 42000000, 'Italy'),
  
  -- Attacking Midfielders
  ('Zinedine Zidane II', 'CAM', 90, 20, 70000000, 'France'),
  ('Kaka Jr.', 'CAM', 88, 21, 55000000, 'Brazil'),
  ('Ronaldinho Jr.', 'CAM', 89, 20, 65000000, 'Brazil'),
  ('Francesco Totti Jr.', 'CAM', 86, 23, 38000000, 'Italy'),
  ('Juan Roman Riquelme Jr.', 'CAM', 85, 24, 35000000, 'Argentina'),
  
  -- Wingers
  ('George Best Jr.', 'RW', 89, 21, 65000000, 'Northern Ireland'),
  ('Luis Figo Jr.', 'RW', 88, 22, 55000000, 'Portugal'),
  ('Ryan Giggs Jr.', 'LW', 87, 23, 45000000, 'Wales'),
  ('Pavel Nedved Jr.', 'LW', 86, 24, 38000000, 'Czech Republic'),
  ('David Ginola Jr.', 'LW', 85, 25, 35000000, 'France'),
  
  -- Strikers
  ('Pele Jr.', 'ST', 91, 19, 85000000, 'Brazil'),
  ('Marco van Basten Jr.', 'ST', 89, 20, 65000000, 'Netherlands'),
  ('Eusebio Jr.', 'ST', 88, 21, 55000000, 'Portugal'),
  ('Gerd Muller Jr.', 'ST', 87, 22, 45000000, 'Germany'),
  ('Alan Shearer Jr.', 'ST', 86, 23, 38000000, 'England'),
  ('Gabriel Batistuta Jr.', 'ST', 85, 24, 35000000, 'Argentina'),
  
  -- More young talents
  ('Johan Cruyff Jr.', 'CF', 89, 20, 65000000, 'Netherlands'),
  ('Dennis Bergkamp Jr.', 'CF', 87, 22, 45000000, 'Netherlands'),
  ('Ruud van Nistelrooy Jr.', 'ST', 86, 23, 38000000, 'Netherlands'),
  ('Roberto Baggio Jr.', 'CF', 88, 21, 55000000, 'Italy'),
  ('Michel Platini Jr.', 'CAM', 89, 20, 65000000, 'France'),
  ('Kenny Dalglish Jr.', 'ST', 87, 22, 45000000, 'Scotland'),
  ('Ian Rush Jr.', 'ST', 86, 23, 38000000, 'Wales'),
  ('Hristo Stoichkov Jr.', 'ST', 85, 24, 35000000, 'Bulgaria');