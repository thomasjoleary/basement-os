-- Add money column to characters table
-- Stores copper, silver, and gold pieces as a JSONB object
-- Exchange rate: 10 copper = 1 silver, 10 silver = 1 gold

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS money JSONB DEFAULT '{"copper": 0, "silver": 0, "gold": 0}'::jsonb;

-- Backfill existing rows with default money values
UPDATE characters
SET money = '{"copper": 0, "silver": 0, "gold": 0}'::jsonb
WHERE money IS NULL;

COMMENT ON COLUMN characters.money IS 'Player currency: copper, silver, gold pieces. 10 copper = 1 silver, 10 silver = 1 gold.';
