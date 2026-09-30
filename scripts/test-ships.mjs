// Real PostgreSQL (PGlite), isolated in memory. Never connects to Supabase.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createRequire } from 'node:module'

// Compile the pure model modules in memory: no build artifacts or extra runtime.
const require = createRequire(import.meta.url)
const modelCache = new Map()
function model(name) {
  if (modelCache.has(name)) return modelCache.get(name)
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  new Function('exports', 'require', code)(exports, id => id.startsWith('./') ? model(id.slice(2)) : require(id))
  modelCache.set(name, exports)
  return exports
}
const { instantiateTemplate } = model('ship-templates')
const { validatePlan, movePart, removeRoom, removeDeck, QUALITIES, partFootprint } = model('ships')
let passed = 0
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`) }
const fighter = instantiateTemplate('fighter'), freighter = instantiateTemplate('freighter')
check('exterior template components have bounded footprints, paired wing boosters and aft engines', () => {
  for (const plan of [fighter, freighter]) for (const p of plan.parts) {
    const d = plan.decks.find(d => d.id === p.deck_id), size = partFootprint(p.type)
    assert.ok(p.x + size.width <= d.width && p.y + size.height <= d.height)
    if (size.width > 1) assert.equal(p.room_id, null)
  }
  const wings = fighter.parts.filter(p => p.type.endsWith('wing'))
  const boosters = fighter.parts.filter(p => p.type === 'Booster')
  assert.equal(wings.length, 2); assert.equal(boosters.length, 2)
  for (const wing of wings) assert.equal(boosters.filter(b => b.x >= wing.x && b.x + 2 <= wing.x + 4 && b.y >= wing.y && b.y + 3 <= wing.y + 5).length, 1)
  const rear = freighter.parts.filter(p => p.type === 'Booster')
  assert.equal(rear.length, 3)
  for (const b of rear) assert.ok(freighter.decks.find(d => d.id === b.deck_id).rooms.every(r => r.y + r.height <= b.y))
  const moved = movePart(fighter, wings[0].id, fighter.decks[0], { x: 100, y: 100 }).parts.find(p => p.id === wings[0].id)
  assert.equal(moved.x, fighter.decks[0].width - 4); assert.equal(moved.y, fighter.decks[0].height - 5)
})
check('both templates validate and copies have independent IDs', () => {
  assert.equal(validatePlan(fighter), null); assert.equal(validatePlan(freighter), null)
  const other = instantiateTemplate('freighter')
  assert.notEqual(other.decks[0].id, freighter.decks[0].id)
  other.parts[0].name = 'Changed'; assert.notEqual(other.parts[0].name, freighter.parts[0].name)
  assert.equal(other.connections[0].from_deck, other.decks[0].id)
  assert.equal(other.parts[0].room_id, other.decks[0].rooms[0].id)
})
check('quality excludes Black Market and fixture moves update room/deck', () => {
  assert.equal(QUALITIES.includes('Black Market'), false)
  const moved = movePart(freighter, freighter.parts[0].id, freighter.decks[1], { x: 3, y: 3 })
  assert.equal(moved.parts[0].room_id, freighter.decks[1].rooms[0].id)
  assert.equal(moved.parts[0].quality, 'Store-bought')
  assert.equal(validatePlan(moved), null)
})
check('deleting rooms/decks cleans dependent links, keeps final deck', () => {
  const noRoom = removeRoom(fighter, fighter.parts[0].room_id)
  assert.equal(noRoom.parts[0].room_id, null); assert.equal(validatePlan(noRoom), null)
  const noDeck = removeDeck(freighter, freighter.decks[0].id)
  assert.equal(noDeck.connections.length, 0); assert.deepEqual(noDeck.parts, freighter.parts.filter(p => p.deck_id !== freighter.decks[0].id))
  assert.equal(validatePlan(noDeck), null); assert.equal(removeDeck(noDeck, noDeck.decks[0].id).decks.length, 1)
})

const db = new PGlite()
const gm = '10000000-0000-0000-0000-000000000001', owner = '10000000-0000-0000-0000-000000000002', crew = '10000000-0000-0000-0000-000000000003', stranger = '10000000-0000-0000-0000-000000000004'
const id = '20000000-0000-0000-0000-000000000001', second = '20000000-0000-0000-0000-000000000002'
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  -- Reproduce Supabase's explicit anon defaults, not just PostgreSQL's PUBLIC grant.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE TABLE profiles(id uuid PRIMARY KEY, username text, role text, avatar_url text, created_at timestamptz DEFAULT now());
  REVOKE ALL ON profiles FROM PUBLIC, anon, authenticated;
  GRANT SELECT, UPDATE ON profiles TO authenticated;
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY profiles_read ON profiles FOR SELECT TO authenticated USING (true);
  CREATE POLICY profiles_self_edit ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  INSERT INTO profiles(id,username,role) VALUES ('${gm}', 'GM', 'gm'), ('${owner}', 'Owner', 'player'), ('${crew}', 'Crew', 'player'), ('${stranger}', 'Stranger', 'player');`)
const profileMigration = readFileSync(new URL('../sql/v2_006_profile_update_columns.sql', import.meta.url), 'utf8')
await db.exec(profileMigration); await db.exec(profileMigration)
const migration = readFileSync(new URL('../sql/v2_005_ships.sql', import.meta.url), 'utf8')
await db.exec(migration); await db.exec(migration)
console.log('PASS migration applies and is rerunnable'); passed++
async function as(user, role = 'authenticated') {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
  await db.exec(`SET ROLE ${role}`)
}
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`) }
async function save(shipId, version, plan = freighter, notes = 'GM SECRET', shipOwner = owner, shipCrew = [crew]) {
  return (await db.query('SELECT * FROM v2_save_ship($1,$2,$3,$4,$5,$6,$7,$8)', [shipId, version, 'Test ship', 'Public description', shipOwner, shipCrew, JSON.stringify(plan), notes])).rows[0]
}
try {
  await test('explicit anon default grants are revoked on both ship entry functions', async () => {
    for (const signature of ['public.v2_ship_is_gm()', 'public.v2_save_ship(uuid,integer,text,text,uuid,uuid[],jsonb,text)']) {
      const { rows } = await db.query("SELECT has_function_privilege('anon', $1, 'EXECUTE') AS anon_execute, has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated_execute", [signature])
      assert.equal(rows[0].anon_execute, false, `${signature} must deny anon even with explicit default grants`)
      assert.equal(rows[0].authenticated_execute, true, `${signature} must remain callable by authenticated users`)
    }
  })
  await test('ship table/helper privileges are deliberately bounded despite broad defaults', async () => {
    for (const table of ['public.v2_ships', 'public.v2_ship_gm_notes']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES']) {
        const { rows } = await db.query("SELECT has_table_privilege('authenticated', $1, $2) AS member, has_table_privilege('anon', $1, $2) AS anon", [table, privilege])
        assert.equal(rows[0].member, ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(privilege), `${table} ${privilege}`)
        assert.equal(rows[0].anon, false)
      }
      const version = Number((await db.query("SHOW server_version_num")).rows[0].server_version_num)
      if (version >= 170000) assert.equal((await db.query("SELECT has_table_privilege('authenticated', $1, 'MAINTAIN') AS allowed", [table])).rows[0].allowed, false)
    }
    for (const [signature, authExpected] of [['public.v2_ship_check_plan(jsonb)', true], ['public.v2_ship_before_write()', false]]) {
      const { rows } = await db.query("SELECT has_function_privilege('anon', $1, 'EXECUTE') AS anon, has_function_privilege('authenticated', $1, 'EXECUTE') AS member", [signature])
      assert.equal(rows[0].anon, false); assert.equal(rows[0].member, authExpected)
    }
    assert.equal((await db.query("SELECT prosecdef FROM pg_proc WHERE oid = 'public.v2_ship_is_gm()'::regprocedure")).rows[0].prosecdef, false)
  })
  await as(owner)
  await test('profile role/id/created_at updates fail while self username/avatar edits succeed', async () => {
    await assert.rejects(() => db.query("UPDATE profiles SET role='gm' WHERE id=$1", [owner]), /permission denied/)
    await assert.rejects(() => db.query('UPDATE profiles SET id=id WHERE id=$1', [owner]), /permission denied/)
    await assert.rejects(() => db.query('UPDATE profiles SET created_at=now() WHERE id=$1', [owner]), /permission denied/)
    const { rows } = await db.query('UPDATE profiles SET username=$1, avatar_url=$2 WHERE id=$3 RETURNING username,avatar_url,role', ['Renamed', 'https://example.invalid/avatar.png', owner])
    assert.deepEqual(rows[0], { username: 'Renamed', avatar_url: 'https://example.invalid/avatar.png', role: 'player' })
    assert.equal((await db.query("UPDATE profiles SET username='no' WHERE id=$1 RETURNING id", [crew])).rows.length, 0)
    assert.equal((await db.query('SELECT public.v2_ship_is_gm() AS gm')).rows[0].gm, false)
  })
  await as(gm)
  await test('GM atomic create persists decks, links, assignments and private notes', async () => {
    const ship = await save(id, 0)
    assert.equal(ship.version, 1); assert.deepEqual(ship.plan, freighter)
    assert.equal((await db.query('SELECT notes FROM v2_ship_gm_notes')).rows[0].notes, 'GM SECRET')
    await save(second, 0, fighter, 'OTHER SECRET', null, [])
  })
  for (const user of [owner, crew]) {
    await as(user)
    await test(`${user === owner ? 'owner' : 'crew'} reads only assigned ship and no private notes`, async () => {
      const rows = (await db.query('SELECT * FROM v2_ships')).rows
      assert.equal(rows.length, 1); assert.equal(rows[0].id, id); assert.deepEqual(rows[0].plan, freighter)
      assert.equal(JSON.stringify(rows).includes('GM SECRET'), false)
      assert.equal((await db.query('SELECT * FROM v2_ship_gm_notes')).rows.length, 0)
    })
    await test('assigned player cannot save, insert, update, delete, self-assign or write notes', async () => {
      await assert.rejects(() => save(id, 1), /GM access required/)
      await assert.rejects(() => db.query('INSERT INTO v2_ships(name,plan) VALUES ($1,$2)', ['bad', JSON.stringify(fighter)]), /row-level security/)
      assert.equal((await db.query("UPDATE v2_ships SET name='hacked' WHERE id=$1 RETURNING id", [id])).rows.length, 0)
      assert.equal((await db.query('DELETE FROM v2_ships WHERE id=$1 RETURNING id', [id])).rows.length, 0)
      assert.equal((await db.query('UPDATE v2_ships SET owner_id=$1 WHERE id=$2 RETURNING id', [user, second])).rows.length, 0)
      await assert.rejects(() => db.query('INSERT INTO v2_ship_gm_notes VALUES ($1,$2)', [second, 'injected']), /row-level security/)
      assert.equal((await db.query("UPDATE v2_ship_gm_notes SET notes='hacked' RETURNING ship_id")).rows.length, 0)
      assert.equal((await db.query('DELETE FROM v2_ship_gm_notes RETURNING ship_id')).rows.length, 0)
    })
  }
  await as(stranger)
  await test('unassigned player cannot read guessed ship IDs or notes', async () => {
    assert.equal((await db.query('SELECT * FROM v2_ships WHERE id=$1', [id])).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM v2_ship_gm_notes')).rows.length, 0)
    await assert.rejects(() => save(id, 1), /GM access required/)
  })
  await as(null, 'anon')
  await test('anonymous reads and save RPC are denied', async () => {
    await assert.rejects(() => db.query('SELECT public.v2_ship_is_gm()'), /permission denied/)
    await assert.rejects(() => db.query('SELECT * FROM v2_ships'), /permission denied/)
    await assert.rejects(() => db.query('SELECT * FROM v2_ship_gm_notes'), /permission denied/)
    await assert.rejects(() => save(id, 1), /permission denied/)
  })
  await as(gm)
  await test('save/reload, stale revisions and failed writes are atomic', async () => {
    const edited = structuredClone(freighter); edited.parts[0].quality = 'Exotic'; edited.parts[0].black_market = true; edited.parts[0].condition = 'Damaged'
    assert.equal((await save(id, 1, edited, 'UPDATED SECRET')).version, 2)
    await assert.rejects(() => save(id, 1, fighter, 'STALE'), /another session/)
    await assert.rejects(() => save(id, 2, fighter, 'x'.repeat(50001)), /check constraint/)
    const ship = (await db.query('SELECT * FROM v2_ships WHERE id=$1', [id])).rows[0]
    assert.equal(ship.version, 2); assert.deepEqual(ship.plan, edited)
    assert.equal((await db.query('SELECT notes FROM v2_ship_gm_notes WHERE ship_id=$1', [id])).rows[0].notes, 'UPDATED SECRET')
  })
  await test('database rejects broken links, invalid quality, geometry and injected private fields', async () => {
    for (const mutate of [
      p => { p.parts[0].quality = 'Black Market' }, p => { p.parts[0].room_id = 'missing' },
      p => { p.parts[0].x = 999 }, p => { p.connections[0].to_deck = 'missing' },
      p => { p.decks[0].rooms[0].width = -1 }, p => { p.decks[0].rooms[0].id = p.decks[0].id },
      p => { p.gm_notes = 'secret' }, p => { p.parts[0].quantity = 1.5 },
    ]) { const bad = structuredClone(freighter); mutate(bad); await assert.rejects(() => save(id, 2, bad)) }
    await assert.rejects(() => save(id, 2, freighter, '', owner, ['99999999-0000-0000-0000-000000000000']), /Crew/)
  })
  await test('revoking both owner and crew removes access immediately', async () => {
    await save(id, 2, freighter, 'PRIVATE', null, [])
    for (const user of [owner, crew]) { await as(user); assert.equal((await db.query('SELECT * FROM v2_ships')).rows.length, 0) }
  })
  await as(gm)
  await test('deleting a ship cascades only its own GM notes', async () => {
    await db.query('DELETE FROM v2_ships WHERE id=$1', [id])
    assert.equal((await db.query('SELECT * FROM v2_ship_gm_notes WHERE ship_id=$1', [id])).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM v2_ships WHERE id=$1', [second])).rows.length, 1)
  })
  console.log(`\n${passed} ship model/database checks passed.`)
} finally { await db.close() }
