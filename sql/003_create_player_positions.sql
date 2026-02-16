-- Player Positions Table
-- Tracks current player locations on the map

CREATE TABLE IF NOT EXISTS player_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  
  -- Position (normalized 0-1 coordinates)
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  
  -- Metadata
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional notes
  location_name VARCHAR(255),  -- "Outside Dungeon X"
  notes TEXT,
  
  -- One position per character
  UNIQUE(character_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_positions_character ON player_positions(character_id);

-- Enable RLS
ALTER TABLE player_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- GMs can see all positions
CREATE POLICY "GMs can view all positions" ON player_positions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Players can only see their own character's position
CREATE POLICY "Players can view own position" ON player_positions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = player_positions.character_id
      AND characters.user_id = auth.uid()
    )
  );

-- GMs can insert positions
CREATE POLICY "GMs can create positions" ON player_positions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can update positions
CREATE POLICY "GMs can update positions" ON player_positions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can delete positions
CREATE POLICY "GMs can delete positions" ON player_positions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_player_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER player_positions_updated_at
  BEFORE UPDATE ON player_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_player_positions_updated_at();

-- Enable realtime for positions (so changes sync immediately)
ALTER PUBLICATION supabase_realtime ADD TABLE player_positions;
