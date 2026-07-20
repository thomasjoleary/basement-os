-- Battlefield Phase 2: player visibility & fog of war
-- Run this in the Supabase SQL Editor after 005 and 006.
--
-- Model:
--   battlefield_visibility        -- per (battlefield, player character): granted flag + the squares they can see
--   battlefield_entity_reveals    -- per (battlefield, character, entity): "this player has been shown this hidden token"
--   battlefield_gm_notes          -- private GM notes, moved OFF the battlefields row so players can safely read it
--
-- Players never read battlefield_entities directly. They call get_player_battlefield(), a SECURITY DEFINER
-- function that returns only what they may see and redacts HP/mana of anything they don't own.

-- =========================================================================
-- Relocate GM notes so the battlefields row carries no private data
-- =========================================================================
CREATE TABLE IF NOT EXISTS battlefield_gm_notes (
  battlefield_id UUID PRIMARY KEY REFERENCES battlefields(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing notes, then drop the column from battlefields.
INSERT INTO battlefield_gm_notes (battlefield_id, notes)
  SELECT id, gm_notes FROM battlefields
  ON CONFLICT (battlefield_id) DO NOTHING;

ALTER TABLE battlefields DROP COLUMN IF EXISTS gm_notes;

ALTER TABLE battlefield_gm_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "GMs manage battlefield notes" ON battlefield_gm_notes;
CREATE POLICY "GMs manage battlefield notes" ON battlefield_gm_notes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

-- =========================================================================
-- Visibility grant + visible squares (per player character)
-- =========================================================================
CREATE TABLE IF NOT EXISTS battlefield_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battlefield_id UUID NOT NULL REFERENCES battlefields(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT false,
  visible_cells JSONB NOT NULL DEFAULT '[]',  -- array of "x,y" strings
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (battlefield_id, character_id)
);
CREATE INDEX IF NOT EXISTS idx_bf_vis_battlefield ON battlefield_visibility(battlefield_id);

-- Per-entity per-player reveal (for tokens flagged hidden_until_revealed)
CREATE TABLE IF NOT EXISTS battlefield_entity_reveals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battlefield_id UUID NOT NULL REFERENCES battlefields(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES battlefield_entities(id) ON DELETE CASCADE,
  revealed_by UUID REFERENCES profiles(id),
  revealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_bf_reveals_battlefield ON battlefield_entity_reveals(battlefield_id);

-- =========================================================================
-- Shared vitals-visibility predicate
-- A viewer may see a character's HP/mana iff: they are the GM, they own the
-- character, the character is one of their tames, or it is an NPC in a party
-- one of their characters belongs to.
-- =========================================================================
CREATE OR REPLACE FUNCTION bf_can_see_vitals(target_id UUID, viewer UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM characters t WHERE t.id = target_id AND (
      -- GM
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = viewer AND p.role = 'gm')
      -- own character
      OR t.user_id = viewer
      -- NPC in one of the viewer's parties
      OR (t.is_npc AND t.party IS NOT NULL AND EXISTS (
            SELECT 1 FROM characters me WHERE me.user_id = viewer AND me.party = t.party))
      -- viewer's tame (linked by player_name, or by job starting with the owner's first name)
      OR (t.is_tame AND EXISTS (
            SELECT 1 FROM characters o WHERE o.user_id = viewer AND (
              (t.player_name IS NOT NULL AND t.player_name = o.name)
              OR (t.job IS NOT NULL AND o.name IS NOT NULL AND t.job ILIKE split_part(o.name, ' ', 1) || '%')
            )))
    )
  );
$$;

-- =========================================================================
-- Player read RPC: everything a player may see, with foreign vitals redacted
-- =========================================================================
CREATE OR REPLACE FUNCTION get_player_battlefield(bf UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  viewer UUID := auth.uid();
  vis battlefield_visibility;
  result JSON;
BEGIN
  SELECT bv.* INTO vis
  FROM battlefield_visibility bv
  JOIN characters c ON c.id = bv.character_id
  WHERE bv.battlefield_id = bf AND bv.granted = true AND c.user_id = viewer
  LIMIT 1;

  IF vis.id IS NULL THEN
    RETURN NULL;  -- not shared with this player
  END IF;

  SELECT json_build_object(
    'battlefield', (
      SELECT json_build_object('id', b.id, 'name', b.name, 'cols', b.cols, 'rows', b.rows,
        'bg_color', b.bg_color, 'border_type', b.border_type, 'round', b.round, 'turn_entity_id', b.turn_entity_id)
      FROM battlefields b WHERE b.id = bf
    ),
    'character_id', vis.character_id,
    'visible_cells', vis.visible_cells,
    'entities', COALESCE((
      SELECT json_agg(json_build_object(
        'id', e.id,
        'kind', e.kind,
        'character_id', e.character_id,
        'label', CASE WHEN e.character_id IS NOT NULL
                      THEN COALESCE((SELECT name FROM characters cc WHERE cc.id = e.character_id), e.label)
                      ELSE e.label END,
        'x', e.x, 'y', e.y, 'width', e.width, 'height', e.height,
        'color', e.color, 'icon', e.icon,
        'conditions', e.conditions, 'initiative', e.initiative,
        'move_ft', e.move_ft,
        'hidden_until_revealed', e.hidden_until_revealed,
        'hp_current', CASE WHEN e.character_id IS NOT NULL AND bf_can_see_vitals(e.character_id, viewer)
                           THEN (SELECT hp_current FROM characters cc WHERE cc.id = e.character_id) END,
        'hp_max', CASE WHEN e.character_id IS NOT NULL AND bf_can_see_vitals(e.character_id, viewer)
                       THEN (SELECT hp_max FROM characters cc WHERE cc.id = e.character_id) END,
        'mana_current', CASE WHEN e.character_id IS NOT NULL AND bf_can_see_vitals(e.character_id, viewer)
                             THEN (SELECT mana_current FROM characters cc WHERE cc.id = e.character_id) END,
        'mana_max', CASE WHEN e.character_id IS NOT NULL AND bf_can_see_vitals(e.character_id, viewer)
                         THEN (SELECT mana_max FROM characters cc WHERE cc.id = e.character_id) END
      ))
      FROM battlefield_entities e
      WHERE e.battlefield_id = bf
        -- token overlaps at least one square the player can see
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(vis.visible_cells) AS cell
          WHERE split_part(cell, ',', 1)::int BETWEEN e.x AND e.x + e.width - 1
            AND split_part(cell, ',', 2)::int BETWEEN e.y AND e.y + e.height - 1
        )
        -- not hidden, or explicitly revealed to this player
        AND (e.hidden_until_revealed = false OR EXISTS (
          SELECT 1 FROM battlefield_entity_reveals r
          WHERE r.entity_id = e.id AND r.character_id = vis.character_id
        ))
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_player_battlefield(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bf_can_see_vitals(UUID, UUID) TO authenticated;

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE battlefield_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE battlefield_entity_reveals ENABLE ROW LEVEL SECURITY;

-- GMs fully manage both.
DROP POLICY IF EXISTS "GMs manage visibility" ON battlefield_visibility;
CREATE POLICY "GMs manage visibility" ON battlefield_visibility
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

DROP POLICY IF EXISTS "GMs manage reveals" ON battlefield_entity_reveals;
CREATE POLICY "GMs manage reveals" ON battlefield_entity_reveals
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

-- Players may read their own visibility row (used for the realtime ping + optional client rendering).
DROP POLICY IF EXISTS "Players read own visibility" ON battlefield_visibility;
CREATE POLICY "Players read own visibility" ON battlefield_visibility
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM characters c WHERE c.id = battlefield_visibility.character_id AND c.user_id = auth.uid()));

-- Players may read the battlefields row itself once granted (no private data lives there now).
DROP POLICY IF EXISTS "Players view granted battlefields" ON battlefields;
CREATE POLICY "Players view granted battlefields" ON battlefields
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM battlefield_visibility bv
    JOIN characters c ON c.id = bv.character_id
    WHERE bv.battlefield_id = battlefields.id AND bv.granted = true AND c.user_id = auth.uid()
  ));

-- =========================================================================
-- Realtime ping: touch battlefields.updated_at whenever anything a player
-- might see changes, so subscribed players re-fetch through the RPC.
-- =========================================================================
CREATE OR REPLACE FUNCTION bf_touch_battlefield()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE battlefields SET updated_at = NOW() WHERE id = COALESCE(NEW.battlefield_id, OLD.battlefield_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ping_on_entity ON battlefield_entities;
CREATE TRIGGER ping_on_entity AFTER INSERT OR UPDATE OR DELETE ON battlefield_entities
  FOR EACH ROW EXECUTE FUNCTION bf_touch_battlefield();

DROP TRIGGER IF EXISTS ping_on_visibility ON battlefield_visibility;
CREATE TRIGGER ping_on_visibility AFTER INSERT OR UPDATE OR DELETE ON battlefield_visibility
  FOR EACH ROW EXECUTE FUNCTION bf_touch_battlefield();

DROP TRIGGER IF EXISTS ping_on_reveal ON battlefield_entity_reveals;
CREATE TRIGGER ping_on_reveal AFTER INSERT OR UPDATE OR DELETE ON battlefield_entity_reveals
  FOR EACH ROW EXECUTE FUNCTION bf_touch_battlefield();

ALTER PUBLICATION supabase_realtime ADD TABLE battlefield_visibility;
