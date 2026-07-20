-- Battlefield token presets (GM-only library)
-- Run this in the Supabase SQL Editor after 005_create_battlefields.sql.
--
-- Two flavours of preset live in one table:
--   preset_kind = 'character_default' -- default token look for a specific character/tame
--                                         (one per character, keyed by character_id)
--   preset_kind = 'enemy'             -- reusable enemy token, grouped into folders

CREATE TABLE IF NOT EXISTS battlefield_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  preset_kind TEXT NOT NULL,  -- 'character_default' | 'enemy'

  -- Only set for character_default presets.
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,

  name TEXT NOT NULL DEFAULT '',   -- enemy name / label
  folder TEXT NOT NULL DEFAULT '', -- enemy grouping, e.g. "Goblins"

  width INT NOT NULL DEFAULT 1 CHECK (width BETWEEN 1 AND 100),
  height INT NOT NULL DEFAULT 1 CHECK (height BETWEEN 1 AND 100),
  color TEXT NOT NULL DEFAULT '#ef4444',
  icon TEXT,
  move_ft INT NOT NULL DEFAULT 30,

  -- Enemy stat defaults (null for character defaults, which read live from the sheet).
  hp_max INT,
  mana_max INT,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one default per character.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_character_default
  ON battlefield_presets(character_id)
  WHERE preset_kind = 'character_default';

CREATE INDEX IF NOT EXISTS idx_presets_kind ON battlefield_presets(preset_kind);

DROP TRIGGER IF EXISTS battlefield_presets_updated_at ON battlefield_presets;
CREATE TRIGGER battlefield_presets_updated_at
  BEFORE UPDATE ON battlefield_presets
  FOR EACH ROW EXECUTE FUNCTION set_battlefield_updated_at();

-- RLS: GM only.
ALTER TABLE battlefield_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GMs manage battlefield presets" ON battlefield_presets;
CREATE POLICY "GMs manage battlefield presets" ON battlefield_presets
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

ALTER PUBLICATION supabase_realtime ADD TABLE battlefield_presets;
