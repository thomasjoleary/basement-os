-- REVIEW REQUIRED: new private player authoring and GM acceptance boundary.
-- No live application by the client. Existing playable ships are untouched.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('registration_private.has_campaign_access()') IS NULL
    OR to_regprocedure('registration_private.is_approved_gm()') IS NULL
    OR to_regprocedure('public.v2_ship_check_plan(jsonb)') IS NULL
  THEN RAISE EXCEPTION 'Install registration approval and ship migrations first'; END IF;
  IF current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.v2_ships'::regclass)
  THEN RAISE EXCEPTION 'Run reviewed migration as the existing ship table owner'; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.v2_ship_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description)<=10000),
  plan jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','changes_requested','accepted')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  current_submission integer,
  accepted_ship_id uuid UNIQUE REFERENCES public.v2_ships(id) ON DELETE SET NULL,
  accepted_ship_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_ship_designs_author ON public.v2_ship_designs(author_id);
CREATE INDEX IF NOT EXISTS v2_ship_designs_queue ON public.v2_ship_designs(status,updated_at);
CREATE TABLE IF NOT EXISTS public.v2_ship_submissions (
  design_id uuid NOT NULL REFERENCES public.v2_ship_designs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  plan jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(design_id,version)
);
CREATE TABLE IF NOT EXISTS public.v2_ship_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.v2_ship_designs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  submission_version integer,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  feedback text NOT NULL DEFAULT '' CHECK (length(feedback)<=10000),
  accepted_ship_version integer,
  owner_id uuid,
  crew_ids uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_ship_review_events_design ON public.v2_ship_review_events(design_id,version);

ALTER TABLE public.v2_ship_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_ship_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_ship_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.v2_ship_designs,public.v2_ship_submissions,public.v2_ship_review_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v2_ship_designs,public.v2_ship_submissions,public.v2_ship_review_events TO authenticated;
DROP POLICY IF EXISTS design_reader ON public.v2_ship_designs;
CREATE POLICY design_reader ON public.v2_ship_designs FOR SELECT TO authenticated
  USING (registration_private.has_campaign_access() AND (author_id=auth.uid() OR registration_private.is_approved_gm()));
DROP POLICY IF EXISTS submission_reader ON public.v2_ship_submissions;
CREATE POLICY submission_reader ON public.v2_ship_submissions FOR SELECT TO authenticated
  USING (registration_private.has_campaign_access() AND EXISTS (SELECT 1 FROM public.v2_ship_designs d WHERE d.id=design_id));
DROP POLICY IF EXISTS review_reader ON public.v2_ship_review_events;
CREATE POLICY review_reader ON public.v2_ship_review_events FOR SELECT TO authenticated
  USING (registration_private.has_campaign_access() AND EXISTS (SELECT 1 FROM public.v2_ship_designs d WHERE d.id=design_id));

-- One explicitly guarded write API. Table privileges never permit direct writes,
-- status changes, submission edits, audit fabrication or author reassignment.
CREATE OR REPLACE FUNCTION public.v2_design_action(design_id uuid,expected_version integer,action text,payload jsonb DEFAULT '{}'::jsonb)
RETURNS public.v2_ship_designs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.v2_ship_designs; snapshot public.v2_ship_submissions;
  caller uuid := auth.uid(); gm boolean; feedback text := ''; target uuid;
  owner uuid; crew uuid[]; live_version integer; new_version integer;
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
      d.name:=payload->>'name'; d.description:=coalesce(payload->>'description',''); d.plan:=payload->'plan';
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
REVOKE ALL ON FUNCTION public.v2_design_action(uuid,integer,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_design_action(uuid,integer,text,jsonb) TO authenticated;

-- Accepted snapshots cannot be edited through the legacy GM editor. The guarded
-- acceptance RPC runs as table owner; ordinary authenticated calls retain RLS.
CREATE OR REPLACE FUNCTION public.v2_protect_accepted_ship() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.v2_ships'::regclass)
    AND EXISTS(SELECT 1 FROM public.v2_ship_designs WHERE accepted_ship_id=OLD.id)
  THEN RAISE EXCEPTION 'Accepted designs are versioned. Revise and submit the design instead.' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.v2_protect_accepted_ship() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS v2_accepted_ship_guard ON public.v2_ships;
CREATE TRIGGER v2_accepted_ship_guard BEFORE UPDATE OR DELETE ON public.v2_ships FOR EACH ROW EXECUTE FUNCTION public.v2_protect_accepted_ship();
COMMIT;
