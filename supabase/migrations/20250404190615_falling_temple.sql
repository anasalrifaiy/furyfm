/*
  # Fix Trade Offer Function

  1. Changes
    - Update create_trade_offer function to allow offers for other teams' players
    - Add proper validation for trade offers
    - Fix error messages
*/

-- Drop existing function
DROP FUNCTION IF EXISTS create_trade_offer;

-- Create improved trade_offer function
CREATE OR REPLACE FUNCTION create_trade_offer(
  p_player_id uuid,
  p_to_team_id uuid,
  p_amount integer
) RETURNS uuid AS $$
DECLARE
  v_from_team_id uuid;
  v_player_team_id uuid;
  v_offer_id uuid;
BEGIN
  -- Get the sender's team ID
  SELECT id INTO v_from_team_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;

  -- Get the player's current team
  SELECT team_id INTO v_player_team_id
  FROM players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Verify player belongs to the team we're making an offer to
  IF v_player_team_id != p_to_team_id THEN
    RAISE EXCEPTION 'Player does not belong to the target team';
  END IF;

  -- Verify we're not making an offer to our own team
  IF v_from_team_id = p_to_team_id THEN
    RAISE EXCEPTION 'Cannot make trade offers to your own team';
  END IF;

  -- Check if there's already a pending offer for this player
  IF EXISTS (
    SELECT 1 FROM trade_offers
    WHERE player_id = p_player_id
    AND from_team_id = v_from_team_id
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending offer for this player';
  END IF;

  -- Create the trade offer
  INSERT INTO trade_offers (
    player_id,
    from_team_id,
    to_team_id,
    amount,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_player_id,
    v_from_team_id,
    p_to_team_id,
    p_amount,
    'pending',
    now(),
    now()
  ) RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION create_trade_offer IS 'Creates a trade offer for a player from another team';