-- STRICT GM-ONLY EDIT PERMISSIONS
-- Players can ONLY read. GMs can do everything.

-- First, drop the problematic policy that lets players edit their own characters
DROP POLICY IF EXISTS "Players can update own characters" ON characters;

-- ============================================
-- CHARACTERS TABLE - GM-ONLY EDITING
-- ============================================

-- Remove ALL existing policies on characters and rebuild from scratch
DROP POLICY IF EXISTS "GMs have full access to characters" ON characters;
DROP POLICY IF EXISTS "Players can read all characters" ON characters;
DROP POLICY IF EXISTS "Players can update own characters" ON characters;

-- Re-enable RLS (in case it was disabled)
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- GMs can do EVERYTHING
CREATE POLICY "GMs have full access to characters"
ON characters FOR ALL
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

-- Players can ONLY READ (no insert, update, or delete)
CREATE POLICY "Players can only read characters"
ON characters FOR SELECT
TO authenticated
USING (true);

-- No other policies = players cannot INSERT, UPDATE, or DELETE
