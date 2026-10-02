-- Optional one-foot surface painting and outward hull sections. Apply only after
-- the separately approved design-review migration. No access-policy changes.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.v2_design_action(uuid,integer,text,jsonb)') IS NULL
  THEN RAISE EXCEPTION 'Apply reviewed design workflow migration first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.v2_ship_check_surfaces(p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s jsonb:=p->'surface_design'; f jsonb; paint jsonb; run jsonb; c jsonb; target jsonb;
  keys text[]:='{}'; key text; count_tiles bigint:=0; count_runs integer:=0;
  start_at integer; length_at integer; color_at integer; previous_end integer; field text;
BEGIN
  IF NOT p ? 'surface_design' THEN RETURN; END IF;
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR s-ARRAY['surfaces','sections','components']<>'{}'::jsonb
    OR jsonb_typeof(s->'surfaces') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'sections') IS DISTINCT FROM 'array'
    OR jsonb_typeof(s->'components') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid surface design'; END IF;
  IF jsonb_array_length(s->'surfaces')>2000 OR jsonb_array_length(s->'sections')>2000 OR jsonb_array_length(s->'components')>2000
  THEN RAISE EXCEPTION 'Surface count limit exceeded'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(s->'surfaces') UNION ALL SELECT value FROM jsonb_array_elements(s->'sections') LOOP
    IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p->'decks') deck,jsonb_array_elements(deck->'rooms') room
      WHERE deck->>'id'=f->>'deck_id' AND room->>'id'=f->>'room_id')
    THEN RAISE EXCEPTION 'Surface room reference invalid'; END IF;
  END LOOP;
  FOR f IN SELECT value FROM jsonb_array_elements(s->'surfaces') LOOP
    IF f-ARRAY['id','deck_id','room_id','face','color','paint']<>'{}'::jsonb
      OR coalesce(f->>'face','') NOT IN ('floor','ceiling','roof','interior-front','interior-rear','interior-port','interior-starboard','exterior-front','exterior-rear','exterior-port','exterior-starboard')
    THEN RAISE EXCEPTION 'Invalid painted face'; END IF;
    key:=(f->>'room_id')||'/'||(f->>'face');
    IF key=ANY(keys) THEN RAISE EXCEPTION 'Duplicate painted face'; END IF;keys:=array_append(keys,key);
    IF f ? 'color' AND (jsonb_typeof(f->'color') IS DISTINCT FROM 'string' OR (f->>'color')!~'^#[0-9a-fA-F]{6}$') THEN RAISE EXCEPTION 'Invalid surface color'; END IF;
    paint:=f->'paint';
    IF jsonb_typeof(paint) IS DISTINCT FROM 'object' OR paint-ARRAY['palette','runs']<>'{}'::jsonb
      OR jsonb_typeof(paint->'palette') IS DISTINCT FROM 'array' OR jsonb_typeof(paint->'runs') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'Invalid paint data'; END IF;
    IF jsonb_array_length(paint->'palette')>64 THEN RAISE EXCEPTION 'Palette limit exceeded'; END IF;
    FOR c IN SELECT value FROM jsonb_array_elements(paint->'palette') LOOP
      IF jsonb_typeof(c) IS DISTINCT FROM 'string' OR (c#>>'{}')!~'^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'Invalid palette color'; END IF;
    END LOOP;
    previous_end:=-1;
    FOR run IN SELECT value FROM jsonb_array_elements(paint->'runs') LOOP
      IF jsonb_typeof(run) IS DISTINCT FROM 'array' OR jsonb_array_length(run)<>3 THEN RAISE EXCEPTION 'Invalid paint run'; END IF;
      FOR c IN SELECT value FROM jsonb_array_elements(run) LOOP
        IF jsonb_typeof(c) IS DISTINCT FROM 'number' OR (c#>>'{}')::numeric<>trunc((c#>>'{}')::numeric) THEN RAISE EXCEPTION 'Paint runs require integers'; END IF;
      END LOOP;
      start_at:=(run->>0)::integer;length_at:=(run->>1)::integer;color_at:=(run->>2)::integer;
      IF start_at<=previous_end OR start_at<0 OR length_at<1 OR start_at::bigint+length_at>1048576 OR color_at<0 OR color_at>=jsonb_array_length(paint->'palette')
      THEN RAISE EXCEPTION 'Paint runs must be ordered, disjoint and bounded'; END IF;
      previous_end:=start_at+length_at-1;count_tiles:=count_tiles+length_at;count_runs:=count_runs+1;
      IF count_tiles>50000 OR count_runs>10000 THEN RAISE EXCEPTION 'Ship paint limit exceeded'; END IF;
    END LOOP;
  END LOOP;
  FOR f IN SELECT value FROM jsonb_array_elements(s->'sections') LOOP
    IF f-ARRAY['id','deck_id','room_id','side','extension_ft','slope','taper','bevel_ft']<>'{}'::jsonb
      OR coalesce(f->>'side','') NOT IN ('front','rear','port','starboard') THEN RAISE EXCEPTION 'Invalid hull section'; END IF;
    key:='shape/'||(f->>'room_id')||'/'||(f->>'side');
    IF key=ANY(keys) THEN RAISE EXCEPTION 'Duplicate hull section'; END IF;keys:=array_append(keys,key);
    FOREACH field IN ARRAY ARRAY['extension_ft','slope','taper','bevel_ft'] LOOP
      IF jsonb_typeof(f->field) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Hull parameters require numbers'; END IF;
    END LOOP;
    IF (f->>'extension_ft')::numeric NOT BETWEEN 0 AND 10 OR (f->>'slope')::numeric NOT BETWEEN 0 AND 1
      OR (f->>'taper')::numeric NOT BETWEEN 0 AND .8 OR (f->>'bevel_ft')::numeric NOT BETWEEN 0 AND 2
    THEN RAISE EXCEPTION 'Hull parameters out of bounds'; END IF;
  END LOOP;
  FOR f IN SELECT value FROM jsonb_array_elements(s->'components') LOOP
    IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR f-ARRAY['id','part_id','color']<>'{}'::jsonb
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'parts') part WHERE part->>'id'=f->>'part_id')
      OR jsonb_typeof(f->'color') IS DISTINCT FROM 'string' OR (f->>'color')!~'^#[0-9a-fA-F]{6}$'
    THEN RAISE EXCEPTION 'Invalid component color'; END IF;
    key:='part/'||(f->>'part_id');IF key=ANY(keys) THEN RAISE EXCEPTION 'Duplicate component color'; END IF;keys:=array_append(keys,key);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.v2_ship_check_surfaces(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_ship_check_surfaces(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.v2_ship_check_plan(p jsonb) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE d jsonb; r jsonb; m jsonb; item jsonb; c jsonb; target jsonb; room jsonb;
  ids text[] := '{}'; entity jsonb; width int; height int; pos jsonb; endpoint text; appearance jsonb; pane jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' OR p->>'schema_version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p->'decks') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'parts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'connections') IS DISTINCT FROM 'array'
    OR p - ARRAY['schema_version','decks','parts','connections','appearance','surface_design'] <> '{}'::jsonb
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
  PERFORM public.v2_ship_check_surfaces(p);
  FOR entity IN
    SELECT value FROM jsonb_array_elements(p->'decks')
    UNION ALL SELECT r.value FROM jsonb_array_elements(p->'decks') d, jsonb_array_elements(d.value->'rooms') r
    UNION ALL SELECT m.value FROM jsonb_array_elements(p->'decks') d, jsonb_array_elements(d.value->'marks') m
    UNION ALL SELECT value FROM jsonb_array_elements(p->'parts')
    UNION ALL SELECT value FROM jsonb_array_elements(p->'connections')
    UNION ALL SELECT value FROM jsonb_array_elements(coalesce(p->'appearance'->'windows','[]'::jsonb))
    UNION ALL SELECT value FROM jsonb_array_elements(coalesce(p->'surface_design'->'surfaces','[]'::jsonb))
    UNION ALL SELECT value FROM jsonb_array_elements(coalesce(p->'surface_design'->'sections','[]'::jsonb))
    UNION ALL SELECT value FROM jsonb_array_elements(coalesce(p->'surface_design'->'components','[]'::jsonb))
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
  -- Preserve omitted customization from older clients, pruning deleted targets.
  IF NOT NEW.plan ? 'surface_design' AND prior ? 'surface_design' THEN
    NEW.plan:=jsonb_set(NEW.plan,'{surface_design}',jsonb_build_object(
      'surfaces',(SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(prior->'surface_design'->'surfaces') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.plan->'decks') deck,jsonb_array_elements(deck->'rooms') room WHERE deck->>'id'=v->>'deck_id' AND room->>'id'=v->>'room_id')),
      'sections',(SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(prior->'surface_design'->'sections') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.plan->'decks') deck,jsonb_array_elements(deck->'rooms') room WHERE deck->>'id'=v->>'deck_id' AND room->>'id'=v->>'room_id')),
      'components',(SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(prior->'surface_design'->'components') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.plan->'parts') part WHERE part->>'id'=v->>'part_id'))
    ));
  END IF;

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


CREATE OR REPLACE FUNCTION public.v2_design_action(design_id uuid,expected_version integer,action text,payload jsonb DEFAULT '{}'::jsonb)
RETURNS public.v2_ship_designs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.v2_ship_designs; snapshot public.v2_ship_submissions;
  caller uuid := auth.uid(); gm boolean; feedback text := ''; target uuid;
  prior_plan jsonb; owner uuid; crew uuid[]; live_version integer; new_version integer;
BEGIN
  IF NOT registration_private.has_campaign_access() THEN RAISE EXCEPTION 'Approved account required' USING ERRCODE='42501'; END IF;
  gm := registration_private.is_approved_gm();
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR octet_length(payload::text)>2100000
  THEN RAISE EXCEPTION 'Invalid design action'; END IF;
  IF action='create' THEN
    IF expected_version IS DISTINCT FROM 0 OR payload-ARRAY['name','description','plan']<>'{}'::jsonb
    THEN RAISE EXCEPTION 'Invalid create request'; END IF;
    -- Serialize per-author creation so concurrent requests cannot bypass the cap.
    PERFORM 1 FROM public.profiles WHERE id=caller FOR UPDATE;
    IF (SELECT count(*) FROM public.v2_ship_designs WHERE author_id=caller)>=100 THEN RAISE EXCEPTION 'Design limit reached (100)'; END IF;
    PERFORM public.v2_ship_check_plan(payload->'plan');
    INSERT INTO public.v2_ship_designs(id,author_id,name,description,plan)
      VALUES(design_id,caller,payload->>'name',coalesce(payload->>'description',''),payload->'plan') RETURNING * INTO d;
  ELSE
    SELECT * INTO d FROM public.v2_ship_designs WHERE id=design_id FOR UPDATE;
    IF d.id IS NULL OR (d.author_id<>caller AND NOT gm) THEN RAISE EXCEPTION 'Design unavailable' USING ERRCODE='42501'; END IF;
    IF d.version IS DISTINCT FROM expected_version THEN RAISE EXCEPTION 'Design changed. Reload before continuing.' USING ERRCODE='40001'; END IF;
    IF (SELECT count(*) FROM public.v2_ship_review_events e WHERE e.design_id=d.id)>=2000 THEN RAISE EXCEPTION 'Review history limit reached'; END IF;
    IF action='save' THEN
      IF d.author_id<>caller OR d.status NOT IN ('draft','changes_requested') THEN RAISE EXCEPTION 'Only the author can edit an open draft' USING ERRCODE='42501'; END IF;
      IF payload-ARRAY['name','description','plan']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid draft fields'; END IF;
      PERFORM public.v2_ship_check_plan(payload->'plan');
      prior_plan:=d.plan;
      d.name:=payload->>'name'; d.description:=coalesce(payload->>'description',''); d.plan:=payload->'plan';
  -- Preserve omitted customization from older clients, pruning deleted targets.
  IF NOT d.plan ? 'surface_design' AND prior_plan ? 'surface_design' THEN
    d.plan:=jsonb_set(d.plan,'{surface_design}',jsonb_build_object(
      'surfaces',(SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(prior_plan->'surface_design'->'surfaces') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(d.plan->'decks') deck,jsonb_array_elements(deck->'rooms') room WHERE deck->>'id'=v->>'deck_id' AND room->>'id'=v->>'room_id')),
      'sections',(SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(prior_plan->'surface_design'->'sections') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(d.plan->'decks') deck,jsonb_array_elements(deck->'rooms') room WHERE deck->>'id'=v->>'deck_id' AND room->>'id'=v->>'room_id')),
      'components',(SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(prior_plan->'surface_design'->'components') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(d.plan->'parts') part WHERE part->>'id'=v->>'part_id'))
    ));
  END IF;

      d.plan:=jsonb_set(d.plan,'{decks}',(SELECT jsonb_agg(CASE WHEN deck.value ? 'height_ft' THEN deck.value ELSE
        deck.value || jsonb_build_object('height_ft',coalesce((SELECT prior->'height_ft'
          FROM public.v2_ship_designs old,jsonb_array_elements(old.plan->'decks') prior
          WHERE old.id=d.id AND prior->>'id'=deck.value->>'id'),'8'::jsonb)) END ORDER BY deck.ordinality)
        FROM jsonb_array_elements(d.plan->'decks') WITH ORDINALITY deck(value,ordinality)));

      -- Appearance omitted by old clients is preserved; removed decks lose windows.
      IF NOT d.plan ? 'appearance' AND (SELECT plan ? 'appearance' FROM public.v2_ship_designs WHERE id=d.id) THEN
        d.plan:=jsonb_set(d.plan,'{appearance}',(SELECT plan->'appearance' FROM public.v2_ship_designs WHERE id=d.id));
        d.plan:=jsonb_set(d.plan,'{appearance,windows}',(SELECT coalesce(jsonb_agg(w),'[]'::jsonb)
          FROM jsonb_array_elements(d.plan->'appearance'->'windows') w WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(d.plan->'decks') deck WHERE deck->>'id'=w->>'deck_id')));
      END IF;
    ELSIF action='submit' THEN
      IF d.author_id<>caller OR d.status NOT IN ('draft','changes_requested') OR payload<>'{}'::jsonb
      THEN RAISE EXCEPTION 'Only the author can submit an open draft' USING ERRCODE='42501'; END IF;
      IF (SELECT count(*) FROM public.v2_ship_submissions s WHERE s.design_id=d.id)>=500 THEN RAISE EXCEPTION 'Submission limit reached'; END IF;
      d.status:='submitted'; d.current_submission:=d.version+1;
      INSERT INTO public.v2_ship_submissions(design_id,version,name,description,plan) VALUES(d.id,d.current_submission,d.name,d.description,d.plan);
    ELSIF action='withdraw' THEN
      IF d.author_id<>caller OR d.status<>'submitted' OR payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Only the author can withdraw a submission' USING ERRCODE='42501'; END IF;
      d.status:='draft';
    ELSIF action='revise' THEN
      IF d.author_id<>caller OR d.status<>'accepted' OR payload<>'{}'::jsonb THEN RAISE EXCEPTION 'Only the author can revise an accepted design' USING ERRCODE='42501'; END IF;
      d.status:='draft';
    ELSIF action IN ('feedback','request_changes') THEN
      IF NOT gm OR d.status<>'submitted' THEN RAISE EXCEPTION 'GM review of a submitted design required' USING ERRCODE='42501'; END IF;
      IF payload-ARRAY['feedback']<>'{}'::jsonb OR jsonb_typeof(payload->'feedback') IS DISTINCT FROM 'string'
        OR length(trim(payload->>'feedback')) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Feedback is required (maximum 10000 characters)'; END IF;
      feedback:=payload->>'feedback';
      IF action='request_changes' THEN d.status:='changes_requested'; END IF;
    ELSIF action='accept' THEN
      IF NOT gm OR d.status<>'submitted' THEN RAISE EXCEPTION 'GM acceptance of a submitted design required' USING ERRCODE='42501'; END IF;
      IF payload-ARRAY['submission_version','owner_id','crew_ids','feedback']<>'{}'::jsonb
        OR (payload->>'submission_version')::integer IS DISTINCT FROM d.current_submission
        OR NOT payload ? 'owner_id' OR jsonb_typeof(payload->'crew_ids') IS DISTINCT FROM 'array'
      THEN RAISE EXCEPTION 'Confirm the exact submission and owner/crew'; END IF;
      IF jsonb_array_length(payload->'crew_ids')>100 THEN RAISE EXCEPTION 'Crew limit exceeded'; END IF;
      owner:=(payload->>'owner_id')::uuid;
      SELECT coalesce(array_agg(DISTINCT value::uuid),'{}'::uuid[]) INTO crew FROM jsonb_array_elements_text(payload->'crew_ids');
      IF (owner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=owner AND approval_status='approved'))
        OR EXISTS(SELECT 1 FROM unnest(crew) member WHERE member IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=member AND approval_status='approved'))
      THEN RAISE EXCEPTION 'Assignments require approved profiles'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=d.author_id AND approval_status='approved') THEN RAISE EXCEPTION 'Design author must remain approved'; END IF;
      feedback:=coalesce(payload->>'feedback','');
      IF length(feedback)>10000 THEN RAISE EXCEPTION 'Feedback too long'; END IF;
      SELECT * INTO snapshot FROM public.v2_ship_submissions s WHERE s.design_id=d.id AND s.version=d.current_submission;
      IF snapshot.design_id IS NULL THEN RAISE EXCEPTION 'Submission unavailable'; END IF;
      target:=d.accepted_ship_id;
      IF target IS NULL THEN
        target:=gen_random_uuid();
        INSERT INTO public.v2_ships(id,name,description,owner_id,crew_ids,plan)
          VALUES(target,snapshot.name,snapshot.description,owner,crew,snapshot.plan) RETURNING version INTO new_version;
      ELSE
        SELECT version INTO live_version FROM public.v2_ships WHERE id=target FOR UPDATE;
        IF live_version IS DISTINCT FROM d.accepted_ship_version THEN RAISE EXCEPTION 'Playable ship changed; acceptance cancelled' USING ERRCODE='40001'; END IF;
        UPDATE public.v2_ships SET name=snapshot.name,description=snapshot.description,plan=snapshot.plan,owner_id=owner,crew_ids=crew
          WHERE id=target RETURNING version INTO new_version;
      END IF;
      d.accepted_ship_id:=target; d.accepted_ship_version:=new_version; d.status:='accepted';
    ELSE RAISE EXCEPTION 'Unknown design action'; END IF;
    d.version:=d.version+1;
    PERFORM public.v2_ship_check_plan(d.plan);
    UPDATE public.v2_ship_designs SET name=d.name,description=d.description,plan=d.plan,status=d.status,version=d.version,
      current_submission=d.current_submission,accepted_ship_id=d.accepted_ship_id,accepted_ship_version=d.accepted_ship_version,updated_at=now()
      WHERE id=d.id RETURNING * INTO d;
  END IF;
  INSERT INTO public.v2_ship_review_events(design_id,version,submission_version,actor_id,action,feedback,accepted_ship_version,owner_id,crew_ids)
    VALUES(d.id,d.version,d.current_submission,caller,action,feedback,CASE WHEN action='accept' THEN d.accepted_ship_version END,
      CASE WHEN action='accept' THEN owner END,CASE WHEN action='accept' THEN crew END);
  RETURN d;
END $$;

COMMIT;
