/*
  # Add initial data for testing

  1. Insert test data
    - Add sample players
    - Set up initial match history
*/

-- Insert sample players for testing
INSERT INTO players (name, position, rating, age, value)
VALUES
  ('Marcus Striker', 'ST', 85, 24, 65000000),
  ('James Midfielder', 'CM', 82, 26, 45000000),
  ('David Defender', 'CB', 80, 28, 35000000),
  ('Peter Keeper', 'GK', 83, 29, 40000000),
  ('Tom Winger', 'RW', 81, 22, 38000000),
  ('Sam Fullback', 'LB', 79, 25, 28000000),
  ('Mike Central', 'CDM', 84, 27, 50000000),
  ('Chris Forward', 'CF', 83, 23, 48000000),
  ('Alex Back', 'RB', 78, 24, 25000000),
  ('George Mid', 'CAM', 82, 25, 42000000);

-- Note: Team assignments and matches will be handled through the application
-- as users create their teams and play matches