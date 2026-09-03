-- v2 Galaxy: RLS verification harness
--
-- Paste this whole file into the Supabase SQL Editor and run it. It reports
-- PASS/FAIL for each property the v2 RLS policies are supposed to have.
--
-- It is SAFE: everything runs inside a transaction that ends in ROLLBACK, so
-- the two probe systems it creates never persist and no existing row is
-- touched. Re-runnable as often as you like.
--
-- It works by impersonation rather than by needing real logins: `SET ROLE`
-- plus a forged `request.jwt.claims` GUC is exactly what Supabase's own
-- auth.uid() reads, so the policies evaluate the same way they do for a real
-- request. It picks a real GM and a real player out of `profiles`.
--
-- WHAT IT CHECKS
--   1. anon (the public NEXT_PUBLIC_SUPABASE_ANON_KEY role) cannot read systems
--   2. anon cannot read bodies
--   3. a player reads discovered systems only
--   4. a player reads bodies of discovered systems only
--   5. a player cannot INSERT a system
--   6. a player cannot UPDATE a system (including flipping `discovered`)
--   7. a player cannot DELETE a system
--   8. a GM reads both discovered and undiscovered systems
--   9. a GM can write
--
-- Checks 1 and 2 FAIL against v2_001 as originally written and PASS once
-- v2_004_rls_scope_authenticated.sql has been applied.

BEGIN;

DO $$
DECLARE
  gm_id      UUID;
  player_id  UUID;
  sys_open   UUID;   -- discovered = true
  sys_hidden UUID;   -- discovered = false
  n          INT;
  passes     INT := 0;
  failures   INT := 0;


  ok BOOLEAN;
BEGIN
  ---------------------------------------------------------------------------
  -- Find test principals
  ---------------------------------------------------------------------------
  SELECT id INTO gm_id     FROM profiles WHERE role = 'gm'     LIMIT 1;
  SELECT id INTO player_id FROM profiles WHERE role <> 'gm'    LIMIT 1;

  IF gm_id IS NULL THEN
    RAISE EXCEPTION 'No profile with role = ''gm'' exists -- cannot test GM policies.';
  END IF;
  IF player_id IS NULL THEN
    RAISE EXCEPTION 'No profile with role <> ''gm'' exists -- create a player account first.';
  END IF;

  RAISE NOTICE 'GM under test:     %', gm_id;
  RAISE NOTICE 'Player under test: %', player_id;
  RAISE NOTICE '---';

  ---------------------------------------------------------------------------
  -- Seed two probe systems. This runs as the table owner, which bypasses RLS.
  ---------------------------------------------------------------------------
  INSERT INTO v2_star_systems (name, discovered, gm_notes)
  VALUES ('__rls_probe_discovered', true, 'SECRET-DISCOVERED')
  RETURNING id INTO sys_open;

  INSERT INTO v2_star_systems (name, discovered, gm_notes)
  VALUES ('__rls_probe_hidden', false, 'SECRET-HIDDEN')
  RETURNING id INTO sys_hidden;

  INSERT INTO v2_system_bodies (system_id, kind, name, body_class)
  VALUES (sys_open, 'star', '__rls_probe_star_open', 'yellow');

  INSERT INTO v2_system_bodies (system_id, kind, name, body_class)
  VALUES (sys_hidden, 'star', '__rls_probe_star_hidden', 'yellow');

  ---------------------------------------------------------------------------
  -- 1 & 2. anon must see nothing at all
  --
  -- Two different outcomes both count as a pass: zero rows (RLS filtered), or
  -- "permission denied" (no table-level GRANT to anon in the first place).
  -- Which one you get tells you which layer is protecting you.
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;

  BEGIN
    SELECT count(*) INTO n FROM v2_star_systems;
    ok := (n = 0);
    IF ok THEN
      RAISE NOTICE 'PASS  1. anon reads 0 systems (RLS filtered)';
    ELSE
      RAISE WARNING 'FAIL  1. anon reads % system(s) -- PUBLICLY EXPOSED', n;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
    RAISE NOTICE 'PASS  1. anon denied on v2_star_systems (no table GRANT)';
  END;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  BEGIN
    SELECT count(*) INTO n FROM v2_system_bodies;
    ok := (n = 0);
    IF ok THEN
      RAISE NOTICE 'PASS  2. anon reads 0 bodies (RLS filtered)';
    ELSE
      RAISE WARNING 'FAIL  2. anon reads % body/bodies -- PUBLICLY EXPOSED', n;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
    RAISE NOTICE 'PASS  2. anon denied on v2_system_bodies (no table GRANT)';
  END;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  RESET ROLE;

  ---------------------------------------------------------------------------
  -- 3 & 4. player reads discovered only
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', player_id, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM v2_star_systems WHERE id = sys_hidden;
  ok := (n = 0);
  IF ok THEN RAISE NOTICE 'PASS  3a. player cannot see the undiscovered system';
  ELSE RAISE WARNING 'FAIL  3a. player CAN see the undiscovered system'; END IF;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  SELECT count(*) INTO n FROM v2_star_systems WHERE id = sys_open;
  ok := (n = 1);
  IF ok THEN RAISE NOTICE 'PASS  3b. player can see the discovered system';
  ELSE RAISE WARNING 'FAIL  3b. player cannot see the discovered system (player view would be empty)'; END IF;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  SELECT count(*) INTO n FROM v2_system_bodies WHERE system_id = sys_hidden;
  ok := (n = 0);
  IF ok THEN RAISE NOTICE 'PASS  4a. player cannot see bodies of the undiscovered system';
  ELSE RAISE WARNING 'FAIL  4a. player CAN see bodies of the undiscovered system'; END IF;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  SELECT count(*) INTO n FROM v2_system_bodies WHERE system_id = sys_open;
  ok := (n = 1);
  IF ok THEN RAISE NOTICE 'PASS  4b. player can see bodies of the discovered system';
  ELSE RAISE WARNING 'FAIL  4b. player cannot see bodies of the discovered system'; END IF;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  ---------------------------------------------------------------------------
  -- 5-7. player cannot write
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO v2_star_systems (name) VALUES ('__rls_probe_player_insert');
    ok := false;
    RAISE WARNING 'FAIL  5. player CAN insert a system';
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
    RAISE NOTICE 'PASS  5. player insert rejected';
  END;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  -- No UPDATE policy means the row is simply invisible to the UPDATE, so this
  -- reports 0 rows rather than raising. Both mean "not written".
  BEGIN
    UPDATE v2_star_systems SET discovered = true, name = 'pwned' WHERE id = sys_hidden;
    GET DIAGNOSTICS n = ROW_COUNT;
    ok := (n = 0);
    IF ok THEN RAISE NOTICE 'PASS  6. player update affected 0 rows';
    ELSE RAISE WARNING 'FAIL  6. player updated % row(s)', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
    RAISE NOTICE 'PASS  6. player update rejected';
  END;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  BEGIN
    DELETE FROM v2_star_systems WHERE id = sys_open;
    GET DIAGNOSTICS n = ROW_COUNT;
    ok := (n = 0);
    IF ok THEN RAISE NOTICE 'PASS  7. player delete affected 0 rows';
    ELSE RAISE WARNING 'FAIL  7. player deleted % row(s)', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
    RAISE NOTICE 'PASS  7. player delete rejected';
  END;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  RESET ROLE;

  ---------------------------------------------------------------------------
  -- 8 & 9. GM sees everything and can write
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', gm_id, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM v2_star_systems WHERE id IN (sys_open, sys_hidden);
  ok := (n = 2);
  IF ok THEN RAISE NOTICE 'PASS  8. GM sees both the discovered and undiscovered system';
  ELSE RAISE WARNING 'FAIL  8. GM sees % of 2 probe systems -- the builder would be broken', n; END IF;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  BEGIN
    UPDATE v2_star_systems SET description = 'gm write probe' WHERE id = sys_hidden;
    GET DIAGNOSTICS n = ROW_COUNT;
    ok := (n = 1);
    IF ok THEN RAISE NOTICE 'PASS  9. GM write succeeded';
    ELSE RAISE WARNING 'FAIL  9. GM write affected % row(s) -- the builder would be broken', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := false;
    RAISE WARNING 'FAIL  9. GM write rejected -- the builder would be broken';
  END;
  IF ok THEN passes := passes + 1; ELSE failures := failures + 1; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  ---------------------------------------------------------------------------
  RAISE NOTICE '---';
  RAISE NOTICE '% passed, % failed', passes, failures;
  IF failures > 0 THEN
    RAISE NOTICE 'Checks 1-2 failing means v2_004_rls_scope_authenticated.sql has not been applied.';
  END IF;
END $$;

-- Show the policy roles alongside the results. Anything listing {public}
-- instead of {authenticated} is reachable with the public anon key.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'v2_%'
ORDER BY tablename, policyname;

ROLLBACK;
