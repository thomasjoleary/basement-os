-- Add population column to map_markers for city/town markers
-- Enables population-proportional icon scaling on the map

ALTER TABLE map_markers ADD COLUMN IF NOT EXISTS population integer;
