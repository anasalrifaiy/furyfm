/*
  # Fix Friend Request and Trade Offer Systems

  1. Changes
    - Reset friend requests table
    - Reset trade offers table
    - Fix friend request functions
    - Fix trade offer functions to maintain buyer/seller roles
    - Ensure proper notification handling
*/

-- First, disable RLS temporarily
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers DISABLE ROW LEVEL SECURITY;

-- Clear existing data
TRUNCATE friend_requests;
TRUNCATE trade_offers;

-- Re-enable RLS
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "allow_all_friend_requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can view their trade offers" ON trade_offers;
DROP POLICY IF EXISTS "Users can create trade offers" ON trade_offers;
DROP POLICY IF EXISTS "Users can update their trade offers" ON trade_offers;

-- Create simplified RLS policies for friend requests
CREATE POLICY "allow_all_friend_requests" 
  ON friend_requests 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Create RLS policies for trade offers
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

-- Drop existing functions
DROP FUNCTION IF EXISTS send_friend_request;
DROP FUNCTION IF EXISTS handle_friend_request;
DROP FUNCTION IF EXISTS create_trade_offer;
DROP FUNCTION IF EXISTS handle_trade_offer;

-- Create improved send_friend_request function
CREATE OR REPLACE FUNCTION send_friend_request(
  p_receiver_id uuid
) RETURNS void AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_exists boolean;
  v_existing_request record;
BEGIN
  -- Get sender's team ID
  SELECT id INTO v_sender_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;

  -- Check if receiver exists and is not the computer team
  SELECT EXISTS (
    SELECT 1 FROM teams 
    WHERE id = p_receiver_id 
    AND user_id IS NOT NULL
  ) INTO v_receiver_exists;

  IF NOT v_receiver_exists THEN
    RAISE EXCEPTION 'Receiver team not found';
  END IF;

  -- Check if trying to send request to self
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check for existing requests in either direction
  SELECT * INTO v_existing_request
  FROM friend_requests
  WHERE (sender_id = v_sender_id AND receiver_id = p_receiver_id)
     OR (sender_id = p_receiver_id AND receiver_id = v_sender_id);

  IF FOUND THEN
    -- Delete any existing requests regardless of status
    DELETE FROM friend_requests 
    WHERE id = v_existing_request.id;
  END IF;

  -- Insert new friend request
  INSERT INTO friend_requests (
    sender_id,
    receiver_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_sender_id,
    p_receiver_id,
    'pending',
    now(),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved handle_friend_request function
CREATE OR REPLACE FUNCTION handle_friend_request(
  p_request_id uuid,
  p_accept boolean
) RETURNS void AS $$
DECLARE
  v_request record;
  v_team_id uuid;
BEGIN
  -- Get user's team ID
  SELECT id INTO v_team_id
  FROM teams
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You don''t have a team';
  END IF;
  
  -- Get and lock the request
  SELECT * INTO v_request
  FROM friend_requests
  WHERE id = p_request_id
  AND receiver_id = v_team_id
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already handled';
  END IF;

  -- Update request status
  UPDATE friend_requests
  SET 
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
    updated_at = now()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  v_user_team_id uuid;
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

  -- Verify the user is authorized to handle this offer
  IF v_offer.to_team_id != v_user_team_id THEN
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

  -- Get and lock both teams
  -- Buyer is always the from_team (the one making the offer)
  SELECT * INTO v_buyer_team
  FROM teams
  WHERE id = v_offer.from_team_id
  FOR UPDATE;

  -- Seller is always the to_team (the one receiving the offer, player owner)
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
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_sender ON friend_requests(status, sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status_receiver ON friend_requests(status, receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_updated_at ON friend_requests(updated_at);

CREATE INDEX IF NOT EXISTS idx_trade_offers_from_team ON trade_offers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_to_team ON trade_offers(to_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status_from_team ON trade_offers(status, from_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status_to_team ON trade_offers(status, to_team_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_updated_at ON trade_offers(updated_at);

-- Add comments
COMMENT ON TABLE friend_requests IS 'Stores friend requests between teams with simplified access';
COMMENT ON FUNCTION send_friend_request IS 'Sends a friend request with proper validation';
COMMENT ON FUNCTION handle_friend_request IS 'Handles friend request responses';

COMMENT ON FUNCTION create_trade_offer IS 'Creates a trade offer with proper buyer/seller roles';
COMMENT ON FUNCTION handle_trade_offer IS 'Handles trade offer responses while maintaining original buyer/seller roles';