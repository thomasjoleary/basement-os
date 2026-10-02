-- Optional physical deck apertures and separately referenced ladder fixtures.
-- No table, policy, account, revision backfill or authorization changes.
-- Apply only after independent review; old clients retain omitted aperture metadata.
BEGIN;
CREATE OR REPLACE FUNCTION public.v2_ship_check_openings(p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; a jsonb; part jsonb; target jsonb; pos jsonb; root jsonb; field text; endpoint text;
  ai integer; bi integer; w integer; h integer; ids text[]:='{}'; offsets jsonb:='{}'; queue text[]; current_id text; other_id text; origin jsonb; dest jsonb; wanted jsonb;
  bounded_deck jsonb; bounded_item jsonb; collection text; coordinate text; floors jsonb:='{}'; columns jsonb;
  deck_order jsonb:='{}'; deck_geometry jsonb:='{}'; deck_index integer:=0; coverage_work bigint:=0;
BEGIN
  -- These pure helpers are RPC-callable. Bound untrusted input before graph,
  -- geometry or merge work; do not rely on the outer save validator.
  IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
    OR octet_length(p::text)>2000000
    OR p->>'schema_version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p->'decks') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'parts') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p->'connections') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Invalid bounded opening document'; END IF;
  IF jsonb_array_length(p->'decks') NOT BETWEEN 1 AND 20
    OR jsonb_array_length(p->'parts')>2000 OR jsonb_array_length(p->'connections')>200
  THEN RAISE EXCEPTION 'Opening document exceeds collection limits'; END IF;
  FOREACH collection IN ARRAY ARRAY['decks','parts','connections'] LOOP
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->collection) v
      WHERE jsonb_typeof(v) IS DISTINCT FROM 'object' OR coalesce(length(v->>'id'),0) NOT BETWEEN 1 AND 100)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->collection) v GROUP BY v->>'id' HAVING count(*)>1)
    THEN RAISE EXCEPTION 'Invalid or duplicate opening document ID'; END IF;
  END LOOP;
  FOR bounded_deck IN SELECT value FROM jsonb_array_elements(p->'decks') LOOP
    IF jsonb_typeof(bounded_deck->'rooms') IS DISTINCT FROM 'array'
      OR jsonb_typeof(bounded_deck->'marks') IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'Invalid opening deck collections'; END IF;
    IF jsonb_array_length(bounded_deck->'rooms')>500 OR jsonb_array_length(bounded_deck->'marks')>2000
    THEN RAISE EXCEPTION 'Opening deck exceeds collection limits'; END IF;
    FOREACH coordinate IN ARRAY ARRAY['width','height'] LOOP
      -- Match the predecessor's integer parser (leading zeros/sign/whitespace).
      -- Document bytes bound parsing work; numeric value bounds geometry work.
      IF coalesce((bounded_deck->>coordinate)::integer,-1) NOT BETWEEN 4 AND 100
      THEN RAISE EXCEPTION 'Invalid opening deck dimensions'; END IF;
    END LOOP;
    deck_index:=deck_index+1;
    deck_order:=jsonb_set(deck_order,ARRAY[bounded_deck->>'id'],to_jsonb(deck_index));
    deck_geometry:=jsonb_set(deck_geometry,ARRAY[bounded_deck->>'id'],jsonb_build_object(
      'id',bounded_deck->>'id','width',(bounded_deck->>'width')::integer,'height',(bounded_deck->>'height')::integer));
    FOR bounded_item IN SELECT value FROM jsonb_array_elements(bounded_deck->'rooms') LOOP
      FOREACH coordinate IN ARRAY ARRAY['x','y','width','height'] LOOP
        IF coalesce((bounded_item->>coordinate)::integer,-1) NOT BETWEEN 0 AND 100
        THEN RAISE EXCEPTION 'Invalid opening room geometry'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR bounded_item IN SELECT value FROM jsonb_array_elements(p->'connections') LOOP
    FOREACH endpoint IN ARRAY ARRAY['from','to'] LOOP
      IF NOT deck_order ? (bounded_item->>(endpoint||'_deck'))
        OR jsonb_typeof(bounded_item->endpoint) IS DISTINCT FROM 'object'
      THEN RAISE EXCEPTION 'Invalid opening deck endpoint'; END IF;
      FOREACH coordinate IN ARRAY ARRAY['x','y'] LOOP
        IF coalesce((bounded_item->endpoint->>coordinate)::integer,-1) NOT BETWEEN 0 AND 99
        THEN RAISE EXCEPTION 'Invalid opening endpoint coordinates'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  -- Count distinct room-column intervals BEFORE coverage expansion. The aggregate
  -- 100,000-interval budget bounds all used decks together, not each separately.
  -- Empty/legacy plans without physical apertures consume no coverage budget.
  SELECT coalesce(sum(room_width),0) INTO coverage_work FROM (
    SELECT DISTINCT d->>'id' AS deck_id,(r->>'x')::integer AS room_x,
      (r->>'y')::integer AS room_y,(r->>'width')::integer AS room_width,
      (r->>'height')::integer AS room_height
    FROM jsonb_array_elements(p->'decks') d CROSS JOIN LATERAL jsonb_array_elements(d->'rooms') r
    WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p->'connections') candidate
      WHERE candidate ? 'aperture' AND (candidate->>'from_deck'=d->>'id' OR candidate->>'to_deck'=d->>'id'))
      AND (r->>'width')::integer>0 AND (r->>'height')::integer>0
  ) distinct_rooms;
  IF coverage_work>100000 THEN RAISE EXCEPTION 'Opening floor coverage exceeds aggregate work limit'; END IF;
  -- Compute each used deck's floor union ONCE, independent of opening count.
  -- At most 100,000 input intervals overall, then 200 * 2 * 100 cached lookups.
  -- No room scan occurs inside the opening loop; duplicate rectangles collapse.
  FOR bounded_deck IN SELECT value FROM jsonb_array_elements(p->'decks') d
    WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p->'connections') candidate
      WHERE candidate ? 'aperture' AND (candidate->>'from_deck'=d->>'id' OR candidate->>'to_deck'=d->>'id')) LOOP
    SELECT coalesce(jsonb_object_agg(x,spans::text),'{}'::jsonb) INTO columns FROM (
      SELECT x,range_agg(int4range(y,y+height,'[)')) AS spans FROM (
        SELECT DISTINCT (r->>'x')::integer AS start_x,(r->>'y')::integer AS y,
          (r->>'width')::integer AS width,(r->>'height')::integer AS height
        FROM jsonb_array_elements(bounded_deck->'rooms') r
      ) rooms CROSS JOIN LATERAL generate_series(start_x,start_x+width-1) x
      WHERE width>0 AND height>0 GROUP BY x
    ) coverage;
    floors:=jsonb_set(floors,ARRAY[bounded_deck->>'id'],columns);
  END LOOP;
  -- Stable deck offsets follow the same deterministic connection order as the viewer.
  FOR root IN SELECT value FROM jsonb_array_elements(p->'decks') LOOP
    IF offsets ? (root->>'id') THEN CONTINUE; END IF;
    offsets:=jsonb_set(offsets,ARRAY[root->>'id'],jsonb_build_object('x',0,'y',0));queue:=ARRAY[root->>'id'];
    WHILE cardinality(queue)>0 LOOP
      current_id:=queue[1];queue:=queue[2:cardinality(queue)];
      FOR c IN SELECT value FROM jsonb_array_elements(p->'connections') LOOP
        ai:=(deck_order->>(c->>'from_deck'))::integer;
        bi:=(deck_order->>(c->>'to_deck'))::integer;
        IF abs(ai-bi)<>1 THEN CONTINUE; END IF;
        IF c->>'from_deck'=current_id THEN other_id:=c->>'to_deck';origin:=c->'from';dest:=c->'to';
        ELSIF c->>'to_deck'=current_id THEN other_id:=c->>'from_deck';origin:=c->'to';dest:=c->'from';
        ELSE CONTINUE; END IF;
        wanted:=jsonb_build_object('x',(offsets->current_id->>'x')::numeric+(origin->>'x')::numeric-(dest->>'x')::numeric,'y',(offsets->current_id->>'y')::numeric+(origin->>'y')::numeric-(dest->>'y')::numeric);
        IF NOT offsets ? other_id THEN offsets:=jsonb_set(offsets,ARRAY[other_id],wanted);queue:=array_append(queue,other_id);END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(p->'connections') LOOP
    IF NOT c ? 'aperture' THEN CONTINUE; END IF;
    a:=c->'aperture';
    IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR a-ARRAY['width','height','ladder_part_id']<>'{}'::jsonb OR NOT(a ? 'ladder_part_id')
      OR (jsonb_typeof(a->'ladder_part_id') IS DISTINCT FROM 'null' AND jsonb_typeof(a->'ladder_part_id') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'Invalid aperture';END IF;
    FOREACH field IN ARRAY ARRAY['width','height'] LOOP
      IF jsonb_typeof(a->field) IS DISTINCT FROM 'number' OR (a->>field)::numeric<>trunc((a->>field)::numeric) OR (a->>field)::numeric NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Opening dimensions must be whole cells from 1 to 100';END IF;
    END LOOP;
    w:=(a->>'width')::integer;h:=(a->>'height')::integer;
    ai:=(deck_order->>(c->>'from_deck'))::integer;
    bi:=(deck_order->>(c->>'to_deck'))::integer;
    IF abs(ai-bi) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Openings require adjacent decks';END IF;
    FOREACH endpoint IN ARRAY ARRAY['from','to'] LOOP
      target:=deck_geometry->(c->>(endpoint||'_deck'));pos:=c->endpoint;
      columns:=floors->(target->>'id');
      FOREACH field IN ARRAY ARRAY['x','y'] LOOP
        IF jsonb_typeof(pos->field) IS DISTINCT FROM 'number' OR (pos->>field)::numeric<>trunc((pos->>field)::numeric) THEN RAISE EXCEPTION 'Opening positions require whole cells';END IF;
      END LOOP;
      IF (pos->>'x')::integer+w>(target->>'width')::integer OR (pos->>'y')::integer+h>(target->>'height')::integer OR EXISTS(
        SELECT 1 FROM generate_series((pos->>'x')::integer,(pos->>'x')::integer+w-1) x
        WHERE NOT coalesce((columns->>x::text)::int4multirange
          @> int4range((pos->>'y')::integer,(pos->>'y')::integer+h,'[)'),false))
      THEN RAISE EXCEPTION 'Opening must fit room floors at both endpoints';END IF;
    END LOOP;
    origin:=offsets->(c->>'from_deck');dest:=offsets->(c->>'to_deck');
    IF (origin->>'x')::numeric+(c->'from'->>'x')::numeric<>(dest->>'x')::numeric+(c->'to'->>'x')::numeric
      OR (origin->>'y')::numeric+(c->'from'->>'y')::numeric<>(dest->>'y')::numeric+(c->'to'->>'y')::numeric THEN RAISE EXCEPTION 'Opening alignment conflicts with other connections';END IF;
    IF a->>'ladder_part_id' IS NOT NULL THEN
      SELECT value INTO part FROM jsonb_array_elements(p->'parts') WHERE value->>'id'=a->>'ladder_part_id';
      IF part IS NULL OR part->>'type' IS DISTINCT FROM 'Ladder' OR part->>'deck_id' IS DISTINCT FROM c->>'from_deck'
        OR part->'x' IS DISTINCT FROM c->'from'->'x' OR part->'y' IS DISTINCT FROM c->'from'->'y' OR (part->>'quantity')::integer<>1 OR part->>'id'=ANY(ids)
      THEN RAISE EXCEPTION 'Ladder must be a unique fixture anchored to its opening source';END IF;
      ids:=array_append(ids,part->>'id');
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.v2_ship_check_openings(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_ship_check_openings(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.v2_ship_merge_openings(p jsonb,prior jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE merged jsonb; collection text; prior_deck jsonb;
BEGIN
 PERFORM public.v2_ship_check_openings(p);
 -- Prior is bounded structurally, not revalidated semantically: a corrected
 -- proposed plan must be able to repair legacy geometry/metadata. Only copied
 -- apertures are interpreted, and the complete merged result is validated below.
 -- The INSERT trigger's exact empty-prior sentinel is the only non-plan input.
 IF prior IS DISTINCT FROM '{"decks":[]}'::jsonb THEN
   IF prior IS NULL OR jsonb_typeof(prior) IS DISTINCT FROM 'object'
     OR octet_length(prior::text)>2000000 OR prior->>'schema_version' IS DISTINCT FROM '1'
     OR jsonb_typeof(prior->'decks') IS DISTINCT FROM 'array'
     OR jsonb_typeof(prior->'parts') IS DISTINCT FROM 'array'
     OR jsonb_typeof(prior->'connections') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'Invalid bounded prior document'; END IF;
   IF jsonb_array_length(prior->'decks') NOT BETWEEN 1 AND 20
     OR jsonb_array_length(prior->'parts')>2000 OR jsonb_array_length(prior->'connections')>200
   THEN RAISE EXCEPTION 'Prior document exceeds collection limits'; END IF;
   FOREACH collection IN ARRAY ARRAY['decks','parts','connections'] LOOP
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(prior->collection) v
       WHERE jsonb_typeof(v) IS DISTINCT FROM 'object' OR coalesce(length(v->>'id'),0) NOT BETWEEN 1 AND 100)
       OR EXISTS(SELECT 1 FROM jsonb_array_elements(prior->collection) v GROUP BY v->>'id' HAVING count(*)>1)
     THEN RAISE EXCEPTION 'Invalid or duplicate prior document ID'; END IF;
   END LOOP;
   FOR prior_deck IN SELECT value FROM jsonb_array_elements(prior->'decks') LOOP
     IF jsonb_typeof(prior_deck->'rooms') IS DISTINCT FROM 'array'
       OR jsonb_typeof(prior_deck->'marks') IS DISTINCT FROM 'array'
     THEN RAISE EXCEPTION 'Invalid prior deck collections'; END IF;
     IF jsonb_array_length(prior_deck->'rooms')>500 OR jsonb_array_length(prior_deck->'marks')>2000
     THEN RAISE EXCEPTION 'Prior deck exceeds collection limits'; END IF;
   END LOOP;
 END IF;
 SELECT jsonb_set(p,'{connections}',coalesce((SELECT jsonb_agg(CASE WHEN c.value ? 'aperture' OR old.value IS NULL THEN c.value ELSE c.value||jsonb_build_object('aperture',CASE
   WHEN old.value->'aperture'->>'ladder_part_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'parts') part WHERE part->>'id'=old.value->'aperture'->>'ladder_part_id')
   THEN jsonb_set(old.value->'aperture','{ladder_part_id}','null'::jsonb) ELSE old.value->'aperture' END) END ORDER BY c.ordinality)
 FROM jsonb_array_elements(p->'connections') WITH ORDINALITY c(value,ordinality)
 LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(coalesce(prior->'connections','[]'::jsonb)) old WHERE old->>'id'=c.value->>'id' AND old ? 'aperture') old ON true),'[]'::jsonb)) INTO merged;
 -- Individually bounded documents can grow when omitted metadata is restored.
 PERFORM public.v2_ship_check_openings(merged);
 RETURN merged;
END $$;
REVOKE ALL ON FUNCTION public.v2_ship_merge_openings(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_ship_merge_openings(jsonb,jsonb) TO authenticated;

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
    IF c - ARRAY['id','name','kind','from_deck','from','to_deck','to','aperture'] <> '{}'::jsonb
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
  PERFORM public.v2_ship_check_openings(p);
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
  NEW.plan:=public.v2_ship_merge_openings(NEW.plan,prior);
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
      d.name:=payload->>'name'; d.description:=coalesce(payload->>'description',''); d.plan:=public.v2_ship_merge_openings(payload->'plan',prior_plan);
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
