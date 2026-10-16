/*
  # Remove automatic player creation and update team creation

  1. Changes
    - Remove createInitialPlayers function
    - Update team creation to start with empty squad
    - Ensure budget is set to 100M
*/

-- Make sure budget is set to 100M for all teams
UPDATE teams SET budget = 100000000;

-- Add comment to explain empty squad setup
COMMENT ON TABLE teams IS 'Teams start with no players and must build their squad through transfers';