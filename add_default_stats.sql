-- Add default stats (strength, speed, fortitude, magic) to all existing characters
-- Run this in Supabase SQL Editor

UPDATE characters
SET stats = jsonb_build_object(
    'strength', COALESCE((stats->>'strength')::int, 0),
    'speed', COALESCE((stats->>'speed')::int, 0),
    'fortitude', COALESCE((stats->>'fortitude')::int, 0),
    'magic', COALESCE((stats->>'magic')::int, 0)
) || COALESCE(stats, '{}'::jsonb)
WHERE stats IS NULL 
   OR NOT (stats ? 'strength' AND stats ? 'speed' AND stats ? 'fortitude' AND stats ? 'magic');

-- This will:
-- 1. Add the four default stats if they don't exist (set to 0)
-- 2. Keep any existing stat values
-- 3. Preserve any custom stats the character already has
