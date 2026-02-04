-- ============================================
-- WORDS OF POWER FEATURE
-- ============================================
-- This adds a global spell library with character-word relationships

-- 1. Create words_of_power table (global spell list)
CREATE TABLE IF NOT EXISTS words_of_power (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  meaning TEXT NOT NULL,
  mana_cost INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create character_words join table (who knows what)
CREATE TABLE IF NOT EXISTS character_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  word_id UUID REFERENCES words_of_power(id) ON DELETE CASCADE,
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(character_id, word_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Words of Power Table
ALTER TABLE words_of_power ENABLE ROW LEVEL SECURITY;

-- GMs can do everything
CREATE POLICY "GMs have full access to words_of_power"
ON words_of_power FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can only read words
CREATE POLICY "Players can read words_of_power"
ON words_of_power FOR SELECT
TO authenticated
USING (true);

-- Character Words Table
ALTER TABLE character_words ENABLE ROW LEVEL SECURITY;

-- GMs can do everything
CREATE POLICY "GMs have full access to character_words"
ON character_words FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'gm'
  )
);

-- Players can only read their own character's words
CREATE POLICY "Players can read own character words"
ON character_words FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM characters
    WHERE characters.id = character_words.character_id
    AND characters.user_id = auth.uid()
  )
);

-- ============================================
-- MIGRATION HELPER (Optional)
-- ============================================
-- If you want to migrate existing words from character.words JSONB to the new tables,
-- you can run this after creating the tables (modify as needed for your data)

-- Example migration (uncomment and adjust if needed):
-- INSERT INTO words_of_power (word, meaning, mana_cost)
-- SELECT DISTINCT
--   (word->>'name')::TEXT as word,
--   (word->>'meaning')::TEXT as meaning,
--   COALESCE((word->>'mana_cost')::INTEGER, 0) as mana_cost
-- FROM characters, jsonb_array_elements(words) as word
-- WHERE words IS NOT NULL
-- ON CONFLICT (word) DO NOTHING;
