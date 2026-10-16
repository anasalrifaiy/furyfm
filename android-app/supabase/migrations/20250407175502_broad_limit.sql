/*
  # Fix Trade Counter Offer System

  1. Changes
    - Fix the handle_trade_offer function to properly handle counter offers
    - Ensure counter offers are visible to the correct party
    - Fix RLS policies for trade offers
*/

-- Drop existing function
DROP FUNCTION IF EXISTS handle_trade_offer;

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
  v_user_team_id uuid;
  v_is_seller boolean;
BEGIN
  -- Get user's team ID
  SELECT id INTO v_user_team_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;

  -- Get and lock the offer
  SELECT * INTO v_offer
  FROM trade_offers
  WHERE id = p_offer_id
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or already handled';
  END IF;

  -- Determine if the user is the seller or buyer
  v_is_seller := (v_offer.to_team_id = v_user_team_id);
  
  -- Verify the user is authorized to handle this offer
  IF v_is_seller THEN
    -- Seller can only handle offers for their players
    IF v_offer.to_team_id != v_user_team_id THEN
      RAISE EXCEPTION 'Not authorized to handle this trade offer';
    END IF;
  ELSE
    -- Buyer can only handle counter offers
    IF v_offer.from_team_id != v_user_team_id THEN
      RAISE EXCEPTION 'Not authorized to handle this trade offer';
    END IF;
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

-- Drop existing RLS policies for trade_offers
DROP POLICY IF EXISTS "Users can view their trade offers" ON trade_offers;
DROP POLICY IF EXISTS "Users can create trade offers" ON trade_offers;
DROP POLICY IF EXISTS "Users can update their trade offers" ON trade_offers;

-- Create improved RLS policies for trade_offers
CREATE POLICY "Users can view their trade offers"
  ON trade_offers
  FOR SELECT
  TO authenticated
  USING (
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create trade offers"
  ON trade_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their trade offers"
  ON trade_offers
  FOR UPDATE
  TO authenticated
  USING (
    (to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) AND status = 'pending') OR
    (from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) AND status = 'pending')
  )
  WITH CHECK (
    (to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) AND status = 'pending') OR
    (from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) AND status = 'pending')
  );

-- Add comment explaining the changes
COMMENT ON FUNCTION handle_trade_offer IS 'Handles trade offer responses while maintaining original buyer/seller roles and ensuring counter offers are visible to the correct party';