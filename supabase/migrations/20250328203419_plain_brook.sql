/*
  # Add Player Trading System

  1. New Tables
    - `trade_offers`
      - `id` (uuid, primary key)
      - `player_id` (uuid, references players)
      - `from_team_id` (uuid, references teams)
      - `to_team_id` (uuid, references teams)
      - `amount` (integer)
      - `status` (text: pending, accepted, rejected, countered)
      - `counter_amount` (integer, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on trade_offers table
    - Add policies for authenticated users
*/

-- Create trade_offers table
CREATE TABLE trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players NOT NULL,
  from_team_id uuid REFERENCES teams NOT NULL,
  to_team_id uuid REFERENCES teams NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  counter_amount integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_counter_amount CHECK (counter_amount IS NULL OR counter_amount > 0)
);

-- Enable RLS
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  )
  WITH CHECK (
    to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid()) OR
    from_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Function to create a trade offer
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

  -- Verify player belongs to sender's team
  IF v_player_team_id != v_from_team_id THEN
    RAISE EXCEPTION 'You can only trade players from your team';
  END IF;

  -- Create the trade offer
  INSERT INTO trade_offers (
    player_id,
    from_team_id,
    to_team_id,
    amount
  ) VALUES (
    p_player_id,
    v_from_team_id,
    p_to_team_id,
    p_amount
  ) RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle trade offer response
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
  AND to_team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
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
      completed_at
    ) VALUES (
      v_offer.player_id,
      v_offer.from_team_id,
      v_offer.to_team_id,
      v_offer.amount,
      now()
    );

    -- Update offer status
    UPDATE trade_offers
    SET status = 'accepted',
        updated_at = now()
    WHERE id = p_offer_id;
  ELSE
    -- If counter offer provided, update status and amount
    IF p_counter_amount IS NOT NULL THEN
      UPDATE trade_offers
      SET status = 'countered',
          counter_amount = p_counter_amount,
          updated_at = now()
      WHERE id = p_offer_id;
    ELSE
      -- Otherwise reject the offer
      UPDATE trade_offers
      SET status = 'rejected',
          updated_at = now()
      WHERE id = p_offer_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX idx_trade_offers_from_team ON trade_offers(from_team_id);
CREATE INDEX idx_trade_offers_to_team ON trade_offers(to_team_id);
CREATE INDEX idx_trade_offers_status ON trade_offers(status);

-- Add comment explaining the table
COMMENT ON TABLE trade_offers IS 'Stores player trade offers between teams with negotiation support';