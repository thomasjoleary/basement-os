-- Player Marker Visibility Table
-- Tracks which "discovery" markers (volcanoes, hot springs, water sources, dungeons) 
-- each player character has discovered.
-- Cities and towns are auto-visible when within fog polygon.

CREATE TABLE IF NOT EXISTS player_marker_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Which character can see this marker
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  
  -- Which marker they can see
  marker_id UUID NOT NULL REFERENCES map_markers(id) ON DELETE CASCADE,
  
  -- Metadata
  revealed_by UUID REFERENCES profiles(id),  -- Which GM revealed it
  revealed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(character_id, marker_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marker_visibility_character ON player_marker_visibility(character_id);
CREATE INDEX IF NOT EXISTS idx_marker_visibility_marker ON player_marker_visibility(marker_id);

-- Enable RLS
ALTER TABLE player_marker_visibility ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- GMs can view all visibility records
CREATE POLICY "GMs can view all marker visibility" ON player_marker_visibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- Players can view their own visibility records
CREATE POLICY "Players can view own marker visibility" ON player_marker_visibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = player_marker_visibility.character_id
      AND characters.user_id = auth.uid()
    )
  );

-- GMs can grant visibility (insert)
CREATE POLICY "GMs can grant marker visibility" ON player_marker_visibility
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );

-- GMs can revoke visibility (delete)
CREATE POLICY "GMs can revoke marker visibility" ON player_marker_visibility
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'gm'
    )
  );
