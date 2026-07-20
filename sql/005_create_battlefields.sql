-- Battlefield feature (Phase 1: GM-only)
-- Run this in the Supabase SQL Editor.
--
-- Two tables:
--   battlefields          -- one row per tactical map (grid dimensions, background, border, GM notes)
--   battlefield_entities  -- everything placed on a grid: players, tames, enemies, objects, walls, doors
--
-- Phase 1 RLS is GM-only. Player read access + fog-of-war is added in 006_battlefield_visibility.sql.

-- =========================================================================
-- battlefields
-- =========================================================================
CREATE TABLE IF NOT EXISTS battlefields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL DEFAULT 'New Battlefield',

  -- Grid size in 5ft squares
  cols INT NOT NULL DEFAULT 20 CHECK (cols BETWEEN 1 AND 100),
  rows INT NOT NULL DEFAULT 20 CHECK (rows BETWEEN 1 AND 100),

  -- Solid grid background colour (GM changeable). Image backgrounds come later.
  bg_color TEXT NOT NULL DEFAULT '#334155',

  -- 'indoor' | 'outdoor' -- drives the border styling so players know where they can flee
  border_type TEXT NOT NULL DEFAULT 'outdoor',

  -- GM-private free text
  gm_notes TEXT NOT NULL DEFAULT '',

  -- Combat tracker state
  round INT NOT NULL DEFAULT 1,
  turn_entity_id UUID,  -- whose turn it is (references battlefield_entities.id; no FK to avoid a cycle)

  is_archived BOOLEAN NOT NULL DEFAULT false,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- battlefield_entities
-- =========================================================================
CREATE TABLE IF NOT EXISTS battlefield_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battlefield_id UUID NOT NULL REFERENCES battlefields(id) ON DELETE CASCADE,

  -- 'player' | 'tame' | 'enemy' | 'object' | 'wall' | 'door'
  kind TEXT NOT NULL,

  -- For 'player' / 'tame' tokens: link to the characters row so HP/mana stay live.
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,

  -- Display name (enemies/objects). For linked tokens the character name is used, this is a fallback.
  label TEXT DEFAULT '',

  -- Position (top-left square) and footprint, measured in grid squares.
  x INT NOT NULL DEFAULT 0,
  y INT NOT NULL DEFAULT 0,
  width INT NOT NULL DEFAULT 1 CHECK (width BETWEEN 1 AND 100),
  height INT NOT NULL DEFAULT 1 CHECK (height BETWEEN 1 AND 100),

  -- Visuals
  color TEXT DEFAULT '#ef4444',
  icon TEXT,  -- emoji / short glyph

  -- Manual HP/mana (enemies + objects). For linked player/tame tokens these stay null
  -- and the UI reads live values from the characters row instead.
  hp_current INT,
  hp_max INT,
  mana_current INT,
  mana_max INT,

  -- Movement speed in feet, used by the movement-range highlighter.
  move_ft INT NOT NULL DEFAULT 30,

  -- Status conditions: array of condition ids, e.g. ["poisoned","prone"]
  conditions JSONB NOT NULL DEFAULT '[]',

  -- Initiative value (null = not rolled). Turn order is derived by sorting on this.
  initiative INT,

  -- Fog-of-war helper (Phase 2): when true, this entity stays hidden from players even
  -- inside a revealed square until the GM explicitly reveals it to that player.
  hidden_until_revealed BOOLEAN NOT NULL DEFAULT false,

  notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bf_entities_battlefield ON battlefield_entities(battlefield_id);
CREATE INDEX IF NOT EXISTS idx_bf_entities_character ON battlefield_entities(character_id);

-- =========================================================================
-- updated_at triggers
-- =========================================================================
CREATE OR REPLACE FUNCTION set_battlefield_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS battlefields_updated_at ON battlefields;
CREATE TRIGGER battlefields_updated_at
  BEFORE UPDATE ON battlefields
  FOR EACH ROW EXECUTE FUNCTION set_battlefield_updated_at();

DROP TRIGGER IF EXISTS battlefield_entities_updated_at ON battlefield_entities;
CREATE TRIGGER battlefield_entities_updated_at
  BEFORE UPDATE ON battlefield_entities
  FOR EACH ROW EXECUTE FUNCTION set_battlefield_updated_at();

-- =========================================================================
-- RLS -- Phase 1: GM only. Player policies are added in 006_battlefield_visibility.sql.
-- =========================================================================
ALTER TABLE battlefields ENABLE ROW LEVEL SECURITY;
ALTER TABLE battlefield_entities ENABLE ROW LEVEL SECURITY;

-- battlefields: GMs can do everything
DROP POLICY IF EXISTS "GMs manage battlefields" ON battlefields;
CREATE POLICY "GMs manage battlefields" ON battlefields
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

-- battlefield_entities: GMs can do everything
DROP POLICY IF EXISTS "GMs manage battlefield entities" ON battlefield_entities;
CREATE POLICY "GMs manage battlefield entities" ON battlefield_entities
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

-- =========================================================================
-- Realtime
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE battlefields;
ALTER PUBLICATION supabase_realtime ADD TABLE battlefield_entities;
