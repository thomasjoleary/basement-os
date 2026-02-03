-- Add tame buff system to characters table
-- Run this in Supabase SQL Editor

-- Add is_active field for tames (whether they're currently providing buffs)
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- Add stat_buffs field to store what buffs a tame provides
-- Example: { "strength": 50, "speed": 30 }
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS stat_buffs jsonb DEFAULT '{}'::jsonb;

-- Update comment for clarity
COMMENT ON COLUMN characters.is_active IS 'Whether this tame is actively providing buffs to its owner';
COMMENT ON COLUMN characters.stat_buffs IS 'Stat buffs this tame provides when active, e.g. {"strength": 50, "speed": 30}';
