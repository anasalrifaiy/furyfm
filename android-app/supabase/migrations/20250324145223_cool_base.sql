/*
  # Add players from top 5 leagues

  1. Changes
    - Add players from:
      - Premier League
      - La Liga
      - Serie A
      - Bundesliga
      - Ligue 1
    
  2. Player Categories
    - Each player is a "Jr." version
    - Includes current and recent legendary players
    - Balanced distribution across positions and leagues
*/

-- Premier League Players
INSERT INTO available_players (name, position, rating, age, value, nationality)
VALUES
  -- Premier League Goalkeepers
  ('Peter Cech Jr.', 'GK', 88, 21, 45000000, 'Czech Republic'),
  ('David De Gea Jr.', 'GK', 87, 22, 42000000, 'Spain'),
  ('Alisson Jr.', 'GK', 89, 20, 55000000, 'Brazil'),
  
  -- Premier League Defenders
  ('Virgil van Dijk Jr.', 'CB', 90, 21, 75000000, 'Netherlands'),
  ('John Terry Jr.', 'CB', 88, 22, 50000000, 'England'),
  ('Rio Ferdinand Jr.', 'CB', 89, 21, 60000000, 'England'),
  ('Gary Neville Jr.', 'RB', 86, 23, 35000000, 'England'),
  ('Andy Robertson Jr.', 'LB', 88, 22, 45000000, 'Scotland'),
  
  -- Premier League Midfielders
  ('Kevin De Bruyne Jr.', 'CAM', 91, 20, 85000000, 'Belgium'),
  ('Steven Gerrard Jr.', 'CM', 90, 21, 75000000, 'England'),
  ('Frank Lampard Jr.', 'CM', 89, 21, 65000000, 'England'),
  ('N''Golo Kante Jr.', 'CDM', 89, 22, 60000000, 'France'),
  
  -- Premier League Forwards
  ('Thierry Henry Jr.', 'ST', 91, 20, 85000000, 'France'),
  ('Wayne Rooney Jr.', 'ST', 89, 21, 70000000, 'England'),
  ('Mohamed Salah Jr.', 'RW', 90, 21, 80000000, 'Egypt'),

  -- La Liga Players
  -- Goalkeepers
  ('Iker Casillas Jr.', 'GK', 89, 21, 55000000, 'Spain'),
  ('Jan Oblak Jr.', 'GK', 90, 20, 65000000, 'Slovenia'),
  
  -- Defenders
  ('Sergio Ramos Jr.', 'CB', 89, 21, 65000000, 'Spain'),
  ('Gerard Pique Jr.', 'CB', 88, 22, 50000000, 'Spain'),
  ('Dani Carvajal Jr.', 'RB', 87, 22, 45000000, 'Spain'),
  ('Jordi Alba Jr.', 'LB', 88, 21, 50000000, 'Spain'),
  
  -- Midfielders
  ('Luka Modric Jr.', 'CM', 90, 20, 75000000, 'Croatia'),
  ('Xavi Hernandez Jr.', 'CM', 91, 20, 80000000, 'Spain'),
  ('Andres Iniesta Jr.', 'CM', 90, 21, 75000000, 'Spain'),
  
  -- Forwards
  ('Lionel Messi Jr.', 'RW', 94, 19, 120000000, 'Argentina'),
  ('Cristiano Ronaldo Jr.', 'ST', 93, 19, 110000000, 'Portugal'),
  ('Karim Benzema Jr.', 'ST', 90, 21, 75000000, 'France'),

  -- Serie A Players
  -- Goalkeepers
  ('Gianluigi Donnarumma Jr.', 'GK', 89, 20, 60000000, 'Italy'),
  ('Samir Handanovic Jr.', 'GK', 87, 22, 40000000, 'Slovenia'),
  
  -- Defenders
  ('Giorgio Chiellini Jr.', 'CB', 88, 22, 45000000, 'Italy'),
  ('Leonardo Bonucci Jr.', 'CB', 87, 23, 40000000, 'Italy'),
  ('Theo Hernandez Jr.', 'LB', 88, 21, 50000000, 'France'),
  
  -- Midfielders
  ('Pavel Nedved Jr.', 'LM', 89, 21, 65000000, 'Czech Republic'),
  ('Nicolo Barella Jr.', 'CM', 88, 22, 55000000, 'Italy'),
  ('Clarence Seedorf Jr.', 'CM', 89, 21, 65000000, 'Netherlands'),
  
  -- Forwards
  ('Francesco Totti Jr.', 'CF', 90, 20, 75000000, 'Italy'),
  ('Alessandro Del Piero Jr.', 'ST', 89, 21, 65000000, 'Italy'),
  ('Victor Osimhen Jr.', 'ST', 88, 22, 60000000, 'Nigeria'),

  -- Bundesliga Players
  -- Goalkeepers
  ('Manuel Neuer Jr.', 'GK', 90, 20, 70000000, 'Germany'),
  ('Marc-Andre ter Stegen Jr.', 'GK', 89, 21, 60000000, 'Germany'),
  
  -- Defenders
  ('Matthias Sammer Jr.', 'CB', 88, 22, 50000000, 'Germany'),
  ('Joshua Kimmich Jr.', 'RB', 89, 21, 65000000, 'Germany'),
  ('David Alaba Jr.', 'LB', 88, 22, 55000000, 'Austria'),
  
  -- Midfielders
  ('Michael Ballack Jr.', 'CM', 89, 21, 65000000, 'Germany'),
  ('Lothar Matthaus Jr.', 'CDM', 90, 20, 75000000, 'Germany'),
  ('Thomas Muller Jr.', 'CAM', 88, 22, 55000000, 'Germany'),
  
  -- Forwards
  ('Robert Lewandowski Jr.', 'ST', 92, 20, 95000000, 'Poland'),
  ('Erling Haaland Jr.', 'ST', 91, 20, 90000000, 'Norway'),
  ('Marco Reus Jr.', 'CAM', 88, 22, 55000000, 'Germany'),

  -- Ligue 1 Players
  -- Goalkeepers
  ('Fabien Barthez Jr.', 'GK', 87, 22, 40000000, 'France'),
  ('Mike Maignan Jr.', 'GK', 88, 21, 50000000, 'France'),
  
  -- Defenders
  ('Thiago Silva Jr.', 'CB', 88, 22, 50000000, 'Brazil'),
  ('Marquinhos Jr.', 'CB', 89, 21, 65000000, 'Brazil'),
  ('Cafu Jr.', 'RB', 89, 21, 65000000, 'Brazil'),
  
  -- Midfielders
  ('Zinedine Zidane Jr.', 'CAM', 93, 19, 100000000, 'France'),
  ('Claude Makelele Jr.', 'CDM', 89, 21, 65000000, 'France'),
  ('Kylian Mbappe Jr.', 'RW', 92, 19, 100000000, 'France'),
  
  -- Forwards
  ('George Weah Jr.', 'ST', 89, 21, 65000000, 'Liberia'),
  ('Zlatan Ibrahimovic Jr.', 'ST', 89, 21, 65000000, 'Sweden'),
  ('Neymar Jr. Jr.', 'LW', 91, 20, 85000000, 'Brazil');