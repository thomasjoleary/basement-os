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
  await check('migration preflight rejects an unreviewed public bucket atomically',async()=>{
    await db.exec("INSERT INTO storage.buckets VALUES('unexpected',true)")
    await assert.rejects(()=>db.exec(migration),/Public storage buckets/);await db.exec('ROLLBACK')
    assert.equal((await db.query("SELECT to_regnamespace('registration_private') IS NULL AS absent")).rows[0].absent,true)
    await db.exec('DELETE FROM storage.buckets')
  })
  await db.exec(migration)
  await check('existing accounts retain role and approved access',async()=>{
    const rows=(await db.query('SELECT id,role,approval_status FROM profiles ORDER BY id')).rows
    assert.deepEqual(rows,[{id:gm,role:'gm',approval_status:'approved'},{id:player,role:'player',approval_status:'approved'}])
  })
  await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",[pending,'pending@example.invalid',JSON.stringify({username:'Applicant',role:'gm',approval_status:'approved',approved_by:gm})])
  await check('signup metadata cannot grant role or approval; rerun preserves pending',async()=>{
    await db.exec(migration)
    assert.deepEqual((await db.query('SELECT role,approval_status,approved_by,approved_at FROM profiles WHERE id=$1',[pending])).rows[0],{role:'player',approval_status:'pending',approved_by:null,approved_at:null})
  })
  for(const [id,role,label] of [[pending,'authenticated','pending'],[missing,'authenticated','missing profile'],[null,'anon','anonymous']]){
    await as(id,role)
    await check(`${label} cannot read or write campaign tables/storage or call privileged RPCs`,async()=>{
      for(const t of [...tables,'v2_ships','v2_ship_gm_notes','storage.objects']){
        try{assert.equal((await db.query(`SELECT * FROM ${t}`)).rows.length,0,t)}catch(e){if(e.code!=='42501')throw e}
      }
      await assert.rejects(()=>db.query('SELECT public.get_player_battlefield($1)',[gm]),/approval required|permission denied/)
      await assert.rejects(()=>db.query('SELECT public.bf_can_see_vitals($1,$2)',[gm,gm]),/permission denied/)
      await assert.rejects(()=>db.query('SELECT registration_private.get_player_battlefield($1)',[gm]),/permission denied/)
      await assert.rejects(()=>db.query('SELECT public.approve_registration($1)',[pending]),/GM access required|permission denied/)
      await assert.rejects(()=>db.query('SELECT * FROM public.list_registration_requests()'),/GM access required|permission denied/)
      await assert.rejects(()=>db.exec(`INSERT INTO characters VALUES('${missing}','injected')`),/row-level security/)
      assert.equal((await db.exec("UPDATE characters SET payload='hacked'"))[0].affectedRows,0)
      await assert.rejects(()=>db.exec('TRUNCATE characters'),/permission denied/)
      assert.equal((await db.query('SELECT * FROM realtime.messages')).rows.length,0)
      await assert.rejects(()=>db.exec(`INSERT INTO realtime.messages VALUES('${missing}','broadcast')`),/row-level security/)
    })
  }
  await as(pending)
  await check('pending sees own profile/status only; protected edits and profile upserts fail',async()=>{
    assert.deepEqual((await db.query('SELECT id FROM profiles')).rows,[{id:pending}])
    assert.deepEqual((await db.query('SELECT campaign_access_status() AS status')).rows[0].status,{status:'pending',is_gm:false})
    await db.exec("UPDATE profiles SET username='Renamed',avatar_url='avatar' WHERE id=auth.uid()")
    for(const expression of ["approval_status='approved'","role='gm'",'approved_by=auth.uid()',"approved_at=now()"])
      await assert.rejects(()=>db.exec(`UPDATE profiles SET ${expression} WHERE id=auth.uid()`),/permission denied/)
    await assert.rejects(()=>db.exec(`INSERT INTO profiles(id,role,approval_status) VALUES('${pending}','gm','approved') ON CONFLICT(id) DO UPDATE SET approval_status='approved'`),/permission denied/)
    await assert.rejects(()=>db.exec('DELETE FROM profiles WHERE id=auth.uid()'),/permission denied/)
    await assert.rejects(()=>db.exec('SELECT public.handle_new_user()'),/permission denied/)
    await assert.rejects(()=>db.exec('SELECT * FROM registration_private.rollback_steps'),/permission denied/)
  })
  await as(player)
  await check('approved player retains prior reads/RPC and cannot approve or impersonate a viewer',async()=>{
    assert.equal((await db.query('SELECT * FROM characters')).rows.length,1)
    assert.equal((await db.query('SELECT * FROM profiles')).rows.length,3)
    assert.equal((await db.query('SELECT get_player_battlefield($1) AS view',[gm])).rows[0].view.secret,'battlefield content')
    await assert.rejects(()=>db.query('SELECT bf_can_see_vitals($1,$2)',[gm,gm]),/permission denied/)
    await assert.rejects(()=>db.query('SELECT approve_registration($1)',[pending]),/GM access required/)
    assert.equal((await db.query('SELECT * FROM realtime.messages')).rows.length,1)
    await db.query("SELECT set_config('realtime.topic',$1,false)",[`bf-ping-${gm}`])
    await db.exec(`INSERT INTO realtime.messages VALUES('${player}','broadcast')`)
    await assert.rejects(()=>db.exec(`INSERT INTO realtime.messages VALUES('${missing}','presence')`),/row-level security/)
  })
  await as(gm)
  await check('only approved GM lists requests and approval persists idempotently',async()=>{
    assert.equal((await db.query('SELECT * FROM list_registration_requests()')).rows[0].id,pending)
    assert.equal((await db.query('SELECT approve_registration($1) AS approved',[pending])).rows[0].approved,true)
    assert.equal((await db.query('SELECT approve_registration($1) AS approved',[pending])).rows[0].approved,false)
    assert.equal((await db.query('SELECT approved_by FROM profiles WHERE id=$1',[pending])).rows[0].approved_by,gm)
    await as(pending);assert.equal((await db.query('SELECT * FROM characters')).rows.length,1)
  })
  await db.exec('RESET ROLE')
  await check('publication suppresses DELETE/TRUNCATE while keeping INSERT/UPDATE',async()=>{
    assert.deepEqual((await db.query("SELECT pubinsert,pubupdate,pubdelete,pubtruncate FROM pg_publication WHERE pubname='supabase_realtime'")).rows[0],{pubinsert:true,pubupdate:true,pubdelete:false,pubtruncate:false})
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname='registration_campaign_gate' AND permissive='RESTRICTIVE'")).rows[0].n,22)
  })
  await check('rollback restores original function access/publication and removes gate cleanly',async()=>{
    await db.exec(readFileSync(new URL('../sql/rollback_v2_007_registration_approval.sql',import.meta.url),'utf8'))
    assert.equal((await db.query("SELECT to_regnamespace('registration_private') IS NULL AS gone")).rows[0].gone,true)
    assert.equal((await db.query("SELECT pubdelete AND pubtruncate AS restored FROM pg_publication WHERE pubname='supabase_realtime'")).rows[0].restored,true)
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.bf_can_see_vitals(uuid,uuid)','EXECUTE') AS restored")).rows[0].restored,true)
  })
  console.log(`\n${passed} registration permission checks passed. GraphQL/WebSocket protocol behavior requires deployed connector verification.`)
}finally{await db.close()}
