-- Emergency reversal only, after explicit review. This reopens pre-approval
-- access for pending accounts and restores the previous realtime publication.
-- Deploy the previous UI alongside rollback. Does not restore deleted users.
BEGIN;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname,tablename,policyname FROM pg_policies
    WHERE policyname IN ('registration_campaign_gate','registration_profile_gate',
      'registration_storage_gate','registration_realtime_gate',
      'registration_receive_broadcast','registration_send_ping')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I',r.policyname,r.schemaname,r.tablename); END LOOP;
END $$;
DROP TRIGGER IF EXISTS registration_pending_profile ON public.profiles;
DROP FUNCTION public.campaign_access_status();
DROP FUNCTION public.list_registration_requests();
DROP FUNCTION public.approve_registration(uuid);
DROP FUNCTION public.get_player_battlefield(uuid);
ALTER FUNCTION registration_private.get_player_battlefield(uuid) SET SCHEMA public;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT restore_sql FROM registration_private.rollback_steps ORDER BY name
  LOOP IF r.restore_sql<>'' THEN EXECUTE r.restore_sql; END IF; END LOOP;
END $$;
DROP FUNCTION registration_private.has_campaign_access();
DROP FUNCTION registration_private.is_approved_gm();
DROP FUNCTION registration_private.pending_profile();
ALTER TABLE public.profiles DROP COLUMN approval_status, DROP COLUMN approved_at, DROP COLUMN approved_by;
DROP TABLE registration_private.rollback_steps;
DROP SCHEMA registration_private;
NOTIFY pgrst, 'reload schema';
COMMIT;
