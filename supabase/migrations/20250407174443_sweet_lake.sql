-- Drop existing functions
DROP FUNCTION IF EXISTS create_trade_offer;
DROP FUNCTION IF EXISTS handle_trade_offer;

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
    from_team_id, -- Buyer
    to_team_id,   -- Seller (player owner)
    amount,
    status,
    negotiation_round,
    created_at,
    updated_at
  ) VALUES (
    p_player_id,
    v_from_team_id,
    p_to_team_id,
    p_amount,
    'pending',
    1,
    now(),
    now()
  ) RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved handle_trade_offer function
CREATE OR REPLACE FUNCTION handle_trade_offer(
  p_offer_id uuid,
  p_accept boolean,
  p_counter_amount integer DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_offer record;
  v_player record;
  v_buyer_team record;
  v_seller_team record;
  v_new_offer_id uuid;
BEGIN
  -- Get and lock the offer
  SELECT * INTO v_offer
  FROM trade_offers
  WHERE id = p_offer_id
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or already handled';
  END IF;

  -- Get player information
  SELECT * INTO v_player
  FROM players
  WHERE id = v_offer.player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Get and lock both teams
  -- Buyer is always the original from_team
  SELECT * INTO v_buyer_team
  FROM teams
  WHERE id = v_offer.from_team_id
  FOR UPDATE;

  -- Seller is always the original to_team (player owner)
  SELECT * INTO v_seller_team
  FROM teams
  WHERE id = v_offer.to_team_id
  FOR UPDATE;

  IF p_accept THEN
    -- Check buyer's budget
    IF v_buyer_team.budget < v_offer.amount THEN
      RAISE EXCEPTION 'Buyer has insufficient funds';
    END IF;

    -- Transfer the money
    UPDATE teams
    SET budget = budget - v_offer.amount
    WHERE id = v_buyer_team.id;

    UPDATE teams
    SET budget = budget + v_offer.amount
    WHERE id = v_seller_team.id;

    -- Transfer the player
    UPDATE players
    SET 
      team_id = v_buyer_team.id,
      position_id = NULL -- Reset position in new team
    WHERE id = v_offer.player_id;

    -- Record transfer in history
    INSERT INTO transfer_history (
      player_id,
      from_team_id,
      to_team_id,
      amount,
      completed_at,
      source_table
    ) VALUES (
      v_offer.player_id,
      v_seller_team.id,
      v_buyer_team.id,
      v_offer.amount,
      now(),
      'trade_offers'
    );

    -- Update offer status
    UPDATE trade_offers
    SET 
      status = 'accepted',
      updated_at = now()
    WHERE id = p_offer_id;

  ELSE
    IF p_counter_amount IS NOT NULL THEN
      -- Validate counter amount
      IF p_counter_amount <= 0 THEN
        RAISE EXCEPTION 'Counter amount must be positive';
      END IF;

      -- Update current offer with counter
      UPDATE trade_offers
      SET 
        status = 'countered',
        counter_amount = p_counter_amount,
        negotiation_round = COALESCE(negotiation_round, 1) + 1,
        updated_at = now()
      WHERE id = p_offer_id;

      -- Create new offer with same buyer/seller roles but updated amount
      -- IMPORTANT: Keep the original from_team_id as buyer and to_team_id as seller
      INSERT INTO trade_offers (
        player_id,
        from_team_id,    -- Keep original buyer
        to_team_id,      -- Keep original seller
        amount,
        status,
        negotiation_round,
        created_at,
        updated_at
      ) VALUES (
        v_offer.player_id,
        v_offer.from_team_id,  -- Original buyer stays the buyer
        v_offer.to_team_id,    -- Original seller stays the seller
        p_counter_amount,
        'pending',
        COALESCE(v_offer.negotiation_round, 1) + 1,
        now(),
        now()
      ) RETURNING id INTO v_new_offer_id;

    ELSE
      -- Reject the offer
      UPDATE trade_offers
      SET 
        status = 'rejected',
        updated_at = now()
      WHERE id = p_offer_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trade_offers_from_team ON trade_offers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_to_team ON trade_offers(to_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status_from_team ON trade_offers(status, from_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status_to_team ON trade_offers(status, to_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_updated_at ON trade_offers(updated_at);

-- Add comments
COMMENT ON FUNCTION create_trade_offer IS 'Creates a trade offer with proper buyer/seller roles';
COMMENT ON FUNCTION handle_trade_offer IS 'Handles trade offer responses while maintaining original buyer/seller roles';