-- Map Markers Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS map_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Position (normalized 0-1 coordinates)
  x FLOAT NOT NULL,  -- 0.0 to 1.0 (percentage of map width)
  y FLOAT NOT NULL,  -- 0.0 to 1.0 (percentage of map height)
  
  -- Marker data
  type VARCHAR(50) NOT NULL,  -- 'city', 'town', 'volcano', 'spring', 'dungeon', 'custom', etc.
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),  -- Icon identifier or emoji
  
  -- Visual customization
  color VARCHAR(20),  -- Hex color for marker
  size VARCHAR(20) DEFAULT 'medium',  -- 'small', 'medium', 'large'
  
  -- Wiki integration (nullable - link to wiki page)
  wiki_page_id UUID,  -- Can add FK later when wiki_pages table exists
  
  -- Visibility
  is_visible BOOLEAN DEFAULT true,  -- GM can hide markers
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Original Azgaar data (JSON for flexibility)
  azgaar_data JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_markers_type ON map_markers(type);
CREATE INDEX IF NOT EXISTS idx_markers_visible ON map_markers(is_visible);

-- Enable RLS
ALTER TABLE map_markers ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Everyone can view visible markers
CREATE POLICY "Anyone can view visible markers" ON map_markers
  FOR SELECT
  USING (is_visible = true);

-- GMs can view all markers (including hidden)
CREATE POLICY "GMs can view all markers" ON map_markers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can insert markers
CREATE POLICY "GMs can create markers" ON map_markers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can update markers
CREATE POLICY "GMs can update markers" ON map_markers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can delete markers
CREATE POLICY "GMs can delete markers" ON map_markers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_map_markers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER map_markers_updated_at
  BEFORE UPDATE ON map_markers
  FOR EACH ROW
  EXECUTE FUNCTION update_map_markers_updated_at();
