// Real PostgreSQL in memory. No production connections or account creation.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
const gm='10000000-0000-0000-0000-000000000001', player='10000000-0000-0000-0000-000000000002'
const pending='10000000-0000-0000-0000-000000000003', missing='10000000-0000-0000-0000-000000000004'
const tables=['active_travels','battlefield_entities','battlefield_entity_reveals','battlefield_gm_notes','battlefield_presets','battlefield_visibility','battlefields','character_words','characters','map_markers','notes','player_fog_polygons','player_marker_visibility','player_positions','published_leaderboard','unlocks','v2_galaxy_settings','v2_star_systems','v2_system_bodies','words_of_power']
const migration=readFileSync(new URL('../sql/v2_007_registration_approval.sql',import.meta.url),'utf8')
let passed=0
async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`)}
async function as(id,role='authenticated'){
  await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`SET ROLE ${role}`)
}
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA realtime;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth,storage,realtime TO anon,authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users,username text,role text DEFAULT 'player',avatar_url text,created_at timestamptz DEFAULT now());
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profile_read ON profiles FOR SELECT TO authenticated USING(true);
    CREATE POLICY profile_self ON profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
    CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN
      INSERT INTO public.profiles(id,username,role) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'username',NEW.email),'player'); RETURN NEW; END$$;
    CREATE TRIGGER on_auth_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    INSERT INTO auth.users(id,email) VALUES('${gm}','gm@example.invalid'),('${player}','player@example.invalid');
    UPDATE profiles SET role='gm' WHERE id='${gm}';
    CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean DEFAULT false);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON storage.objects TO anon,authenticated;
    CREATE POLICY broad_storage ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
    INSERT INTO storage.objects VALUES('${gm}','campaign-private');
    CREATE TABLE realtime.messages(id uuid PRIMARY KEY,extension text);
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT ON realtime.messages TO anon,authenticated;
    CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('realtime.topic',true)$$;
    INSERT INTO realtime.messages VALUES('${gm}','broadcast');
    CREATE PUBLICATION supabase_realtime WITH (publish='insert, update, delete, truncate');`)
  for(const t of tables)await db.exec(`CREATE TABLE public.${t}(id uuid PRIMARY KEY,payload text);
    ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;
    CREATE POLICY broad_member ON public.${t} FOR ALL TO authenticated USING(true) WITH CHECK(true);
    CREATE POLICY broad_anon ON public.${t} FOR SELECT TO anon USING(true);
    INSERT INTO public.${t} VALUES('${gm}','CAMPAIGN CONTENT');`)
  await db.exec(`CREATE FUNCTION public.bf_can_see_vitals(target_id uuid,viewer uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT true$$;
    CREATE FUNCTION public.get_player_battlefield(bf uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN
      RETURN json_build_object('secret','battlefield content','vitals',bf_can_see_vitals(bf,auth.uid())); END$$;`)
  await db.exec(readFileSync(new URL('../sql/v2_006_profile_update_columns.sql',import.meta.url),'utf8'))
  await db.exec(readFileSync(new URL('../sql/v2_005_ships.sql',import.meta.url),'utf8'))
  await db.exec(readFileSync(new URL('../sql/20261002152056_ship_deck_heights.sql',import.meta.url),'utf8'))
  await db.exec(readFileSync(new URL('../sql/20261002171000_ship_appearance.sql',import.meta.url),'utf8'))
  await db.exec(migration)
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)",[pending,'pending@example.invalid'])
  const workflow=readFileSync(new URL('../sql/20261002175518_ship_design_review.sql',import.meta.url),'utf8')
  await db.exec(workflow);await db.exec(workflow)
  const surfaceMigration=readFileSync(new URL('../sql/20261002182938_ship_surface_design.sql',import.meta.url),'utf8')
  const aclBefore=(await db.query("SELECT oid,proacl::text FROM pg_proc WHERE proname IN ('v2_design_action','v2_ship_check_plan','v2_ship_before_write') ORDER BY oid")).rows
  await db.exec(surfaceMigration);await db.exec(surfaceMigration)
  const openingMigration=readFileSync(new URL('../sql/20261002200613_ship_deck_openings.sql',import.meta.url),'utf8')
  const definitionQuery="SELECT proname,prosrc,proowner,prosecdef,proconfig,proacl::text FROM pg_proc WHERE proname IN ('v2_design_action','v2_ship_check_plan','v2_ship_before_write') ORDER BY proname"
  const originalDefinitions=(await db.query(definitionQuery)).rows
  await check('failed migration rolls back functions, ACLs and helper creation atomically',async()=>{
    await assert.rejects(()=>db.exec(openingMigration.replace('COMMIT;', 'SELECT 1/0; COMMIT;')))
    await db.exec('ROLLBACK')
    assert.deepEqual((await db.query(definitionQuery)).rows,originalDefinitions)
    assert.equal((await db.query("SELECT to_regprocedure('public.v2_ship_check_openings(jsonb)') IS NULL gone")).rows[0].gone,true)
  })
  await db.exec(openingMigration);await db.exec(openingMigration)
  await check('repeat migration retains original ownership, security modes, search paths and ACLs',async()=>{
    const strip=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='prosrc')))
    assert.deepEqual(strip((await db.query(definitionQuery)).rows),strip(originalDefinitions))
  })
  assert.deepEqual((await db.query("SELECT oid,proacl::text FROM pg_proc WHERE proname IN ('v2_design_action','v2_ship_check_plan','v2_ship_before_write') ORDER BY oid")).rows,aclBefore)
  const id='20000000-0000-0000-0000-000000000001'
  const plan={schema_version:1,decks:[{id:'deck',name:'Deck',width:4,height:4,height_ft:12,rooms:[],marks:[]}],parts:[],connections:[]}
  const payload={name:'Private design',description:'Public design notes',plan}
  async function act(action,version,data={},target=id){return (await db.query('SELECT * FROM v2_design_action($1,$2,$3,$4)',[target,version,action,JSON.stringify(data)])).rows[0]}
  await as(player)
  let design=await act('create',0,payload)
  await check('author creates private draft; direct writes and author/status spoofing denied',async()=>{
    assert.equal(design.author_id,player);assert.equal(design.status,'draft')
    await assert.rejects(()=>db.exec("UPDATE v2_ship_designs SET status='accepted'"),/permission denied/)
    await assert.rejects(()=>act('create',0,{...payload,author_id:gm},'20000000-0000-0000-0000-000000000002'),/Invalid create/)
    await assert.rejects(()=>act('save',1,{...payload,gm_notes:'PRIVATE'}),/Invalid draft/)
  })
  for(const [user,role] of [[pending,'authenticated'],[missing,'authenticated'],[null,'anon']]){
    await as(user,role)
    await check('pending/missing/anonymous cannot read designs or invoke workflow',async()=>{
      if(role==='anon')await assert.rejects(()=>db.exec('SELECT * FROM v2_ship_designs'),/permission denied/)
      else assert.equal((await db.query('SELECT * FROM v2_ship_designs')).rows.length,0)
      await assert.rejects(()=>act('save',1,payload))
    })
  }
  await db.exec('RESET ROLE')
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)",[missing,'outsider@example.invalid'])
  await db.query("UPDATE profiles SET approval_status='approved' WHERE id=$1",[missing])
  await as(missing)
  await check('approved outsider cannot read guessed draft, snapshots or history',async()=>{
    for(const table of ['v2_ship_designs','v2_ship_submissions','v2_ship_review_events'])assert.equal((await db.query('SELECT * FROM '+table)).rows.length,0)
    await assert.rejects(()=>act('save',1,payload),/unavailable/)
  })
  await as(player)
  design=await act('submit',1)
  await check('submission freezes exact plan and blocks edits, self acceptance and stale actions',async()=>{
    assert.deepEqual((await db.query('SELECT plan FROM v2_ship_submissions')).rows[0].plan,plan)
    await assert.rejects(()=>act('save',design.version,payload),/open draft/)
    await assert.rejects(()=>act('accept',design.version,{submission_version:design.current_submission,owner_id:player,crew_ids:[]}),/GM acceptance/)
    await assert.rejects(()=>act('withdraw',1),/changed/)
    await assert.rejects(()=>db.exec("UPDATE v2_ship_submissions SET name='hack'"),/permission denied/)
  })
  await as(gm)
  design=await act('feedback',design.version,{feedback:'Please add a cockpit'})
  design=await act('request_changes',design.version,{feedback:'Revise the plan'})
  await as(player)
  design=await act('save',design.version,{...payload,name:'Revised ship'})
  design=await act('submit',design.version)
  await as(gm)
  await check('GM acceptance verifies exact submission and approved assignments atomically',async()=>{
    const version=design.version
    await assert.rejects(()=>act('accept',version,{submission_version:1,owner_id:player,crew_ids:[]}),/exact submission/)
    await assert.rejects(()=>act('accept',version,{submission_version:design.current_submission,owner_id:pending,crew_ids:[]}),/approved profiles/)
    assert.equal((await db.query('SELECT * FROM v2_ships')).rows.length,0)
    design=await act('accept',version,{submission_version:design.current_submission,owner_id:player,crew_ids:[missing],feedback:'Approved'})
    assert.equal(design.status,'accepted');assert.equal(design.accepted_ship_version,1)
    assert.equal((await db.query('SELECT name FROM v2_ships')).rows[0].name,'Revised ship')
    await assert.rejects(()=>act('accept',version,{}),/changed/)
    await assert.rejects(()=>db.exec("UPDATE v2_ships SET name='bypass'"),/versioned/)
    await assert.rejects(()=>db.exec('DELETE FROM v2_ships'),/versioned/)
    await db.query('INSERT INTO v2_ship_gm_notes(ship_id,notes) VALUES($1,$2)',[design.accepted_ship_id,'GM SECRET'])
  })
  await as(missing)
  await check('assigned crew reads playable copy but never author draft/history',async()=>{
    assert.equal((await db.query('SELECT * FROM v2_ships')).rows.length,1)
    for(const t of ['v2_ship_designs','v2_ship_submissions','v2_ship_review_events','v2_ship_gm_notes'])assert.equal((await db.query('SELECT * FROM '+t)).rows.length,0)
  })
  await as(player)
  design=await act('revise',design.version)
  design=await act('save',design.version,{...payload,name:'Next edition'})
  design=await act('submit',design.version)
  design=await act('withdraw',design.version)
  await check('revision/withdrawal preserve accepted ship and immutable submissions',async()=>{
    assert.equal((await db.query('SELECT name FROM v2_ships')).rows[0].name,'Revised ship')
    assert.equal((await db.query('SELECT name FROM v2_ship_submissions ORDER BY version LIMIT 1')).rows[0].name,'Private design')
    assert.equal(JSON.stringify((await db.query('SELECT * FROM v2_ship_review_events')).rows).includes('GM SECRET'),false)
  })
  design=await act('submit',design.version)
  await as(gm)
  design=await act('accept',design.version,{submission_version:design.current_submission,owner_id:player,crew_ids:[]})
  await check('replacement increments playable version and preserves separate GM notes',async()=>{
    assert.equal(design.accepted_ship_version,2)
    assert.equal((await db.query('SELECT notes FROM v2_ship_gm_notes')).rows[0].notes,'GM SECRET')
    assert.equal((await db.query("SELECT count(*)::int AS n FROM v2_ship_review_events WHERE action='accept'")).rows[0].n,2)
  })

  await as(player)
  design=await act('revise',design.version)
  const decorated=structuredClone(plan);decorated.appearance={hull_color:'#123456',accent_color:'#abcdef',engine_color:'#ff0000',marking:'none',windows:[]}
  design=await act('save',design.version,{...payload,plan:decorated})
  await check('old-client saves preserve heights and optional appearance',async()=>{
    const old=structuredClone(plan);delete old.decks[0].height_ft
    design=await act('save',design.version,{...payload,plan:old})
    assert.equal(design.plan.decks[0].height_ft,12);assert.equal(design.plan.appearance.hull_color,'#123456')
  })
  design=await act('submit',design.version)
  await db.exec('RESET ROLE')
  await db.query("UPDATE v2_ships SET description='Admin changed live record' WHERE id=$1",[design.accepted_ship_id])
  await as(gm)
  await check('stale playable revision cannot be overwritten and acceptance rolls back',async()=>{
    await assert.rejects(()=>act('accept',design.version,{submission_version:design.current_submission,owner_id:player,crew_ids:[]}),/Playable ship changed/)
    assert.equal((await db.query('SELECT status FROM v2_ship_designs WHERE id=$1',[id])).rows[0].status,'submitted')
    assert.equal((await db.query("SELECT count(*)::int AS n FROM v2_ship_review_events WHERE action='accept'")).rows[0].n,2)
  })
  await check('legacy ships remain editable and client elevated grants are absent',async()=>{
    const legacy='20000000-0000-0000-0000-000000000099'
    await db.query('INSERT INTO v2_ships(id,name,plan) VALUES($1,$2,$3)',[legacy,'Legacy',JSON.stringify(plan)])
    await db.query("UPDATE v2_ships SET name='Legacy edited' WHERE id=$1",[legacy])
    for(const t of ['v2_ship_designs','v2_ship_submissions','v2_ship_review_events'])for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
      assert.equal((await db.query("SELECT has_table_privilege('authenticated',$1,$2) AS allowed",[t,privilege])).rows[0].allowed,false)
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.v2_design_action(uuid,integer,text,jsonb)','EXECUTE') AS allowed")).rows[0].allowed,false)
  })
  await db.exec('RESET ROLE')
  await check('migration rollback removes only new workflow objects and preserves playable rows',async()=>{
    const before=(await db.query('SELECT id,plan,version FROM v2_ships ORDER BY id')).rows
    await db.exec('BEGIN; DROP TRIGGER v2_accepted_ship_guard ON v2_ships; DROP FUNCTION v2_protect_accepted_ship(); DROP FUNCTION v2_design_action(uuid,integer,text,jsonb); DROP TABLE v2_ship_review_events,v2_ship_submissions,v2_ship_designs;')
    assert.deepEqual((await db.query('SELECT id,plan,version FROM v2_ships ORDER BY id')).rows,before)
    await db.exec('ROLLBACK')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM v2_ship_designs')).rows[0].n,1)
  })

  await as(player)
  design=await act('withdraw',design.version)
  const painted=structuredClone(plan);painted.decks[0].rooms=[{id:'room',name:'Room',x:0,y:0,width:4,height:4,notes:''}]
  painted.surface_design={surfaces:[{id:'surface',deck_id:'deck',room_id:'room',face:'floor',color:'#123456',paint:{palette:['#ff0000'],runs:[[1025,4,0],[2049,4,0]]}}],sections:[{id:'section',deck_id:'deck',room_id:'room',side:'front',extension_ft:8,slope:.5,taper:.25,bevel_ft:1}],components:[]}
  design=await act('save',design.version,{...payload,plan:painted})
  await check('paint and shape persist in private draft; omission preserves exact records',async()=>{
    assert.deepEqual(design.plan.surface_design,painted.surface_design)
    const old=structuredClone(painted);delete old.surface_design
    design=await act('save',design.version,{...payload,plan:old});assert.deepEqual(design.plan.surface_design,painted.surface_design)
  })
  await check('malformed paint refs, overlaps, palette indexes, oversized fills and shapes rejected atomically',async()=>{
    for(const mutate of [p=>p.surfaces[0].paint.runs=[[0,50001,0]],p=>p.surfaces[0].paint.runs=[[0,2,0],[1,1,0]],p=>p.surfaces[0].paint.runs=[[0,1,9]],p=>p.surfaces[0].paint.runs=[[0,1.5,0]],p=>p.surfaces[0].paint.palette=['red'],p=>p.surfaces[0].room_id='missing',p=>p.surfaces[0].extra='secret',p=>p.surfaces[0].id='section',p=>p.sections[0].extension_ft=11,p=>p.sections[0].slope=-1,p=>p.sections[0].taper=1,p=>p.sections[0].bevel_ft=3,p=>p.sections.push({...p.sections[0],id:'other'})]){
      const bad=structuredClone(painted);mutate(bad.surface_design);await assert.rejects(()=>act('save',design.version,{...payload,plan:bad}))
    }
    assert.equal((await db.query('SELECT version FROM v2_ship_designs WHERE id=$1',[id])).rows[0].version,design.version)
  })
  await check('old-client room deletion prunes only dependent surface records',async()=>{
    const old=structuredClone(plan);design=await act('save',design.version,{...payload,plan:old});assert.deepEqual(design.plan.surface_design,{surfaces:[],sections:[],components:[]})
  })
  await as(gm)
  await check('legacy GM ship saves preserve paint and helper does not gain anonymous execution',async()=>{
    const legacy='20000000-0000-0000-0000-000000000099'
    await db.query('UPDATE v2_ships SET plan=$1 WHERE id=$2',[JSON.stringify(painted),legacy])
    await db.query("UPDATE v2_ships SET plan=plan-'surface_design' WHERE id=$1",[legacy])
    assert.deepEqual((await db.query('SELECT plan FROM v2_ships WHERE id=$1',[legacy])).rows[0].plan.surface_design,painted.surface_design)
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.v2_ship_check_surfaces(jsonb)','EXECUTE') AS allowed")).rows[0].allowed,false)
  })

  await check('accepted painted snapshot stays immutable while a new painted draft is edited',async()=>{
    const paintedId='20000000-0000-0000-0000-000000000088'
    await as(player);let next=await act('create',0,{...payload,plan:painted},paintedId)
    next=await act('submit',next.version,{},paintedId);await as(gm)
    next=await act('accept',next.version,{submission_version:next.current_submission,owner_id:player,crew_ids:[]},paintedId)
    const live=(await db.query('SELECT plan FROM v2_ships WHERE id=$1',[next.accepted_ship_id])).rows[0].plan
    assert.deepEqual(live.surface_design,painted.surface_design)
    await assert.rejects(()=>db.query("UPDATE v2_ships SET plan=plan-'surface_design' WHERE id=$1",[next.accepted_ship_id]),/versioned/)
    await assert.rejects(()=>db.query("UPDATE v2_ship_submissions SET plan=plan-'surface_design' WHERE design_id=$1",[paintedId]),/permission denied/)
    await as(player);next=await act('revise',next.version,{},paintedId)
    const changed=structuredClone(painted);changed.surface_design.surfaces[0].paint.palette[0]='#00ff00'
    next=await act('save',next.version,{...payload,plan:changed},paintedId)
    assert.deepEqual((await db.query('SELECT plan FROM v2_ships WHERE id=$1',[next.accepted_ship_id])).rows[0].plan,live)
    const huge=structuredClone(painted);huge.decks[0].rooms[0].notes='x'.repeat(2200000)
    await assert.rejects(()=>act('save',next.version,{...payload,plan:huge},paintedId),/Invalid design action|Invalid ship plan/)
    assert.equal((await db.query('SELECT version FROM v2_ship_designs WHERE id=$1',[paintedId])).rows[0].version,next.version)
  })

  const openingPlan=structuredClone(painted);openingPlan.decks.push({...structuredClone(painted.decks[0]),id:'lower',rooms:[{...painted.decks[0].rooms[0],id:'lower-room'}]})
  openingPlan.connections=[{id:'opening',name:'Cargo opening',kind:'lift',from_deck:'deck',to_deck:'lower',from:{x:1,y:1},to:{x:1,y:1},aperture:{width:2,height:2,ladder_part_id:null}}]
  const openId='20000000-0000-0000-0000-000000000077';let openingDesign
  await as(player)
  await check('hole-only openings persist and old-client draft omission preserves their metadata',async()=>{
    openingDesign=await act('create',0,{...payload,plan:openingPlan},openId)
    const old=structuredClone(openingPlan);delete old.connections[0].aperture
    openingDesign=await act('save',openingDesign.version,{...payload,plan:old},openId);assert.deepEqual(openingDesign.plan.connections[0].aperture,openingPlan.connections[0].aperture)
  })
  await check('invalid apertures, floor coverage, ladder references and conflicting deck alignments fail atomically',async()=>{
    for(const mutate of [p=>p.connections[0].aperture=null,p=>p.connections[0].aperture.width=0,p=>p.connections[0].aperture.width=1.5,p=>p.connections[0].aperture.height=101,p=>p.connections[0].aperture.extra=true,p=>delete p.connections[0].aperture.ladder_part_id,p=>p.connections[0].aperture.ladder_part_id='missing',p=>p.connections[0].from.x=3,p=>p.connections[0].to.x=.5,p=>p.decks[1].rooms=[],p=>p.decks.splice(1,0,{...structuredClone(p.decks[1]),id:'middle',rooms:[]}),p=>p.connections.push({...structuredClone(p.connections[0]),id:'conflicting',to:{x:2,y:1}})]){
      const bad=structuredClone(openingPlan);mutate(bad);await assert.rejects(()=>act('save',openingDesign.version,{...payload,plan:bad},openId))
    }
    assert.equal((await db.query('SELECT version FROM v2_ship_designs WHERE id=$1',[openId])).rows[0].version,openingDesign.version)
  })
  await check('ladder is an independent anchored fixture; deletion through an old client removes traversal only',async()=>{
    const withLadder=structuredClone(openingPlan);withLadder.parts.push({id:'ladder',name:'Cargo ladder',deck_id:'deck',room_id:'room',x:1,y:1,type:'Ladder',quantity:1,quality:'Store-bought',condition:'Working',black_market:false,notes:''});withLadder.connections[0].aperture.ladder_part_id='ladder'
    openingDesign=await act('save',openingDesign.version,{...payload,plan:withLadder},openId)
    const moved=structuredClone(withLadder);moved.parts[0].x=2;await assert.rejects(()=>act('save',openingDesign.version,{...payload,plan:moved},openId))
    const old=structuredClone(openingPlan);delete old.connections[0].aperture
    openingDesign=await act('save',openingDesign.version,{...payload,plan:old},openId);assert.equal(openingDesign.plan.connections[0].aperture.ladder_part_id,null)
  })
  await check('accepted openings stay frozen until GM acceptance of a subsequent revision',async()=>{
    openingDesign=await act('submit',openingDesign.version,{},openId);await as(gm)
    openingDesign=await act('accept',openingDesign.version,{submission_version:openingDesign.current_submission,owner_id:player,crew_ids:[]},openId)
    const live=(await db.query('SELECT plan FROM v2_ships WHERE id=$1',[openingDesign.accepted_ship_id])).rows[0].plan;assert.deepEqual(live.connections[0].aperture,openingPlan.connections[0].aperture)
    await assert.rejects(()=>db.query('UPDATE v2_ships SET plan=$1 WHERE id=$2',[JSON.stringify(painted),openingDesign.accepted_ship_id]),/versioned/)
    await as(player);openingDesign=await act('revise',openingDesign.version,{},openId);const changed=structuredClone(openingPlan);changed.connections[0].aperture.width=1
    openingDesign=await act('save',openingDesign.version,{...payload,plan:changed},openId);assert.deepEqual((await db.query('SELECT plan FROM v2_ships WHERE id=$1',[openingDesign.accepted_ship_id])).rows[0].plan,live)
  })
  await check('opening helpers reject anonymous execution; pending writes denied; legacy ship omission preserved',async()=>{
    for(const signature of ['public.v2_ship_check_openings(jsonb)','public.v2_ship_merge_openings(jsonb,jsonb)'])assert.equal((await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') allowed",[signature])).rows[0].allowed,false)
    await as(pending);await assert.rejects(()=>act('create',0,{...payload,plan:openingPlan},'20000000-0000-0000-0000-000000000076'),/Approved/)
    await as(gm);const legacy='20000000-0000-0000-0000-000000000099';await db.query('UPDATE v2_ships SET plan=$1 WHERE id=$2',[JSON.stringify(openingPlan),legacy]);const old=structuredClone(openingPlan);delete old.connections[0].aperture
    await db.query('UPDATE v2_ships SET plan=$1 WHERE id=$2',[JSON.stringify(old),legacy]);assert.deepEqual((await db.query('SELECT plan FROM v2_ships WHERE id=$1',[legacy])).rows[0].plan.connections[0].aperture,openingPlan.connections[0].aperture)
  })
  // Direct RPC calls bypass the outer save validator, including for pending users.
  const validate=p=>db.query('SELECT public.v2_ship_check_openings($1)',[p===null?null:JSON.stringify(p)])
  const merge=(p,prior)=>db.query('SELECT public.v2_ship_merge_openings($1,$2) AS plan',[p===null?null:JSON.stringify(p),prior===null?null:JSON.stringify(prior)])
  const invalid=[
    ['SQL null',()=>null], ['array root',()=>[]], ['missing collections',()=>({schema_version:1})],
    ['null decks',p=>({...p,decks:null})],['nonarray parts',p=>({...p,parts:{}})],
    ['wrong version',p=>({...p,schema_version:2})],['document bytes',p=>({...p,padding:'x'.repeat(2000000)})],
    ['21 decks',p=>({...p,decks:Array.from({length:21},(_,i)=>({...p.decks[0],id:'d'+i}))})],
    ['2001 parts',p=>({...p,parts:Array.from({length:2001},(_,i)=>({id:'p'+i}))})],
    ['201 connections',p=>({...p,connections:Array.from({length:201},(_,i)=>({...p.connections[0],id:'c'+i}))})],
    ['501 rooms',p=>{p.decks[0].rooms=Array.from({length:501},()=>p.decks[0].rooms[0]);return p}],
    ['2001 marks',p=>{p.decks[0].marks=Array.from({length:2001},()=>({}));return p}],
    ['null rooms',p=>{p.decks[0].rooms=null;return p}],
    ['duplicate deck IDs',p=>{p.decks[1].id=p.decks[0].id;return p}],
    ['duplicate connection IDs',p=>{p.connections.push(structuredClone(p.connections[0]));return p}],
    ['duplicate part IDs',p=>({...p,parts:[{id:'same'},{id:'same'}]})],
    ['missing ID',p=>{delete p.decks[0].id;return p}],
    ['long ID',p=>{p.decks[0].id='x'.repeat(101);return p}],
    ['huge deck width',p=>{p.decks[0].width=1000000000;return p}],
    ['negative endpoint',p=>{p.connections[0].from.x=-1;return p}],
    ['huge endpoint',p=>{p.connections[0].from.x=1000000000;return p}],
    ['fractional endpoint',p=>{p.connections[0].from.x=.5;return p}],
    ['missing endpoint',p=>{delete p.connections[0].from;return p}],
    ['missing endpoint deck',p=>{p.connections[0].from_deck='unknown';return p}],
    ['huge room geometry',p=>{p.decks[0].rooms[0].width=1000000000;return p}],
  ]
  for(const [label,user] of [['approved',player],['pending',pending]]){
    await as(user)
    await check(`${label} direct helpers accept valid plans and exact insert sentinel`,async()=>{
      await validate(openingPlan)
      assert.deepEqual((await merge(openingPlan,{decks:[]})).rows[0].plan,openingPlan)
      assert.deepEqual((await merge(openingPlan,openingPlan)).rows[0].plan,openingPlan)
    })
    await check(`${label} direct helpers reject all ${invalid.length} invalid inputs in validator and both merge arguments`,async()=>{
      for(const [name,mutate] of invalid){
        const bad=mutate(structuredClone(openingPlan))
        await assert.rejects(()=>validate(bad),name+' validator')
        await assert.rejects(()=>merge(bad,openingPlan),name+' proposed')
        await assert.rejects(()=>merge(openingPlan,bad),name+' prior')
      }
      await assert.rejects(()=>merge(plan,{decks:[],connections:[]}))
      await assert.rejects(()=>merge({decks:[]},plan))
    })
    await check(`${label} merge rejects combined output above 2MB despite each input fitting`,async()=>{
      const near=structuredClone(openingPlan);delete near.connections[0].aperture
      const bytes=(await db.query('SELECT octet_length($1::jsonb::text) n',[JSON.stringify(near)])).rows[0].n
      near.decks[0].rooms[0].notes='x'.repeat(2000000-bytes-1)
      await validate(near);await validate(openingPlan)
      await assert.rejects(()=>merge(near,openingPlan),/Invalid bounded opening document/)
    })
  }
  await as(player)
  await check('document and collection upper bounds stay usable without expanding authorization',async()=>{
    const limit=structuredClone(plan)
    limit.decks=Array.from({length:20},(_,i)=>({...structuredClone(plan.decks[0]),id:'d'+i}))
    limit.decks[0].rooms=Array.from({length:500},(_,i)=>({id:'r'+i,x:0,y:0,width:1,height:1}))
    limit.decks[0].marks=Array.from({length:2000},(_,i)=>({id:'m'+i}))
    limit.parts=Array.from({length:2000},(_,i)=>({id:'p'+i}))
    limit.connections=Array.from({length:200},(_,i)=>({id:'c'+i,from_deck:'d0',to_deck:'d1',from:{x:0,y:0},to:{x:0,y:0}}))
    await validate(limit);await merge(limit,limit)
    // Legacy integral string geometry remains accepted; no new numeric encoding requirement.
    const legacy=structuredClone(plan);legacy.decks[0].width='4';await validate(legacy)
  })
  await check('bounded floor coverage handles unions, overlaps, missing cells and maximum rectangles',async()=>{
    const union=structuredClone(openingPlan)
    for(const [i,d] of union.decks.entries())d.rooms=[{id:'top'+i,x:0,y:0,width:4,height:2},{id:'bottom'+i,x:0,y:2,width:4,height:2}]
    await validate(union)
    union.decks[1].rooms[1].y=3;await assert.rejects(()=>validate(union),/Opening must fit/)
    union.decks[1].rooms[1].y=1;await validate(union)
    const maximum=structuredClone(openingPlan)
    for(const d of maximum.decks){d.width=100;d.height=100;d.rooms[0].width=100;d.rooms[0].height=100}
    maximum.connections[0].from={x:0,y:0};maximum.connections[0].to={x:0,y:0}
    maximum.connections[0].aperture.width=100;maximum.connections[0].aperture.height=100
    await validate(maximum)
  })
  await as(null,'anon')
  await check('direct anonymous helper RPCs remain denied despite explicit default grants',async()=>{
    await assert.rejects(()=>validate(plan),/permission denied/)
    await assert.rejects(()=>merge(plan,plan),/permission denied/)
  })
  await as(player)
  await check('UI-only rollback: old payload preserves revised openings and frozen accepted/submitted records',async()=>{
    const liveBefore=(await db.query('SELECT * FROM v2_ships WHERE id=$1',[openingDesign.accepted_ship_id])).rows
    const frozenBefore=(await db.query('SELECT * FROM v2_ship_submissions WHERE design_id=$1 ORDER BY version',[openId])).rows
    const prior=structuredClone(openingDesign.plan),old=structuredClone(prior);delete old.connections[0].aperture
    openingDesign=await act('save',openingDesign.version,{...payload,plan:old},openId)
    assert.deepEqual(openingDesign.plan,prior)
    assert.deepEqual((await db.query('SELECT * FROM v2_ships WHERE id=$1',[openingDesign.accepted_ship_id])).rows,liveBefore)
    assert.deepEqual((await db.query('SELECT * FROM v2_ship_submissions WHERE design_id=$1 ORDER BY version',[openId])).rows,frozenBefore)
    const incompatible=structuredClone(old);incompatible.decks[1].rooms=[]
    await assert.rejects(()=>act('save',openingDesign.version,{...payload,plan:incompatible},openId),/Opening must fit/)
    assert.deepEqual((await db.query('SELECT plan FROM v2_ship_designs WHERE id=$1',[openId])).rows[0].plan,prior)
  })
  await db.exec('RESET ROLE')
  await check('reapplying hardened functions after saved openings preserves every campaign workflow row',async()=>{
    const tables=['v2_ships','v2_ship_gm_notes','v2_ship_designs','v2_ship_submissions','v2_ship_review_events']
    const records=async()=>Promise.all(tables.map(t=>db.query(`SELECT to_jsonb(t) row FROM ${t} t ORDER BY to_jsonb(t)::text`).then(r=>r.rows)))
    const before=await records();await db.exec(openingMigration);assert.deepEqual(await records(),before)
  })
  console.log(`${passed} design workflow checks passed; in-memory PostgreSQL only.`)
} finally {await db.close()}
