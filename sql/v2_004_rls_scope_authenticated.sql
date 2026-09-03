-- v2 Galaxy: scope the RLS policies to the `authenticated` role
-- Run this in the Supabase SQL Editor, after v2_001_galaxy.sql.
-- Safe to re-run.
--
-- WHY -----------------------------------------------------------------------
--
-- Every policy in v2_001 was created without a TO clause. A policy with no TO
-- clause defaults to TO public, and in Supabase the `public` role grouping
-- includes `anon` -- the role attached to NEXT_PUBLIC_SUPABASE_ANON_KEY, which
-- ships inside the browser bundle of the deployed site and is therefore known
-- to anyone who opens it.
--
-- So this policy from v2_001:
--
--     CREATE POLICY "Players read discovered systems" ON v2_star_systems
--       FOR SELECT USING (discovered = true);
--
-- was never "players read discovered systems". It was "anybody at all reads
-- discovered systems", gm_notes column included, with no login required.
-- Same for the matching policy on v2_system_bodies.
--
-- v2_001's own settings policy gates on `auth.uid() IS NOT NULL`, which does
-- exclude anon; the two content policies just never got the same treatment.
--
-- Many migrations in this repo omit the TO clause, but most do not leak: their
-- USING clause requires auth.uid() to match a profile or character row, and
-- auth.uid() is NULL for anon. A missing TO clause only exposes data when the
-- USING clause never consults auth.uid(). On the live database exactly three
-- policies met that description -- the two fixed here, plus map_markers's
-- "Anyone can view visible markers" (see sql/008_scope_map_markers_read.sql).
--
-- Writes were never exposed: the GM policies match on a profiles row for
-- auth.uid(), and auth.uid() is NULL for anon, so no unauthenticated write
-- could ever pass WITH CHECK. This migration changes read scope only.
--
-- STILL OPEN AFTER THIS -----------------------------------------------------
--
-- gm_notes remains readable by logged-in *players* on discovered systems and
-- their bodies. Policies gate rows, not columns, so this cannot be fixed with
-- a TO clause. The established fix in this repo is the one 007 used for
-- battlefields: move the column into a separate GM-only table
-- (battlefield_gm_notes) so the player-readable row holds no private data.
-- Until that is done, keep genuine secrets out of gm_notes.

-- =========================================================================
-- v2_star_systems
-- =========================================================================
DROP POLICY IF EXISTS "GMs manage star systems" ON v2_star_systems;
CREATE POLICY "GMs manage star systems" ON v2_star_systems
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

DROP POLICY IF EXISTS "Players read discovered systems" ON v2_star_systems;
CREATE POLICY "Players read discovered systems" ON v2_star_systems
  FOR SELECT
  TO authenticated
  USING (discovered = true);

-- =========================================================================
-- v2_system_bodies
-- =========================================================================
DROP POLICY IF EXISTS "GMs manage system bodies" ON v2_system_bodies;
CREATE POLICY "GMs manage system bodies" ON v2_system_bodies
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

DROP POLICY IF EXISTS "Players read bodies of discovered systems" ON v2_system_bodies;
CREATE POLICY "Players read bodies of discovered systems" ON v2_system_bodies
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM v2_star_systems s
    WHERE s.id = v2_system_bodies.system_id AND s.discovered = true
  ));

-- =========================================================================
-- v2_galaxy_settings
--
-- Already excluded anon via auth.uid() IS NOT NULL; the TO clause makes that
-- explicit and consistent with the rest of the schema.
-- =========================================================================
DROP POLICY IF EXISTS "GMs manage galaxy settings" ON v2_galaxy_settings;
CREATE POLICY "GMs manage galaxy settings" ON v2_galaxy_settings
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

DROP POLICY IF EXISTS "Authenticated read galaxy settings" ON v2_galaxy_settings;
CREATE POLICY "Authenticated read galaxy settings" ON v2_galaxy_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =========================================================================
-- Check the result
--
-- Every row should list {authenticated} under roles. A row showing {public}
-- means that policy did not get replaced.
-- =========================================================================
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename LIKE 'v2_%'
-- ORDER BY tablename, policyname;
