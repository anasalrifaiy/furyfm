/*
  # Football Manager Game Schema

  1. New Tables
    - teams
      - id (uuid, primary key)
      - name (text)
      - rating (integer)
      - budget (integer)
      - user_id (uuid, references auth.users)
      - created_at (timestamp)
    
    - players
      - id (uuid, primary key)
      - name (text)
      - position (text)
      - rating (integer)
      - age (integer)
      - value (integer)
      - team_id (uuid, references teams)
      - created_at (timestamp)
    
    - matches
      - id (uuid, primary key)
      - home_team_id (uuid, references teams)
      - away_team_id (uuid, references teams)
      - home_score (integer)
      - away_score (integer)
      - played_at (timestamp)
      - created_at (timestamp)
    
    - transfers
      - id (uuid, primary key)
      - player_id (uuid, references players)
      - from_team_id (uuid, references teams)
      - to_team_id (uuid, references teams)
      - amount (integer)
      - status (text)
      - created_at (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create teams table
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rating integer DEFAULT 70,
  budget integer DEFAULT 50000000,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own team"
  ON teams FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  rating integer NOT NULL,
  age integer NOT NULL,
  value integer NOT NULL,
  team_id uuid REFERENCES teams,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all players"
  ON players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their team's players"
  ON players FOR ALL
  TO authenticated
  USING (team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()));

-- Create matches table
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id uuid REFERENCES teams NOT NULL,
  away_team_id uuid REFERENCES teams NOT NULL,
  home_score integer,
  away_score integer,
  played_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all matches"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their team's matches"
  ON matches FOR ALL
  TO authenticated
  USING (
    home_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    away_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  )
  WITH CHECK (
    home_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    away_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Create transfers table
CREATE TABLE transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players NOT NULL,
  from_team_id uuid REFERENCES teams,
  to_team_id uuid REFERENCES teams,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all transfers"
  ON transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their team's transfers"
  ON transfers FOR ALL
  TO authenticated
  USING (
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  )
  WITH CHECK (
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );