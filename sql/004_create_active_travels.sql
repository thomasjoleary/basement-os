-- Active Travels Table
-- Tracks ongoing character journeys across the map

CREATE TABLE IF NOT EXISTS active_travels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  
  -- Route definition
  waypoints JSONB NOT NULL,  -- Array of {x, y} normalized coordinates
  
  -- Travel parameters
  speed_mph FLOAT NOT NULL,  -- Travel speed in miles per hour
  
  -- Progress tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ,  -- NULL if not paused, timestamp when paused
  current_segment INT NOT NULL DEFAULT 0,  -- Which segment (0-indexed)
  segment_progress FLOAT NOT NULL DEFAULT 0,  -- Progress within segment (0-1)
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'paused', 'completed'
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Only one active travel per character
  UNIQUE(character_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_travels_character ON active_travels(character_id);
CREATE INDEX IF NOT EXISTS idx_travels_status ON active_travels(status);

-- Enable RLS
ALTER TABLE active_travels ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- GMs can view all travels
CREATE POLICY "GMs can view all travels" ON active_travels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Players can view their own character's travel
CREATE POLICY "Players can view own travel" ON active_travels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = active_travels.character_id
      AND characters.user_id = auth.uid()
    )
  );

-- GMs can create travels
CREATE POLICY "GMs can create travels" ON active_travels
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can update travels
CREATE POLICY "GMs can update travels" ON active_travels
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can delete travels
CREATE POLICY "GMs can delete travels" ON active_travels
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_active_travels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER active_travels_updated_at
  BEFORE UPDATE ON active_travels
  FOR EACH ROW
  EXECUTE FUNCTION update_active_travels_updated_at();

-- Enable realtime for travels (so changes sync immediately)
ALTER PUBLICATION supabase_realtime ADD TABLE active_travels;
