# Ships and deck plans

Ships are a GM-authored map and inventory system, not a combat, flight or power
simulation. `/v2/ships` is available from the existing home page and the v2 home.
GMs see all ships; players see only ships they own or are assigned to as crew.

## Enable

1. Apply `sql/v2_005_ships.sql` in the intended Supabase environment after the
   existing `profiles` table exists. It is transactional and rerunnable. It does
   not alter the galaxy, characters or their existing access policies.
   Also apply the separately approved `sql/v2_006_profile_update_columns.sql`:
   authenticated users retain username/avatar updates under existing self-row
   RLS, but cannot change their role, ID or creation timestamp.
2. Run `npm ci`, `npm run test:ships`, and `npx tsc --noEmit` locally. Browser
   checks: `npx playwright install chromium`, then `npm run test:ships:ui`.
3. Start the app with its usual Supabase environment variables. Visit
   `/v2/ships` as a GM, create a ship, and assign owner/crew in the Ship tab.
   Save, then verify visibility using a separate assigned-player account.

No migration is applied automatically by the app. Missing storage produces an
actionable error. Development tests never require production credentials.

## Editing

- New ship offers a blank plan, Compact fighter or Freighter. Each template
  creates an independent ship with fresh IDs and no owner, crew or private notes.
  Creating another copy never replaces an existing campaign ship.
- Choose a deck or add one (1–20 decks; each 4–100 cells per dimension). Grid
  cells intentionally have no invented physical scale or movement rules.
- Drag to draw rectangular rooms. Their outlines are perimeter walls. Use Wall
  and Door to draw horizontal/vertical segments on grid edges; Label adds text.
  Overlapping rooms are rejected by the drawing tool.
- Fixture places a component at a cell. Select and drag it, or change its deck
  and coordinates in Inspect. Room membership follows its location. Inventory
  lists components across all decks and opens the corresponding inspector.
- Components track name, type, quantity, room/position, quality, physical
  condition and public notes. Quality is ordered: **Junk, Secondhand,
  Store-bought, Outfitted, Specialized, Exotic**. **Black Market** is a separate
  potentially-criminal provenance tag, never a quality tier. Condition is
  separately Working, Worn, Damaged or Broken. No numeric modifiers are used.
- Connect decks adds stairs or a lift with an endpoint on each of two decks.
  Inspect edits endpoint cells and destination. Players can follow connections
  or use the deck selector directly.
- Save ship commits the entire plan, assignments and GM notes atomically.
  Discard changes restores the last saved version. Leaving via Back to ships or
  closing/reloading the tab warns about unsaved work. Escape cancels a drawing
  gesture. A save failure preserves the draft; stale revisions cannot overwrite
  another GM's save (reload after retaining any desired edits separately).
- Deleting a room unlinks its components without deleting them. Deleting a
  deck requires confirmation and removes its rooms, components and connections.
  The last deck cannot be deleted. Changes remain local until Save ship.

The fighter has a cockpit, bunk cabin, toilet and engineering area with control,
propulsion, power and life support. The freighter has a crew deck (cockpit,
bedroom, kitchen, washroom, stores) and a cargo deck (hold and engineering),
connected by a lift, with basic equipment. These are layouts, not ship stats.

## Data and permissions

`v2_ships` stores metadata, owner profile, crew profile IDs, revision and a
versioned JSON `plan`: decks contain rooms/marks; parts reference decks/rooms;
connections reference two deck endpoints. This bounded document makes a whole
edit atomic and avoids partial deck/fixture saves. Database triggers validate
geometry, reference integrity, IDs, quality and condition, and existing crew
profiles. The app performs matching validation before sending.

`v2_ship_gm_notes` is a separate GM-only table with a cascading ship foreign key.
There are no private-note fields on player-readable ship records. All room,
component and ship description fields are **public to assigned readers**.

All policies explicitly target `authenticated`. Only GMs can insert, update or
delete either table. Owner/crew get SELECT on their ships; other players get no
rows. Anonymous table access and anonymous save RPC execution are revoked.
`v2_save_ship` uses invoker permissions, checks GM role, locks the row, checks the
expected revision, and updates the ship and private notes in one transaction.
The UI never requests the private-notes table for a player. Authorization does
not rely on the hidden editing controls or the client-side role check.
The GM helper is security-invoker. Both exposed entry functions explicitly
revoke `PUBLIC` and `anon` execution, including direct Supabase default grants.
Ship-table grants are reset before granting authenticated CRUD only (no
TRUNCATE/TRIGGER/REFERENCES/MAINTAIN). The validator is callable by authenticated
saves; the trigger function is not callable by either API role.

There is no realtime subscription yet; readers reload to see changes. Revoked
access is enforced on subsequent database requests. Like any already-rendered
page, a previously loaded plan can remain visible until navigation/reload.
Ships use account profiles for owner/crew; they do not migrate old characters.

## Tests and boundaries

- `scripts/test-ships.mjs`: real PostgreSQL through an isolated in-memory PGlite
  instance. Applies the actual migration twice; tests GM CRUD, owner/crew reads,
  outsider/anon denial, player write/self-assignment denial, private-note
  isolation, revocation, optimistic concurrency, transaction rollback, invalid
  plans, template copies, fixture movement and dependent deletion behavior.
  Supabase roles and `auth.uid()` are reproduced locally. This is not a check of
  any deployed Supabase project's migration state or unrelated profile policies.
- `tests/ships/editor.spec.ts`: runs the real Next.js UI in Chromium with a
  mocked local Supabase transport. Exercises creation, repeated actions,
  cancellation, drawing, movement, tags, deck switching/connections, save/reload,
  errors/conflicts, player inspection, blocked routes and mobile layout. These
  UI mocks are not the security proof; the PostgreSQL suite supplies that.
- Existing live-account character tests remain separate and need their existing
  credentials. Ship tests do not run them or contact production.

The existing galaxy GM-note issue is deliberately unchanged. No ship combat,
power budgets, damage simulation, hyperlane rules or drive modifiers are added.

## Local verification — 2026-09-30

- `npm run test:ships`: 18 model/database checks passed, including explicit
  anonymous function defaults, broad table defaults and approved profile-column
  restrictions. The anonymous-grant regression failed before the correction.
- `npm run test:ships:ui`: all 7 Chromium scenarios passed. After visual spacing
  and label adjustments, the 3 affected template/player/mobile scenarios passed
  again. Both templates and mobile inspection screenshots were visually reviewed.
- `npx tsc --noEmit`, focused ESLint on all new ship code/tests plus the v2
  entry page, and `git diff --check` passed.
- `npm run build` passed using dummy local backend values; nothing was deployed.
- Whole-repository lint still reports 161 errors and 20 warnings in existing
  code. The touched legacy home page has the same 8 errors/1 warning as its
  original version. Unrelated lint cleanup is not included.
- Production database state and live-account end-to-end tests were not checked.
  Local screenshots are in ignored `test-results/`; they are not hosted links.
