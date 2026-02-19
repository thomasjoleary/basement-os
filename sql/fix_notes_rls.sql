-- Fix Row Level Security for the notes table
-- This prevents players from editing/deleting wiki pages

-- 1. Enable RLS on the notes table
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 2. GMs can do everything
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
);

-- 3. Players can only read notes they have access to
CREATE POLICY "Players can read accessible notes"
ON notes
FOR SELECT
TO authenticated
USING (
  -- Public notes
  is_public = true
  OR
  -- Notes they've unlocked
  EXISTS (
    SELECT 1 FROM unlocks
    WHERE unlocks.user_id = auth.uid()
    AND unlocks.note_id = notes.id
  )
  OR
  -- GMs can read everything (covered by policy above, but being explicit)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- 4. Block all INSERT/UPDATE/DELETE for non-GMs
-- (The GM policy already covers GMs, so no separate INSERT/UPDATE/DELETE policies needed for players)
