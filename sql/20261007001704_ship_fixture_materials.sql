-- Optional fixture trim/detail colors. No table, row, policy or ACL changes.
-- Requires the reviewed underside validator. UI probes this capability before edits.
-- Rollback UI safely by retaining this additive validator; do not strip saved colors.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.v2_ship_check_surfaces(jsonb)') IS NULL OR
    NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='public.v2_ship_check_surfaces(jsonb)'::regprocedure
      AND md5(replace(prosrc,E'\r\n',E'\n')) IN ('4a75aa55533eb2a1d8e377677867e5ad','bb2a0f723f5f3cb6dec81c02ba4e3a44') AND NOT prosecdef AND proconfig=ARRAY['search_path=""'])
 THEN RAISE EXCEPTION 'Unexpected surface validator; review before applying fixture colors'; END IF;
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
      OR coalesce(f->>'face','') NOT IN ('underside','floor','ceiling','roof','interior-front','interior-rear','interior-port','interior-starboard','exterior-front','exterior-rear','exterior-port','exterior-starboard')
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
    IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR f-ARRAY['id','part_id','color','materials']<>'{}'::jsonb
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'parts') part WHERE part->>'id'=f->>'part_id')
      OR jsonb_typeof(f->'color') IS DISTINCT FROM 'string' OR (f->>'color')!~'^#[0-9a-fA-F]{6}$'
    THEN RAISE EXCEPTION 'Invalid component color'; END IF;
    IF f ? 'materials' THEN
      IF jsonb_typeof(f->'materials') IS DISTINCT FROM 'object' OR (f->'materials')-ARRAY['trim','detail']<>'{}'::jsonb
      THEN RAISE EXCEPTION 'Invalid fixture materials'; END IF;
      FOR c IN SELECT value FROM jsonb_each(f->'materials') LOOP
        IF jsonb_typeof(c) IS DISTINCT FROM 'string' OR (c#>>'{}')!~'^#[0-9a-fA-F]{6}$'
        THEN RAISE EXCEPTION 'Invalid fixture material color'; END IF;
      END LOOP;
    END IF;
    key:='part/'||(f->>'part_id');IF key=ANY(keys) THEN RAISE EXCEPTION 'Duplicate component color'; END IF;keys:=array_append(keys,key);
  END LOOP;
END $$;
COMMIT;
