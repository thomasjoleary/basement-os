-- Add optional visual appearance to schema v1; preserve omitted old-client fields.
-- CREATE OR REPLACE retains the existing function ACLs; no grants/RLS change.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.v2_ship_check_plan(jsonb)') IS NULL
    OR to_regprocedure('public.v2_ship_before_write()') IS NULL
    OR to_regclass('public.v2_ships') IS NULL
  THEN RAISE EXCEPTION 'Apply the existing ship schema before appearance'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.v2_ship_check_plan(p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d jsonb; r jsonb; m jsonb; item jsonb; c jsonb; target jsonb; room jsonb;
  ids text[] := '{}'; entity jsonb; width int; height int; pos jsonb; endpoint text; appearance jsonb; pane jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' OR p->>'schema_version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p->'decks') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'parts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'connections') IS DISTINCT FROM 'array'
    OR p - ARRAY['schema_version','decks','parts','connections','appearance'] <> '{}'::jsonb
    OR octet_length(p::text) > 2000000 THEN RAISE EXCEPTION 'Invalid ship plan'; END IF;
  IF jsonb_array_length(p->'decks') NOT BETWEEN 1 AND 20 OR jsonb_array_length(p->'parts') > 2000
    OR jsonb_array_length(p->'connections') > 200 THEN RAISE EXCEPTION 'Ship plan exceeds limits'; END IF;
  FOR d IN SELECT value FROM jsonb_array_elements(p->'decks') LOOP
    width := (d->>'width')::integer; height := (d->>'height')::integer;
    IF width IS NULL OR height IS NULL OR width NOT BETWEEN 4 AND 100 OR height NOT BETWEEN 4 AND 100
      OR coalesce(length(trim(d->>'name')),0) NOT BETWEEN 1 AND 120
      OR jsonb_typeof(d->'rooms') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'marks') IS DISTINCT FROM 'array'
      OR d - ARRAY['id','name','width','height','height_ft','rooms','marks'] <> '{}'::jsonb
      THEN RAISE EXCEPTION 'Invalid deck'; END IF;
    IF d ? 'height_ft' THEN
      IF jsonb_typeof(d->'height_ft') IS DISTINCT FROM 'number'
        OR (d->>'height_ft')::numeric NOT BETWEEN 1 AND 100
      THEN RAISE EXCEPTION 'Deck height must be between 1 and 100 feet'; END IF;
    END IF;
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
  IF p ? 'appearance' THEN
    appearance := p->'appearance';
    IF jsonb_typeof(appearance) IS DISTINCT FROM 'object'
      OR appearance - ARRAY['hull_color','accent_color','engine_color','marking','windows'] <> '{}'::jsonb
      OR jsonb_typeof(appearance->'windows') IS DISTINCT FROM 'array'
      OR coalesce(appearance->>'marking','') NOT IN ('none','stripe','chevron')
    THEN RAISE EXCEPTION 'Invalid ship appearance'; END IF;
    FOREACH endpoint IN ARRAY ARRAY['hull_color','accent_color','engine_color'] LOOP
      IF jsonb_typeof(appearance->endpoint) IS DISTINCT FROM 'string'
        OR (appearance->>endpoint) !~ '^#[0-9A-Fa-f]{6}$'
      THEN RAISE EXCEPTION 'Invalid appearance color'; END IF;
    END LOOP;
    IF jsonb_array_length(appearance->'windows') > 100 THEN RAISE EXCEPTION 'Too many ship windows'; END IF;
    FOR pane IN SELECT value FROM jsonb_array_elements(appearance->'windows') LOOP
      IF jsonb_typeof(pane) IS DISTINCT FROM 'object'
        OR pane - ARRAY['id','deck_id','side','position'] <> '{}'::jsonb
        OR coalesce(pane->>'side','') NOT IN ('front','rear','port','starboard')
        OR jsonb_typeof(pane->'position') IS DISTINCT FROM 'number'
        OR (pane->>'position')::numeric NOT BETWEEN 0 AND 1
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p->'decks') deck WHERE deck->>'id' = pane->>'deck_id')
      THEN RAISE EXCEPTION 'Invalid ship pane'; END IF;
    END LOOP;
  END IF;
  FOR entity IN
    SELECT value FROM jsonb_array_elements(p->'decks')
    UNION ALL SELECT r.value FROM jsonb_array_elements(p->'decks') d, jsonb_array_elements(d.value->'rooms') r
    UNION ALL SELECT m.value FROM jsonb_array_elements(p->'decks') d, jsonb_array_elements(d.value->'marks') m
    UNION ALL SELECT value FROM jsonb_array_elements(p->'parts')
    UNION ALL SELECT value FROM jsonb_array_elements(p->'connections')
    UNION ALL SELECT value FROM jsonb_array_elements(coalesce(p->'appearance'->'windows','[]'::jsonb))
  LOOP
    IF coalesce(length(entity->>'id'),0) NOT BETWEEN 1 AND 100 OR entity->>'id' = ANY(ids) THEN RAISE EXCEPTION 'Duplicate or missing plan ID'; END IF;
    ids := array_append(ids, entity->>'id');
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.v2_ship_before_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE prior jsonb := '{"decks":[]}'::jsonb;
BEGIN
  -- Validate the supplied document before iterating; explicit null/invalid heights fail.
  PERFORM public.v2_ship_check_plan(NEW.plan);
  IF TG_OP = 'UPDATE' THEN prior := OLD.plan; END IF;
  -- Omitted appearance from older clients retains customization. Prune windows
  -- only when their deck was removed; an explicit appearance object replaces it.
  IF NOT NEW.plan ? 'appearance' AND prior ? 'appearance' THEN
    NEW.plan := jsonb_set(NEW.plan, '{appearance}', jsonb_set(prior->'appearance', '{windows}', (
      SELECT coalesce(jsonb_agg(w.value ORDER BY w.ordinality), '[]'::jsonb)
      FROM jsonb_array_elements(prior->'appearance'->'windows') WITH ORDINALITY w(value, ordinality)
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.plan->'decks') deck WHERE deck->>'id' = w.value->>'deck_id')
    )));
  END IF;
  -- Missing fields from old clients preserve heights by stable deck ID. New decks
  -- default to eight feet. No mass backfill, revision changes or permission changes.
  NEW.plan := jsonb_set(NEW.plan, '{decks}', (
    SELECT jsonb_agg(CASE WHEN d.value ? 'height_ft' THEN d.value ELSE
      d.value || jsonb_build_object('height_ft', coalesce((
        SELECT old_deck->'height_ft' FROM jsonb_array_elements(prior->'decks') old_deck
        WHERE old_deck->>'id' = d.value->>'id'
      ), '8'::jsonb)) END ORDER BY d.ordinality)
    FROM jsonb_array_elements(NEW.plan->'decks') WITH ORDINALITY d(value, ordinality)
  ));
  PERFORM public.v2_ship_check_plan(NEW.plan);
  IF cardinality(NEW.crew_ids) > 100 OR EXISTS (
    SELECT 1 FROM unnest(NEW.crew_ids) member WHERE member IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = member)
  ) THEN RAISE EXCEPTION 'Crew must be existing profiles (maximum 100)'; END IF;
  NEW.version := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE OLD.version + 1 END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

COMMIT;
