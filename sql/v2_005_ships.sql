-- Ship authoring. Apply manually after profiles exists; no production writes
-- are part of development. Plans are versioned JSON documents saved atomically.
BEGIN;

CREATE OR REPLACE FUNCTION public.v2_ship_is_gm() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'gm') $$;
REVOKE ALL ON FUNCTION public.v2_ship_is_gm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_ship_is_gm() TO authenticated;

CREATE TABLE IF NOT EXISTS public.v2_ships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 10000),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  crew_ids uuid[] NOT NULL DEFAULT '{}',
  plan jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.v2_ship_gm_notes (
  ship_id uuid PRIMARY KEY REFERENCES public.v2_ships(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 50000)
);

-- Reject malformed geometry/references even when bypassing the UI. Labels and
-- public notes are intentionally player-readable; secrets belong only in the
-- separate notes table. Unknown document keys are rejected.
CREATE OR REPLACE FUNCTION public.v2_ship_check_plan(p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d jsonb; r jsonb; m jsonb; item jsonb; c jsonb; target jsonb; room jsonb;
  ids text[] := '{}'; entity jsonb; width int; height int; pos jsonb; endpoint text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' OR p->>'schema_version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p->'decks') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'parts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'connections') IS DISTINCT FROM 'array'
    OR p - ARRAY['schema_version','decks','parts','connections'] <> '{}'::jsonb
    OR octet_length(p::text) > 2000000 THEN RAISE EXCEPTION 'Invalid ship plan'; END IF;
  IF jsonb_array_length(p->'decks') NOT BETWEEN 1 AND 20 OR jsonb_array_length(p->'parts') > 2000
    OR jsonb_array_length(p->'connections') > 200 THEN RAISE EXCEPTION 'Ship plan exceeds limits'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(p->'decks') LOOP
    width := (d->>'width')::integer; height := (d->>'height')::integer;
    IF width IS NULL OR height IS NULL OR width NOT BETWEEN 4 AND 100 OR height NOT BETWEEN 4 AND 100
      OR coalesce(length(trim(d->>'name')),0) NOT BETWEEN 1 AND 120
      OR jsonb_typeof(d->'rooms') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'marks') IS DISTINCT FROM 'array'
      OR d - ARRAY['id','name','width','height','rooms','marks'] <> '{}'::jsonb
      THEN RAISE EXCEPTION 'Invalid deck'; END IF;
    IF jsonb_array_length(d->'rooms') > 500 OR jsonb_array_length(d->'marks') > 2000 THEN RAISE EXCEPTION 'Deck exceeds limits'; END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(d->'rooms') LOOP
      IF r - ARRAY['id','name','x','y','width','height','notes'] <> '{}'::jsonb
        OR coalesce(length(trim(r->>'name')),0) NOT BETWEEN 1 AND 120
        OR jsonb_typeof(r->'notes') IS DISTINCT FROM 'string'
        OR coalesce((r->>'x')::int, -1) < 0 OR coalesce((r->>'y')::int,-1) < 0
        OR coalesce((r->>'width')::int,0) < 1 OR coalesce((r->>'height')::int,0) < 1
        OR (r->>'x')::int + (r->>'width')::int > width OR (r->>'y')::int + (r->>'height')::int > height
        THEN RAISE EXCEPTION 'Invalid room'; END IF;
    END LOOP;
    FOR m IN SELECT value FROM jsonb_array_elements(d->'marks') LOOP
      IF m - ARRAY['id','kind','name','x','y','length','vertical'] <> '{}'::jsonb
        OR coalesce(m->>'kind','') NOT IN ('wall','door','label')
        OR jsonb_typeof(m->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(m->'vertical') IS DISTINCT FROM 'boolean'
        OR coalesce((m->>'x')::int,-1) NOT BETWEEN 0 AND width-1 OR coalesce((m->>'y')::int,-1) NOT BETWEEN 0 AND height-1
        OR coalesce((m->>'length')::int,0) < 1
        OR (CASE WHEN (m->>'vertical')::boolean THEN (m->>'y')::int + (m->>'length')::int > height ELSE (m->>'x')::int + (m->>'length')::int > width END)
        THEN RAISE EXCEPTION 'Invalid wall, door or label'; END IF;
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'parts') LOOP
    SELECT value INTO target FROM jsonb_array_elements(p->'decks') WHERE value->>'id' = item->>'deck_id';
    IF target IS NULL OR item - ARRAY['id','deck_id','room_id','name','type','x','y','quantity','quality','black_market','condition','notes'] <> '{}'::jsonb
      OR coalesce(length(trim(item->>'name')),0) NOT BETWEEN 1 AND 120 OR coalesce(length(trim(item->>'type')),0) NOT BETWEEN 1 AND 120
      OR coalesce((item->>'x')::int,-1) NOT BETWEEN 0 AND (target->>'width')::int-1
      OR coalesce((item->>'y')::int,-1) NOT BETWEEN 0 AND (target->>'height')::int-1
      OR coalesce((item->>'quantity')::int,0) NOT BETWEEN 1 AND 100000
      OR coalesce(item->>'quality','') NOT IN ('Junk','Secondhand','Store-bought','Outfitted','Specialized','Exotic')
      OR coalesce(item->>'condition','') NOT IN ('Working','Worn','Damaged','Broken')
      OR jsonb_typeof(item->'black_market') IS DISTINCT FROM 'boolean' OR jsonb_typeof(item->'notes') IS DISTINCT FROM 'string'
      THEN RAISE EXCEPTION 'Invalid component'; END IF;
    IF item->>'room_id' IS NOT NULL THEN
      SELECT value INTO room FROM jsonb_array_elements(target->'rooms') WHERE value->>'id' = item->>'room_id';
      IF room IS NULL OR (item->>'x')::int < (room->>'x')::int OR (item->>'y')::int < (room->>'y')::int
        OR (item->>'x')::int >= (room->>'x')::int + (room->>'width')::int OR (item->>'y')::int >= (room->>'y')::int + (room->>'height')::int
        THEN RAISE EXCEPTION 'Component is outside its room'; END IF;
    END IF;
  END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(p->'connections') LOOP
    IF c - ARRAY['id','name','kind','from_deck','from','to_deck','to'] <> '{}'::jsonb
      OR coalesce(length(trim(c->>'name')),0) NOT BETWEEN 1 AND 120 OR coalesce(c->>'kind','') NOT IN ('stairs','lift')
      OR c->>'from_deck' = c->>'to_deck' THEN RAISE EXCEPTION 'Invalid deck connection'; END IF;
    FOREACH endpoint IN ARRAY ARRAY['from','to'] LOOP
      SELECT value INTO target FROM jsonb_array_elements(p->'decks') WHERE value->>'id' = c->>(endpoint || '_deck');
      pos := c->endpoint;
      IF target IS NULL OR pos IS NULL OR pos - ARRAY['x','y'] <> '{}'::jsonb
        OR coalesce((pos->>'x')::int,-1) NOT BETWEEN 0 AND (target->>'width')::int-1
        OR coalesce((pos->>'y')::int,-1) NOT BETWEEN 0 AND (target->>'height')::int-1 THEN RAISE EXCEPTION 'Invalid connection endpoint'; END IF;
    END LOOP;
  END LOOP;
  FOR entity IN
    SELECT value FROM jsonb_array_elements(p->'decks')
    UNION ALL SELECT r.value FROM jsonb_array_elements(p->'decks') d, jsonb_array_elements(d.value->'rooms') r
    UNION ALL SELECT m.value FROM jsonb_array_elements(p->'decks') d, jsonb_array_elements(d.value->'marks') m
    UNION ALL SELECT value FROM jsonb_array_elements(p->'parts')
    UNION ALL SELECT value FROM jsonb_array_elements(p->'connections')
  LOOP
    IF coalesce(length(entity->>'id'),0) NOT BETWEEN 1 AND 100 OR entity->>'id' = ANY(ids) THEN RAISE EXCEPTION 'Duplicate or missing plan ID'; END IF;
    ids := array_append(ids, entity->>'id');
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.v2_ship_check_plan(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_ship_check_plan(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.v2_ship_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.v2_ship_check_plan(NEW.plan);
  IF cardinality(NEW.crew_ids) > 100 OR EXISTS (
    SELECT 1 FROM unnest(NEW.crew_ids) member WHERE member IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = member)
  ) THEN RAISE EXCEPTION 'Crew must be existing profiles (maximum 100)'; END IF;
  NEW.version := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE OLD.version + 1 END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
-- Trigger execution does not require callers to hold EXECUTE on the trigger
-- function; its nested validator does run with the caller's permissions.
REVOKE ALL ON FUNCTION public.v2_ship_before_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS v2_ship_validate ON public.v2_ships;
CREATE TRIGGER v2_ship_validate BEFORE INSERT OR UPDATE ON public.v2_ships FOR EACH ROW EXECUTE FUNCTION public.v2_ship_before_write();

ALTER TABLE public.v2_ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_ship_gm_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "GM manages ships" ON public.v2_ships;
CREATE POLICY "GM manages ships" ON public.v2_ships FOR ALL TO authenticated USING (public.v2_ship_is_gm()) WITH CHECK (public.v2_ship_is_gm());
DROP POLICY IF EXISTS "Assigned players read ships" ON public.v2_ships;
CREATE POLICY "Assigned players read ships" ON public.v2_ships FOR SELECT TO authenticated USING (owner_id = auth.uid() OR auth.uid() = ANY(crew_ids));
DROP POLICY IF EXISTS "GM private ship notes" ON public.v2_ship_gm_notes;
CREATE POLICY "GM private ship notes" ON public.v2_ship_gm_notes FOR ALL TO authenticated USING (public.v2_ship_is_gm()) WITH CHECK (public.v2_ship_is_gm());
-- Clear Supabase's explicit default grants before granting the intended API.
REVOKE ALL ON public.v2_ships, public.v2_ship_gm_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_ships, public.v2_ship_gm_notes TO authenticated;

-- Security invoker: callers retain RLS, and every save additionally requires GM.
-- Lock/version check protects against lost updates; ship + notes commit together.
CREATE OR REPLACE FUNCTION public.v2_save_ship(ship_id uuid, expected_version integer, ship_name text,
  ship_description text, ship_owner uuid, ship_crew uuid[], ship_plan jsonb, private_notes text)
RETURNS public.v2_ships LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_version int; result public.v2_ships;
BEGIN
  IF NOT public.v2_ship_is_gm() THEN RAISE EXCEPTION 'GM access required' USING ERRCODE = '42501'; END IF;
  IF expected_version = 0 THEN
    INSERT INTO public.v2_ships(id,name,description,owner_id,crew_ids,plan)
      VALUES(ship_id,ship_name,ship_description,ship_owner,ship_crew,ship_plan) RETURNING * INTO result;
  ELSE
    SELECT version INTO current_version FROM public.v2_ships WHERE id = ship_id FOR UPDATE;
    IF current_version IS NULL THEN RAISE EXCEPTION 'Ship unavailable'; END IF;
    IF current_version IS DISTINCT FROM expected_version THEN RAISE EXCEPTION 'Ship changed in another session. Reload before saving.' USING ERRCODE = '40001'; END IF;
    UPDATE public.v2_ships SET name=ship_name, description=ship_description, owner_id=ship_owner, crew_ids=ship_crew, plan=ship_plan WHERE id=ship_id RETURNING * INTO result;
  END IF;
  INSERT INTO public.v2_ship_gm_notes(ship_id,notes) VALUES(ship_id,private_notes)
    ON CONFLICT ON CONSTRAINT v2_ship_gm_notes_pkey DO UPDATE SET notes=EXCLUDED.notes;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.v2_save_ship(uuid,integer,text,text,uuid,uuid[],jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_save_ship(uuid,integer,text,text,uuid,uuid[],jsonb,text) TO authenticated;
COMMIT;
