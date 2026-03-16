-- Migration: Add pending_levelup column for the level-up workflow
-- This column stores the in-progress level-up state as JSON, structured as:
-- {
--   "status": "player_allocating" | "player_submitted",
--   "new_level": 3,
--   "points_total": 45,
--   "stat_deltas": { "strength": 2, "magic": 1 },
--   "mana_gain": 2,
--   "new_skills": [{ "name": "Fireball" }],
--   "skill_level_ups": [0, 1, 0]
-- }

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS pending_levelup JSONB DEFAULT NULL;

-- Allow players to update their own character's row.
-- This is required so players can submit their level-up point allocations.
-- The GM always retains final authority via the review/confirm step.
-- Note: Supabase does not support column-level RLS, so this grants row-level
-- update access; the application only sends pending_levelup in player updates.
CREATE POLICY "Players can update their own character"
  ON characters
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
