-- Scope the map_markers public-read policy to authenticated
-- Run this in the Supabase SQL Editor. Safe to re-run.
--
-- WHY -----------------------------------------------------------------------
--
-- "Anyone can view visible markers" was created without a TO clause, so it
-- defaults to TO public, which includes `anon` -- the role behind the public
-- NEXT_PUBLIC_SUPABASE_ANON_KEY that ships in the browser bundle. Its USING
-- clause is `is_visible = true` and never references auth.uid(), so the policy
-- meant what it says literally: *anyone*, logged in or not, could read every
-- visible map marker. Confirmed against the live project -- an unauthenticated
-- PostgREST request returned marker names.
--
-- Most policies in this repo also omit the TO clause but do NOT leak, because
-- their USING clause requires auth.uid() to match a profile or character row,
-- and auth.uid() is NULL for anon. Only a policy whose USING never mentions
-- auth.uid() is actually exposed. Across the live database that was true of
-- exactly three policies: this one, plus the two v2 galaxy ones fixed by
-- v2_004_rls_scope_authenticated.sql.
--
-- To re-check after any future migration, list the anon-reachable read
-- policies that never consult auth.uid() -- the result should be empty:
--
--   SELECT tablename, policyname, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND 'public' = ANY(roles)
--     AND cmd IN ('SELECT', 'ALL')
--     AND (qual IS NULL OR qual NOT LIKE '%uid()%');
--
-- Writes were never exposed: every INSERT/UPDATE/DELETE policy on these tables
-- requires a GM profile row for auth.uid().

DROP POLICY IF EXISTS "Anyone can view visible markers" ON map_markers;
CREATE POLICY "Anyone can view visible markers" ON map_markers
  FOR SELECT
  TO authenticated
  USING (is_visible = true);
