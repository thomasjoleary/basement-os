-- Fog of War Tables
-- Run this in Supabase SQL Editor

-- Per-character fog polygon (defines what area of the map they can see)
CREATE TABLE IF NOT EXISTS player_fog_polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to character (main characters only, not tames/NPCs)
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  
  -- Polygon as array of [x, y] points (0-1 normalized coordinates)
  -- Example: [[0.1, 0.2], [0.5, 0.2], [0.5, 0.8], [0.1, 0.8]]
  -- Empty array = no visibility (full fog)
  -- Can have multiple separate polygons for disconnected areas
  polygon JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One polygon per character
  UNIQUE(character_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fog_character ON player_fog_polygons(character_id);

-- Enable RLS
ALTER TABLE player_fog_polygons ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- GMs can view all fog polygons
CREATE POLICY "GMs can view all fog polygons" ON player_fog_polygons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Players can view only their own character's fog polygon
CREATE POLICY "Players can view own fog polygon" ON player_fog_polygons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = player_fog_polygons.character_id
      AND characters.user_id = auth.uid()
    )
  );

-- GMs can insert fog polygons
CREATE POLICY "GMs can create fog polygons" ON player_fog_polygons
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can update fog polygons
CREATE POLICY "GMs can update fog polygons" ON player_fog_polygons
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can delete fog polygons
CREATE POLICY "GMs can delete fog polygons" ON player_fog_polygons
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_fog_polygons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fog_polygons_updated_at
  BEFORE UPDATE ON player_fog_polygons
  FOR EACH ROW
  EXECUTE FUNCTION update_fog_polygons_updated_at();

-- Enable realtime for fog polygons (so changes sync immediately)
ALTER PUBLICATION supabase_realtime ADD TABLE player_fog_polygons;
