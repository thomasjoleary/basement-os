-- Complete Row Level Security Setup for Basement OS
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read all profiles (for username lookups, party members, etc.)
CREATE POLICY "Anyone can read profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- ============================================
-- 2. CHARACTERS TABLE
-- ============================================
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- GMs can do everything with characters
CREATE POLICY "GMs have full access to characters"
ON characters FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can read all characters (to see party members, NPCs, etc.)
CREATE POLICY "Players can read all characters"
ON characters FOR SELECT
TO authenticated
USING (true);

-- Players can update their own characters
CREATE POLICY "Players can update own characters"
ON characters FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- 3. NOTES TABLE (The Wiki)
-- ============================================
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- GMs can do everything
CREATE POLICY "GMs have full access to notes"
ON notes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can only read notes they have access to
CREATE POLICY "Players can read accessible notes"
ON notes FOR SELECT
TO authenticated
USING (
  is_public = true
  OR
  EXISTS (
    SELECT 1 FROM unlocks
    WHERE unlocks.user_id = auth.uid()
    AND unlocks.note_id = notes.id
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players CANNOT insert, update, or delete notes
-- (No policy = denied by default)

-- ============================================
-- 4. UNLOCKS TABLE
-- ============================================
ALTER TABLE unlocks ENABLE ROW LEVEL SECURITY;

-- GMs can manage all unlocks
CREATE POLICY "GMs can manage all unlocks"
ON unlocks FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can read their own unlocks
CREATE POLICY "Players can read own unlocks"
ON unlocks FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Players CANNOT insert or delete unlocks
-- (Only GMs can grant/revoke knowledge)
