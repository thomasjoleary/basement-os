BEGIN;
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (username, avatar_url) ON TABLE public.profiles TO authenticated;
COMMIT;
