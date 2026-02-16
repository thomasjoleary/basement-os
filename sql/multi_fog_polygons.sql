-- Enable multiple fog polygons per character
-- Remove unique constraint on character_id (if it exists) and add polygon name/label

-- Add label column for naming polygons
ALTER TABLE player_fog_polygons 
ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Area 1';

-- Add is_active column to toggle polygons on/off
ALTER TABLE player_fog_polygons
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Drop unique constraint on character_id if it exists
-- (This allows multiple rows per character)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'player_fog_polygons_character_id_key'
  ) THEN
    ALTER TABLE player_fog_polygons 
    DROP CONSTRAINT player_fog_polygons_character_id_key;
  END IF;
END $$;

-- Create index for faster lookups by character
CREATE INDEX IF NOT EXISTS idx_fog_polygons_character 
ON player_fog_polygons(character_id);

-- Create index for active polygons
CREATE INDEX IF NOT EXISTS idx_fog_polygons_active 
ON player_fog_polygons(character_id, is_active) 
WHERE is_active = true;

COMMENT ON COLUMN player_fog_polygons.label IS 'User-friendly name for this fog polygon (e.g., "Town Square", "Forest Path")';
COMMENT ON COLUMN player_fog_polygons.is_active IS 'Whether this polygon is currently active (visible area)';
