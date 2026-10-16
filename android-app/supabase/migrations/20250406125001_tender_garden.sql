/*
  # Enable Continuous Trade Negotiations

  1. Changes
    - Update trade_offers table to track negotiation rounds
    - Modify handle_trade_offer function to support counter offers
    - Add proper validation and error handling
*/

-- Add negotiation_round column to trade_offers if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trade_offers' AND column_name = 'negotiation_round'
  ) THEN
    ALTER TABLE trade_offers ADD COLUMN negotiation_round integer DEFAULT 1;
  END IF;
END $$;

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
  v_buyer_budget integer;
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

  -- Verify the user owns the receiving team
  IF NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = v_offer.to_team_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to handle this trade offer';
  END IF;

  -- Get player information
  SELECT * INTO v_player
  FROM players
  WHERE id = v_offer.player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  IF p_accept THEN
    -- Check buyer's budget
    SELECT budget INTO v_buyer_budget
    FROM teams
    WHERE id = v_offer.to_team_id
    FOR UPDATE;

    IF v_buyer_budget < v_offer.amount THEN
      RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- Transfer the player
    UPDATE players
    SET team_id = v_offer.to_team_id
    WHERE id = v_offer.player_id;

    -- Update team budgets
    UPDATE teams
    SET budget = budget - v_offer.amount
    WHERE id = v_offer.to_team_id;

    UPDATE teams
    SET budget = budget + v_offer.amount
    WHERE id = v_offer.from_team_id;

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
      v_offer.from_team_id,
      v_offer.to_team_id,
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

      -- Update offer with counter
      UPDATE trade_offers
      SET 
        status = 'countered',
        counter_amount = p_counter_amount,
        negotiation_round = negotiation_round + 1,
        updated_at = now()
      WHERE id = p_offer_id;

      -- Create new offer with reversed roles and updated amount
      INSERT INTO trade_offers (
        player_id,
        from_team_id,
        to_team_id,
        amount,
        status,
        negotiation_round,
        created_at,
        updated_at
      ) VALUES (
        v_offer.player_id,
        v_offer.to_team_id,
        v_offer.from_team_id,
        p_counter_amount,
        'pending',
        v_offer.negotiation_round + 1,
        now(),
        now()
      );
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

-- Add comment explaining the function
COMMENT ON FUNCTION handle_trade_offer IS 'Handles trade offers with support for continuous negotiation through counter offers';