-- Player Notes System Migration
-- Allows players to create their own wiki notes categorized by character

-- 1. Add new columns to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS character_name TEXT;

-- 2. Set default created_by for existing notes to NULL (GM lore has no specific creator)
-- (No action needed, NULL is default)

-- 3. Drop ALL existing RLS policies on notes table (to ensure clean slate)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'notes') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON notes';
    END LOOP;
END $$;

-- 4. Create new RLS policies

-- GMs have full access to everything
CREATE POLICY "GMs have full access to notes"
ON notes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can SELECT notes they have access to
CREATE POLICY "Players can read accessible notes"
ON notes
FOR SELECT
TO authenticated
USING (
  -- Notes they created
  created_by = auth.uid()
  OR
  -- Public notes from anyone
  is_public = true
  OR
  -- GM lore they've unlocked
  EXISTS (
    SELECT 1 FROM unlocks
    WHERE unlocks.user_id = auth.uid()
    AND unlocks.note_id = notes.id
  )
  OR
  -- GMs can read everything
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can INSERT their own notes
CREATE POLICY "Players can create their own notes"
ON notes
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  OR
  -- GMs can insert any note
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can UPDATE their own notes
CREATE POLICY "Players can update their own notes"
ON notes
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR
  -- GMs can update any note
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can DELETE their own notes
CREATE POLICY "Players can delete their own notes"
ON notes
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR
  -- GMs can delete any note
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- 5. Create index for faster character_name filtering
CREATE INDEX IF NOT EXISTS idx_notes_character_name ON notes(character_name);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);

-- 6. Verify policies (optional - shows current policies)
-- Run this separately if you want to verify:
-- SELECT schemaname, tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'notes';
