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
  console.log(`${passed} design workflow checks passed; in-memory PostgreSQL only.`)
} finally {await db.close()}
