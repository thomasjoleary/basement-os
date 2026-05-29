-- Singleton table (id always = 1) storing which leaderboard categories
-- are currently visible to players and when that visibility expires.
CREATE TABLE IF NOT EXISTS published_leaderboard (
    id          int PRIMARY KEY,
    categories  text[]      NOT NULL DEFAULT '{}',
    expires_at  timestamptz,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE published_leaderboard ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "authenticated_read"
    ON published_leaderboard FOR SELECT
    TO authenticated
    USING (true);

-- Only GMs can insert
CREATE POLICY "gm_insert"
    ON published_leaderboard FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'gm'
    );

-- Only GMs can update
CREATE POLICY "gm_update"
    ON published_leaderboard FOR UPDATE
    TO authenticated
    USING  ((SELECT role FROM profiles WHERE id = auth.uid()) = 'gm')
    WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'gm');

-- Only GMs can delete (used to unpublish)
CREATE POLICY "gm_delete"
    ON published_leaderboard FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'gm'
    );
