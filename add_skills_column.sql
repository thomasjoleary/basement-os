-- Add skills column to existing characters table
-- Run this in Supabase SQL Editor if the column doesn't exist yet

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'skills'
    ) THEN
        ALTER TABLE characters 
        ADD COLUMN skills jsonb DEFAULT '[]'::jsonb;
        
        RAISE NOTICE 'Column skills added successfully';
    ELSE
        RAISE NOTICE 'Column skills already exists';
    END IF;
END $$;
