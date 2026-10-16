/*
  # Create player database

  1. New Tables
    - `available_players`
      - `id` (uuid, primary key)
      - `name` (text)
      - `position` (text)
      - `rating` (integer)
      - `age` (integer)
      - `value` (integer)
      - `nationality` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `available_players` table
    - Add policy for authenticated users to read data
*/

-- Create available_players table
CREATE TABLE IF NOT EXISTS available_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  rating integer NOT NULL,
  age integer NOT NULL,
  value integer NOT NULL,
  nationality text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE available_players ENABLE ROW LEVEL SECURITY;

-- Create policy for reading available players
CREATE POLICY "Anyone can read available players"
  ON available_players
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert initial data (sample of players)
INSERT INTO available_players (name, position, rating, age, value, nationality)
VALUES
  -- Goalkeepers
  ('Manuel Neuer Jr.', 'GK', 88, 25, 45000000, 'Germany'),
  ('David Silva Jr.', 'GK', 85, 23, 35000000, 'Spain'),
  
  -- Defenders
  ('Carlos Puyol Jr.', 'CB', 86, 24, 40000000, 'Spain'),
  ('Paolo Maldini Jr.', 'CB', 87, 22, 42000000, 'Italy'),
  ('Roberto Carlos Jr.', 'LB', 85, 23, 38000000, 'Brazil'),
  ('Cafu Jr.', 'RB', 84, 24, 36000000, 'Brazil'),
  
  -- Midfielders
  ('Zinedine Zidane Jr.', 'CAM', 89, 21, 65000000, 'France'),
  ('Andrea Pirlo Jr.', 'CDM', 86, 23, 45000000, 'Italy'),
  ('Frank Lampard Jr.', 'CM', 85, 24, 40000000, 'England'),
  ('Steven Gerrard Jr.', 'CM', 86, 22, 45000000, 'England'),
  
  -- Forwards
  ('Ronaldo Jr.', 'ST', 90, 21, 80000000, 'Brazil'),
  ('Thierry Henry Jr.', 'ST', 88, 23, 70000000, 'France'),
  ('Lionel Messi Jr.', 'RW', 89, 20, 75000000, 'Argentina'),
  ('Cristiano Ronaldo Jr.', 'LW', 89, 20, 75000000, 'Portugal')
  -- Add more players as needed
;