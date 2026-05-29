-- Allow all authenticated users to read all character_words rows.
-- Required for the leaderboard to show word counts for every character,
-- not just the current user's own character.
-- The existing "Players can read own character words" policy remains
-- (multiple permissive policies are OR'd together by Postgres RLS).
CREATE POLICY "Authenticated users can read all character_words"
ON character_words FOR SELECT
TO authenticated
USING (true);
