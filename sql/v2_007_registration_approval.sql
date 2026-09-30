-- REVIEW BEFORE APPLICATION. No application startup runs this migration.
-- Existing profiles keep access; future profiles must be approved by a GM.
BEGIN;

CREATE SCHEMA IF NOT EXISTS registration_private;
REVOKE ALL ON SCHEMA registration_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA registration_private TO anon, authenticated;
CREATE TABLE IF NOT EXISTS registration_private.rollback_steps (
  name text PRIMARY KEY, restore_sql text NOT NULL
);
REVOKE ALL ON registration_private.rollback_steps FROM PUBLIC, anon, authenticated;

-- Fail closed if the reviewed inventory changed. Do not silently miss a view,
-- new application table, privileged entry point or publicly readable bucket.
DO $$
DECLARE names text[] := ARRAY[
  'active_travels','battlefield_entities','battlefield_entity_reveals',
  'battlefield_gm_notes','battlefield_presets','battlefield_visibility','battlefields',
  'character_words','characters','map_markers','notes','player_fog_polygons',
  'player_marker_visibility','player_positions','published_leaderboard','unlocks',
  'v2_galaxy_settings','v2_ship_gm_notes','v2_ships','v2_star_systems',
  'v2_system_bodies','words_of_power','profiles'];
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
      AND (c.relname <> ALL(names) OR c.relkind NOT IN ('r','p') OR NOT c.relrowsecurity))
    OR EXISTS (SELECT 1 FROM unnest(names) t WHERE to_regclass('public.' || t) IS NULL)
  THEN RAISE EXCEPTION 'Registration approval inventory changed: review public relations first'; END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE public)
  THEN RAISE EXCEPTION 'Public storage buckets bypass approval: review before applying'; END IF;
  IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
  THEN RAISE EXCEPTION 'Client CREATE in public must be reviewed before locking function search paths'; END IF;
  FOR r IN SELECT p.oid::regprocedure::text AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
      AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
      AND p.proname NOT IN ('get_player_battlefield','bf_can_see_vitals',
        'campaign_access_status','list_registration_requests','approve_registration')
  LOOP RAISE EXCEPTION 'Unreviewed privileged RPC: %', r.signature; END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
  THEN RAISE EXCEPTION 'Expected supabase_realtime publication missing'; END IF;
END $$;

-- Owner-only rollback metadata contains schema/privileges, never account data.
DO $$
DECLARE r record; statement text; signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.handle_new_user()',
    'public.get_player_battlefield(uuid)','public.bf_can_see_vitals(uuid,uuid)']
  LOOP
    SELECT pg_get_functiondef(signature::regprocedure) INTO statement;
    statement := statement || format('; REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;',signature);
    FOR r IN SELECT x.*, CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee)) END AS grantee_name
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
      WHERE p.oid=signature::regprocedure
    LOOP statement := statement || format(' GRANT %s ON FUNCTION %s TO %s%s;',r.privilege_type,signature,r.grantee_name,CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END); END LOOP;
    INSERT INTO registration_private.rollback_steps VALUES(signature,statement) ON CONFLICT DO NOTHING;
  END LOOP;
  FOR r IN SELECT c.oid,c.oid::regclass::text AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    SELECT string_agg(format('GRANT %s ON TABLE %s TO %s%s;',a.privilege_type,r.name,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
      CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END),' ')
    INTO statement FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=r.oid;
    INSERT INTO registration_private.rollback_steps VALUES(r.name,coalesce(statement,'')) ON CONFLICT DO NOTHING;
  END LOOP;
  SELECT format('ALTER PUBLICATION supabase_realtime SET (publish=%L);',concat_ws(', ',
    CASE WHEN pubinsert THEN 'insert' END,CASE WHEN pubupdate THEN 'update' END,
    CASE WHEN pubdelete THEN 'delete' END,CASE WHEN pubtruncate THEN 'truncate' END))
  INTO statement FROM pg_publication WHERE pubname='supabase_realtime';
  INSERT INTO registration_private.rollback_steps VALUES('publication',statement) ON CONFLICT DO NOTHING;
END $$;

-- Backfill only on first application. Rerunning never approves pending users.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='approval_status' AND NOT attisdropped) THEN
    ALTER TABLE public.profiles ADD COLUMN approval_status text NOT NULL DEFAULT 'approved'
      CHECK (approval_status IN ('pending','approved'));
    ALTER TABLE public.profiles ADD COLUMN approved_at timestamptz;
    ALTER TABLE public.profiles ADD COLUMN approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    UPDATE public.profiles SET approved_at=now();
  END IF;
END $$;
ALTER TABLE public.profiles ALTER COLUMN approval_status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION registration_private.has_campaign_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND approval_status='approved');
$$;
CREATE OR REPLACE FUNCTION registration_private.is_approved_gm() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND approval_status='approved' AND role='gm');
$$;
REVOKE ALL ON FUNCTION registration_private.has_campaign_access(),registration_private.is_approved_gm() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION registration_private.has_campaign_access(),registration_private.is_approved_gm() TO anon,authenticated;

CREATE OR REPLACE FUNCTION registration_private.pending_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  NEW.role := 'player';
  NEW.approval_status := 'pending'; NEW.approved_at := NULL; NEW.approved_by := NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION registration_private.pending_profile() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS registration_pending_profile ON public.profiles;
CREATE TRIGGER registration_pending_profile BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION registration_private.pending_profile();
-- The existing signup trigger still creates the username/avatar normally.
ALTER FUNCTION public.handle_new_user() SET search_path=public,pg_temp;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(username,avatar_url) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS registration_profile_gate ON public.profiles;
CREATE POLICY registration_profile_gate ON public.profiles AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (registration_private.has_campaign_access() OR id=auth.uid())
  WITH CHECK (registration_private.has_campaign_access() OR id=auth.uid());

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS registration_campaign_gate ON public.%I',r.relname);
    EXECUTE format('CREATE POLICY registration_campaign_gate ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (registration_private.has_campaign_access()) WITH CHECK (registration_private.has_campaign_access())',r.relname);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',r.relname);
    IF current_setting('server_version_num')::int >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON public.%I FROM PUBLIC,anon,authenticated',r.relname);
    END IF;
  END LOOP;
END $$;
DROP POLICY IF EXISTS registration_storage_gate ON storage.objects;
CREATE POLICY registration_storage_gate ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (registration_private.has_campaign_access()) WITH CHECK (registration_private.has_campaign_access());

-- Keep the existing battlefield implementation intact behind a guarded entry.
DO $$ BEGIN
  IF to_regprocedure('registration_private.get_player_battlefield(uuid)') IS NULL THEN
    ALTER FUNCTION public.get_player_battlefield(uuid) SET SCHEMA registration_private;
  END IF;
END $$;
ALTER FUNCTION registration_private.get_player_battlefield(uuid) SET search_path=public,pg_temp;
REVOKE ALL ON FUNCTION registration_private.get_player_battlefield(uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.bf_can_see_vitals(uuid,uuid) SET search_path=public,pg_temp;
REVOKE ALL ON FUNCTION public.bf_can_see_vitals(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_player_battlefield(bf uuid) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT registration_private.has_campaign_access() THEN RAISE EXCEPTION 'GM approval required' USING ERRCODE='42501'; END IF;
  RETURN registration_private.get_player_battlefield(bf);
END $$;
REVOKE ALL ON FUNCTION public.get_player_battlefield(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_battlefield(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.campaign_access_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('status',coalesce((SELECT approval_status FROM public.profiles WHERE id=auth.uid()),'pending'),
    'is_gm',registration_private.is_approved_gm());
$$;
CREATE OR REPLACE FUNCTION public.list_registration_requests()
RETURNS TABLE(id uuid,username text,email text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT registration_private.is_approved_gm() THEN RAISE EXCEPTION 'Approved GM access required' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT p.id,p.username,u.email::text,p.created_at FROM public.profiles p
    JOIN auth.users u ON u.id=p.id WHERE p.approval_status='pending' ORDER BY p.created_at,p.id;
END $$;
CREATE OR REPLACE FUNCTION public.approve_registration(profile_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE updated_id uuid;
BEGIN
  IF NOT registration_private.is_approved_gm() THEN RAISE EXCEPTION 'Approved GM access required' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles SET approval_status='approved',approved_at=now(),approved_by=auth.uid()
    WHERE id=profile_id AND approval_status='pending' RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.campaign_access_status(),public.list_registration_requests(),public.approve_registration(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_access_status(),public.list_registration_requests(),public.approve_registration(uuid) TO authenticated;

-- DELETE/TRUNCATE metadata ignores row RLS in Postgres Changes. Authorized
-- clients refetch periodically for deletions; INSERT/UPDATE remain realtime.
ALTER PUBLICATION supabase_realtime SET (publish='insert, update');
DROP POLICY IF EXISTS registration_realtime_gate ON realtime.messages;
CREATE POLICY registration_realtime_gate ON realtime.messages AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (registration_private.has_campaign_access()) WITH CHECK (registration_private.has_campaign_access());
DROP POLICY IF EXISTS registration_receive_broadcast ON realtime.messages;
CREATE POLICY registration_receive_broadcast ON realtime.messages FOR SELECT TO authenticated
  USING (extension='broadcast' AND registration_private.has_campaign_access());
DROP POLICY IF EXISTS registration_send_ping ON realtime.messages;
CREATE POLICY registration_send_ping ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (extension='broadcast' AND realtime.topic() ~ '^bf-ping-[0-9a-f-]{36}$' AND registration_private.has_campaign_access());

NOTIFY pgrst, 'reload schema';
COMMIT;
