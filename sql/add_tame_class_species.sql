-- Add tame_class and species columns to characters table
-- For use with tames to display power ranking and creature type

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS tame_class TEXT,
ADD COLUMN IF NOT EXISTS species TEXT;

-- Optional: Add comment for documentation
COMMENT ON COLUMN characters.tame_class IS 'Power class for tames (e.g., F, D, C, B, A, S, SS)';
COMMENT ON COLUMN characters.species IS 'Species/creature type for tames (e.g., Wolf, Dragon, Cat)';
