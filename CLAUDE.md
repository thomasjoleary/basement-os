# basement-os — Project Reference for Claude

## What is this?
A D&D campaign management web app. The GM runs the game; players view and interact with their own character sheets. Hosted on Vercel.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Auth + RLS)

---

## Database: `characters` table

Key columns:
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles.id`; null = unclaimed/public |
| `name` | text | |
| `level` | int | 1–10 |
| `xp_current` / `xp_max` | int | XP bar |
| `hp_current` / `hp_max` | int | |
| `mana_current` / `mana_max` | int | |
| `stats` | jsonb | `{ strength, speed, fortitude, magic, ...custom }` |
| `skills` | jsonb | `[{ name: string, level: number }]` |
| `abilities` | jsonb | `[{ name, rarity, description, level, type, power_level }]` |
| `inventory` | jsonb | `[{ name, rarity, description, quantity, unit, plural_name, power_level }]` — `quantity` is a string (supports fractions like `"1/8"`); `power_level` is per-unit (leaderboard multiplies by qty) |
| `money` | jsonb | `{ copper, silver, gold }` |
| `stat_buffs` | jsonb | Tame buffs received (not base stats) |
| `is_tame` | bool | Tame characters have no XP/level system |
| `is_dead` | bool | Dead characters appear in the Graveyard; dead tames are excluded from PL calc |
| `is_npc` | bool | |
| `is_active` | bool | For tames: whether buff is active (only active tames contribute to PL) |
| `player_name` | text | For tames: links to owner character's name |
| `job` | text | For tames: job starts with owner's first name |
| `tame_class` | text | Tame display |
| `species` | text | Tame display |
| `tags` | text[] | |
| `pending_levelup` | jsonb | Multi-user level-up state machine (see below) |

**`profiles` table:** `id` (uuid, FK → auth.users), `username`, `role` (`'gm'` or `'player'`)

**RLS policies:** GMs can do everything. Players can SELECT all characters, and UPDATE their own character row (needed for level-up allocation submission).

---

## Game Rules

### Stats
Four base stats: `strength`, `speed`, `fortitude`, `magic`. GMs can add custom stats.

### HP Max Formula
`level × (25 + floor(fortitude / 10))`

### XP Max Table
| Level | XP to reach next |
|---|---|
| 1 | 50 |
| 2 | 250 |
| 3 | 1,250 |
| 4 | 6,250 |
| 5 | 30,000 |
| 6 | 100,000 |
| 7 | 500,000 |
| 8 | 2,000,000 |
| 9 | 10,000,000 |
| 10 | 50,000,000 |

### Skills
- Max level: 10
- Cost to go from level L to L+1: `2^L` points (e.g. Lv1→2 costs 2, Lv2→3 costs 4, Lv9→10 costs 512)

---

## Level-Up System

### Flow (multi-user, 3-step)
1. **GM initiates** — rolls `(newLevel × 5)d10`, enters total, saves to `pending_levelup` with `status: 'player_allocating'`
2. **Player allocates** — spends points, submits for review; saved with `status: 'player_submitted'`
3. **GM reviews** — can modify allocation, then confirms; applies all changes and clears `pending_levelup`

GM can cancel at any point, which nulls `pending_levelup`.

### Point Allocation Options
| Action | Cost |
|---|---|
| +1 to any stat | 1 pt |
| +1 mana max | 2 pts |
| Create new skill (starts at Lv 1) | 10 pts |
| Level up skill Lv L → L+1 | `2^L` pts |
| Level up a newly-created skill | Same exponential cost on top of the 10 pt creation cost |

### On Confirm
- `level` → `newLevel`
- `xp_current` → 0, `xp_max` → lookup table value for newLevel
- `hp_max` → recalculated from formula (using post-delta fortitude), `hp_current` → `hp_max` (full heal)
- `mana_max` → old + gain, `mana_current` → `mana_max` (full restore)
- Skills updated, new skills added at their final level
- `pending_levelup` → null

### `pending_levelup` JSON Shape
```json
{
  "status": "player_allocating" | "player_submitted",
  "new_level": 3,
  "points_total": 47,
  "stat_deltas": { "strength": 5, "fortitude": 3 },
  "mana_gain": 2,
  "new_skills": [{ "name": "Herbalism", "level": 2 }],
  "skill_level_ups": [1, 0, 2]
}
```
`skill_level_ups` is a parallel array to `char.skills` — index i = levels added to skills[i].

---

## Tame System
- Tames are characters with `is_tame: true`
- Linked to a player character via `player_name == char.name` OR `job ILIKE 'FirstName%'`
- Active tames (`is_active: true`) apply their `stat_buffs` to the linked player's displayed stats
- Only **active, non-dead** tames count toward a player's Power Level
- `tame_class` and `species` are set at creation and editable on the sheet
- GM can mark a tame dead via the ☠️ button in the Tame Buffs section — automatically deactivates it and moves it to the graveyard
- Ownership of tames cascades when the GM reassigns a player character

---

## Leaderboard

- Route: `app/leaderboard/page.tsx` — GM-only; non-GMs are redirected to `/`
- Linked from the home page nav (GM section only)
- Excludes tames (`is_tame: true`) and NPCs (`is_npc: true`)
- Categories are defined in the `CATEGORIES` array at the top of the file — adding a new one requires a single entry there

| Group | Category | Notes |
|---|---|---|
| Stats | Strength, Speed, Fortitude, Magic | From `stats` jsonb |
| Level & XP | Level | Sorted by level; XP used as tiebreaker; both displayed per row |
| Currency | Currency | Sorted by Gold → Silver → Copper; all three shown color-coded per row |
| Words | Words of Power | Count from `character_words` join table |
| Power | Power Level | Calculated score; expandable breakdown per player; GM-only |
| Likeability | Likeability | GM drag-and-drop ordering; stored in Supabase auth user metadata |

### Power Level Formula
```
(level × 100) + sumPL(abilities) + sumItemPL(inventory) + sum(stats) + (mana_max × 5)
  + sum(skill.level × 50) + (wordManaCostTotal × 25) + sum(activeTamePowerLevels)
```
- `sumPL(abilities)` — sum of `power_level` fields on each ability
- `sumItemPL(inventory)` — sum of `power_level × quantity` per item; `quantity` supports fractions (`"1/8"`)
- Only **active, non-dead** tames are included
- Tame own PL = `sumPL(abilities) + sum(stats) + (mana_max × 5)`

### Default Power Levels by Rarity
**Abilities:** Common 50 · Uncommon 100 · Rare 200 · Very Rare 350 · Legendary 500 · Holy 750 · Unique 1000 · Demonic 750

**Inventory items:** Common 0 · Uncommon 50 · Rare 100 · Very Rare 200 · Legendary 400 · Holy 600 · Unique 1000 · Demonic 600

Power level auto-fills when rarity is set; only overrides if the current value is still at a rarity default.

### Published Leaderboard
- GM can publish selected categories to players with an optional expiry (1h / 4h / 8h / 24h / 3d / 1w / Permanent)
- Stored in the `published_leaderboard` singleton table (`id = 1`)
- Players see only published, non-expired categories; empty state shown otherwise
- SQL migration: `sql/add_published_leaderboard.sql`

---

## Battlefield (tactical combat grid)

A per-encounter tactical map of 5ft squares. GM authoring + **player fog-of-war view** (Phase 2) are both built.

- Route: `app/battlefields/page.tsx` (list + create) · `app/battlefields/[id]/page.tsx` (editor + player view)
- Grid renderer: `components/battlefield/BattlefieldGrid.tsx` (pan/zoom/pinch, token drag, marquee multi-select, resize handles, measure, movement-range, stacking, fog display + fog painting)
- Types/constants: `lib/battlefield.ts`
- SQL migrations (applied to the live Supabase project; run in order on a fresh environment): `sql/005_create_battlefields.sql`, `sql/006_battlefield_presets.sql`, `sql/007_battlefield_visibility.sql`

### Data model
- **`battlefields`**: `cols`/`rows` (size in 5ft squares, 1–100), `bg_color`, `border_type` (`'indoor'`|`'outdoor'` — border styling so players know where they can flee), `round`, `turn_entity_id` (whose turn), `is_archived`, `updated_at`. **No `gm_notes` column** — `007` moved it into `battlefield_gm_notes` so the `battlefields` row holds no private data and players can safely read it / receive realtime pings.
- **`battlefield_entities`**: `kind` (`player`|`tame`|`enemy`|`object`|`wall`|`door`), `character_id` (nullable link to `characters`), `x`/`y`/`width`/`height` (in squares), `color`, `icon`, `hp/mana_current/max` (manual — used for enemies), `move_ft`, `conditions` (jsonb string[]), `initiative`, `hidden_until_revealed` (fog), `notes` (GM-private per token)
- **`battlefield_gm_notes`** (GM-only): `battlefield_id` PK + `notes` — where GM notes actually live (edited via the Notes tab, `patchGmNotes`)
- Realtime publication: `battlefields`, `battlefield_entities`, `battlefield_presets`, `battlefield_visibility`. A DB trigger touches `battlefields.updated_at` on any entity/visibility/reveal change — that bump is the player-refresh ping. The GM editor also subscribes to `characters` UPDATEs for live vitals.

### Behavior
- **HP/mana**: player/tame tokens are `character_id`-linked and read **live** from the character sheet (`resolveVitals()` in `lib/battlefield.ts`); enemies/objects use their own manual `hp/mana_*` fields
- Multiple creatures can share a square — `BattlefieldGrid` fans/shrinks stacked creature tokens (mounts, tiny creatures)
- Extras: initiative/turn tracker (`round` + `turn_entity_id`, "Next turn" wraps and increments round), toggleable status conditions (`CONDITIONS` in `lib/battlefield.ts`), distance measure + movement-range highlight (5e "every square = 5ft", `move_ft`)
- **Damage/Heal** (`applyHp`) in Inspect: linked tokens write to the character sheet's `hp_current` (clamped 0..max, stays live); enemies/manual write to the token. No auto-death.
- **Ping** (📍 tool, GM + players): Supabase realtime **broadcast** on channel `bf-ping-<id>` (no DB) → transient `animate-ping` ring at the tapped square for everyone viewing
- **Duplicate** (Setup panel): clones the battlefield + entities + GM notes into a new row (fog/visibility/reveals start fresh) — serves as "save as template"
- Walls/doors/objects are cell-based tokens (v1 simplification — not edge-drawn)
- Linked from home nav (all roles). GMs see all battlefields in the list; players see only ones shared with them (via `battlefield_visibility.granted`, enforced by RLS)

### Tools & layout
- Floating toolbar tools: **select** (↖️), **pan** (✋), **measure** (📏, GM), **ping** (📍), **fog** (🌫️, GM). Marquee needs left-drag so pan is its own tool; middle/right-mouse-drag pans in any tool; one-finger drag pans on touch
- **select tool**: drag empty space = marquee multi-select (shift adds); drag a token = move it (dragging one of a multi-selection moves the whole group, formation-clamped); drag the amber handles on a single selected token = resize; **Delete/Backspace** removes the selection, **Esc** clears it. Any tap on a token selects just it and opens Inspect (`onInspect`). Selection is `selectedIds: string[]`; Inspect shows a single-token editor or a bulk panel (recolor / delete N) when several are selected
- **Panels** (Add / Inspect / Turns / Fog / Setup / Notes): on **desktop** via the always-visible right side panel's tab row; on **mobile** via a single **☰** button in the toolbar that opens a bottom sheet with the same tab row. The floating toolbar carries only grid tools so it stays compact on phones

### Presets (`battlefield_presets`, GM-only, `sql/006`)
- `preset_kind='character_default'` — one saved token look (size/color/icon/speed) per character, keyed by `character_id`; **auto-applied** when that character/tame is placed. Saved from the linked token's Inspect panel ("Save as … default"). ★ in the Add list marks characters that have one
- `preset_kind='enemy'` — reusable enemy tokens grouped by `folder`, shown as the **Enemy Library** at the bottom of the Add panel (click to place). Created via "Save as enemy preset" on an enemy's Inspect panel; saving with an existing name+folder overwrites that preset
- Both flavours live in one table; realtime-synced

### Phase 2 — player visibility & fog of war (`sql/007`)
- **Security model:** players never read `battlefield_entities` directly. They call the `SECURITY DEFINER` RPC **`get_player_battlefield(bf)`**, which returns only tokens overlapping their revealed squares (and not hidden-until-revealed-to-them), and **redacts HP/mana** of anything they don't own. GMs keep full direct-table access.
- **Vitals rule** — shared SQL predicate **`bf_can_see_vitals(target_id, viewer)`**: a viewer sees a character's HP/mana iff GM, own character (`user_id`), own tame (name/job link), or an **NPC in one of their parties**. Reused by the RPC; intended to also back an app-wide redaction later (currently only the battlefield enforces it — the home page already hides other players' living characters entirely).
- **Tables:** `battlefield_visibility` (per player character: `granted` + `visible_cells` `["x,y"]`), `battlefield_entity_reveals` (per-player reveal of a hidden token), `battlefield_gm_notes` (GM notes **moved off** the `battlefields` row so players can safely read it / receive realtime pings).
- **Realtime:** a trigger touches `battlefields.updated_at` on any entity/visibility/reveal change; players subscribe to their `battlefields` row + `battlefield_visibility` + `characters` and **re-call the RPC** (no leak in payloads). GM uses direct-table subscriptions.
- **GM UI:** **Fog** tab (share toggle per player, Paint fog / Reveal all / Hide all, 👁️ Preview-as-player) + **fog tool** (🌫️) with a reveal/hide × rectangle/brush sub-toolbar. Per-token "Hidden until revealed" + per-player reveal live in Inspect. Tokens default to visible in a revealed square.
- **Player view:** same `[id]` route, branches on role — read-only, fogged (blacked-out outside `visible_cells`), pan/look/ping only. Tapping a visible token opens a read-only card (`PlayerTokenCard`) with its name/kind/conditions; HP/mana bars + a character-sheet link appear only when the RPC returned vitals (own character + tames + party NPCs) — privacy stays server-enforced.
- Grid fog/ping props: `fogDisplay` (`'none'|'player'|'edit'`), `fogVisibleCells`, `hiddenEntityIds`, `fogReveal`, `fogShape`, `onPaintCells`, `pings`, `onPing`.

### Related privacy behavior
- App-wide HP/mana redaction beyond the battlefield was deliberately **not** done. Instead, `app/character/[id]/page.tsx` auto-redirects a non-GM to `/` when they open a character sheet whose `user_id` is set and isn't theirs (`router.replace('/')`). The leaderboard intentionally shows everyone's stats.

---

# Basement OS v2 (space setting) — in progress

**Docs:** `docs/V2_OVERVIEW.md` (status, setup, data model, open ideas) and `docs/V2_SETTING.md` (in-world fiction: jump drives, stars). Keep those current alongside this file.

A **second campaign system** being built alongside the D&D one, not a replacement. The legacy app stays live and untouched; v2 shares the same site and the same logins (`auth.users` / `profiles`), but **all of its data lives in `v2_`-prefixed tables** so no legacy query can ever see it.

- Route root: `app/v2/page.tsx` — GM-gated shell (non-GM → alert + redirect to `/`), same pattern as `/words` and `/leaderboard`. Not linked from the legacy home page; reachable only by typing `/v2`.
- Eventually `/v2` becomes the post-login home page, with a button back to the old one.

## v2 Galaxy Map

A GM authoring tool for the campaign's star map. Systems are nodes positioned in **light-years**; ships jump between them and the map computes travel time.

### Tables (`sql/v2_001_galaxy.sql`)
| Table | Purpose |
|---|---|
| `v2_star_systems` | Map nodes: `name`, `x`/`y`/`z` (light-years), `description`, `gm_notes`, `discovered`, `tags` |
| `v2_system_bodies` | Everything inside a system, **self-nesting** via `parent_id` |
| `v2_galaxy_settings` | Singleton (`id = 1`): `galaxy_name`. (Its `jump_charge_hours` / `jump_speed_ly_per_hour` columns are **dead** — see Travel time.) |

**`z` is stored but unused** by the current top-down map — it exists so a future 3D view needs no migration.

### The body hierarchy (the core design)
`v2_system_bodies.parent_id` is a self-referencing FK with `ON DELETE CASCADE`:
- `parent_id IS NULL` → orbits the system barycentre (i.e. a star, or a free-floating station)
- otherwise → orbits that body

That single pointer is what makes moons moons: a moon is just a body whose parent is a planet, and a station orbiting a moon of a gas giant is three levels deep. `kind` is one of `star | planet | moon | station | belt`; `body_class` indexes into the matching class list in `lib/galaxy.ts`.

**Deleting a body deletes everything orbiting it** (DB-level cascade) — the editor warns with a descendant count before confirming.

### Travel time
`jump time = charge_hours + (distance_ly ÷ speed_ly_per_hour)`

A fixed drive spin-up plus cruise time, so short hops are relatively costlier.

**These are NOT database-backed.** Jump performance is a property of the ship and its components, not the galaxy, so it lives in `DRIVE_PROFILES` / `JumpDrive` in `lib/galaxy.ts` and will eventually be read off a ship record. The galaxy map's drive picker is a GM estimating tool that persists nothing. The two matching columns left in `v2_galaxy_settings` are unused (kept rather than forcing another migration).

Drive design follows the setting's fiction — long charge "sharpens" the jump so it cuts cleanly (low power); a near-zero-charge "hammer drive" punches through by force (high power). See `docs/V2_SETTING.md`.

### Orbital mechanics
Kepler's third law in solar units: **`P(years) = √(a(AU)³ ÷ M(solar masses))`** — verified against Jupiter (5.2 AU, 1 M☉ → 11.86 years).

`mass_solar` is stored in **solar masses for every body** so this math stays uniform; the editor displays planets/moons in Earth masses and converts on save (1 M☉ = 332,946 Earth masses). `orbital_period_days` is an optional override — when null, the period is derived from the parent's mass via `resolvePeriodDays()`.

### Star classification (real astronomy)
`STAR_CLASSES` in `lib/galaxy.ts` uses **real stellar classification under approachable labels** ("Yellow Star" for G-type, "Red Dwarf" for M-type), each carrying its real spectral type, temperature/mass/radius/luminosity ranges, and abundance.

Colours are **Mitchell Charity blackbody values** (CIE 1931, sRGB/D65) — the same table planetarium software uses. Note O/B stars are **blue-white, not saturated blue**: blackbody chromaticity converges to pale blue-white as temperature rises, so no thermal starlight is ever deeply blue.

Includes the remnants — white dwarf, neutron star, pulsar, **black hole**. A black hole has no photosphere, so `isLightless()` is true for it and temperature/luminosity readouts are suppressed rather than printed as zeros. `schwarzschildRadiusKm()` gives its event horizon (2.95 km per solar mass).

### Habitable zones
The system builder shades where liquid water is possible (toggle in the diagram header; only shown when a **star** is at the centre of the view). Edges use the **Kopparapu et al. (2013/2014)** polynomial — conservative = runaway→maximum greenhouse, optimistic = recent Venus→early Mars. Verified against the Sun (0.981–1.689 AU) and TRAPPIST-1 (0.025–0.049 AU). The fit is valid 2600–7200 K; outside that the UI flags the edges as rough.

**Luminosity is derived, not stored**: main-sequence stars use the Eker et al. (2018) mass–luminosity relation (valid 0.179–31 M☉); giants/remnants fall back to the class luminosity range, since that relation is main-sequence-only.

`STAR_HABITABILITY` in `lib/galaxy.ts` holds the per-class verdict on whether that *kind* of star could host life at all (lifetime, UV, flares, tidal locking) — a separate question from where its zone falls. Planets show a zone verdict + tidal-lock warning in the inspector and a 🌱 in the tree; moons are judged at their planet's distance from the star. See `docs/V2_SETTING.md`.

### Habitability & settlement scores (`sql/v2_003`)
**Two scores per world, deliberately separate** — they answer different questions and routinely disagree (Mars: 8/100 habitability, but a strong sealed-habitat colony):
- `habitabilityScore(body, ctx)` — unprotected surface survival, 0–100. Weights: breathable air 35 (uses **oxygen partial pressure**, not percentage) · temperature/zone 20 · water 15 · gravity 12 · climate stability 12 · radiation shelter 6.
- `settlementRating(body, ctx, habitability)` — can a tech species build here? Everything except gravity is a cost, since pressure/temperature/air/radiation can all be walled off. **Gravity is asymmetric**: above 1.8 g is a hard blocker (`orbital-only`), below 0.3 g is only a caveat yielding the `outpost` tier — a lunar-style base is viable and low gravity makes launch/construction cheaper; only a multi-generational population is doubtful. Partial gravity has never been tested on humans, so that floor is a game convention, not a measured threshold.

**Hard limits are ceilings, not deductions** — otherwise a vacuum world in a perfect orbit coasts to a high score on the factors it passes. Below the Armstrong limit (0.0618 atm) caps at 8; toxic/corrosive air 12; unbreathable 25; gravity outside 0.3–1.8 g caps at 30.

Trait columns are **all nullable**, falling back to `CLASS_TRAIT_DEFAULTS` via `resolveTraits(body)` so an unedited world still scores. Gravity, oxygen partial pressure and equilibrium temperature are derived, never stored.

Three deliberate choices against the pop-science version: **magnetosphere is a minor modifier, never a gate** (Venus counterexample; polar-wind escape); **axial tilt is weighted low** (the large-moon obliquity claim was revised in 2012); **tidal locking is not treated as fatal** (substellar cloud feedback). See `docs/V2_SETTING.md`.

### RLS
GMs manage everything. Players get **read-only access to `discovered` systems only** (and the bodies within them); settings are readable by any authenticated user so players can see travel times. The player policies are written but the builder is GM-only today — they exist so the future player view needs no migration.

**Verified against a local PostgreSQL 16 cluster** with stubbed `auth.uid()`/`profiles`: the migration applies cleanly, is re-runnable, cascades correctly, and the player policies hold (read limited to discovered, writes rejected). Not yet verified against the live Supabase project.

## Key Files
- `app/v2/page.tsx` — v2 home shell (GM-gated)
- `app/v2/galaxy/page.tsx` — galaxy map: systems as nodes, create/drag/measure, settings + nearest-neighbour panel
- `app/v2/galaxy/[id]/page.tsx` — system builder: hierarchical body tree, inspector, orbit schematic
- `components/galaxy/GalaxyMap.tsx` — the galaxy canvas (pan/zoom/pinch, procedural spiral backdrop, measure tool)
- `lib/galaxy.ts` — v2 galaxy types, star/planet/station classes, distance + jump-time math, Kepler helpers, hierarchy helpers (`childrenOf`, `descendantsOf`, `wouldCycle`)
- `sql/v2_001_galaxy.sql` — v2 galaxy migration (**run manually in the Supabase SQL editor**)
- `app/character/[id]/page.tsx` — the main character sheet page (everything: view, edit, level-up modal, power level display)
- `app/leaderboard/page.tsx` — leaderboard (GM: all categories + publish panel; players: published categories only)
- `app/create/page.tsx` — new character creation form (includes tame_class/species fields for tames)
- `app/battlefields/[id]/page.tsx` — battlefield editor (GM) + fogged read-only view (players); orchestrates all panels, mutations, realtime, and the fog/ping/damage-heal/duplicate logic
- `components/battlefield/BattlefieldGrid.tsx` — the grid canvas (pan/zoom/pinch, token drag, marquee, resize, measure, movement-range, stacking, fog display + painting, pings)
- `lib/battlefield.ts` — battlefield types, constants (`ENTITY_KINDS`, `CONDITIONS`, colors), and helpers (`resolveVitals`, `entityName`, `footprintVisible`, distance)
- `sql/005_create_battlefields.sql` / `sql/006_battlefield_presets.sql` / `sql/007_battlefield_visibility.sql` — battlefield migrations (see the Battlefield section)
- `sql/add_pending_levelup.sql` — migration: `pending_levelup` column + player UPDATE RLS policy
- `sql/add_published_leaderboard.sql` — migration: `published_leaderboard` singleton table with RLS
- `sql/character_words_leaderboard_read.sql` — migration: allows all authenticated users to read `character_words` (needed for leaderboard)
- `lib/supabase.ts` — Supabase client

## UI Notes
- Only GMs can edit character sheets (`canEdit = isGM`)
- Players can only see their own character's level-up allocation button
- The level-up modal is an IIFE inside the JSX; `AllocationUI` is defined as a `const` inside it and must be called as `AllocationUI()` (not `<AllocationUI />`) to avoid React unmounting it on every keystroke
- Tailwind 4 is in use — avoid any Tailwind features that require the compiler (use core utility classes only)
- Inventory and ability descriptions support `[Title](url)` markdown link syntax, rendered via `renderDescription()` in `app/character/[id]/page.tsx`
- Power level is displayed in the character sheet header (below HP/Mana/XP bars) via `calcPowerLevel()` in `app/character/[id]/page.tsx`
- `formatItemDisplay(item)` renders inventory items as `[qty] [unit] [name/plural_name]`
