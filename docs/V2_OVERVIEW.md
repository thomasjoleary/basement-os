# Basement OS v2 — Overview

A **second campaign system** (space setting) built alongside the existing D&D
app, not a replacement. The legacy app stays live and untouched.

For in-world fiction — jump drives, stars, places — see
[V2_SETTING.md](./V2_SETTING.md).

---

## Status

| Piece | State |
|---|---|
| `/v2` GM-gated shell | Built |
| Galaxy map + system authoring | Built |
| System builder (stars, planets, moons, stations) | Built |
| Player-facing view | Not started (RLS policies already written for it) |
| Ships & components | Not started |
| Ground maps for planets | Not started |
| 3D system view | Not started (`z` already stored, no migration needed) |

## Ground rules

**Data separation.** Every v2 table is prefixed `v2_`. Logins are shared
(`auth.users` / `profiles`), so the same account works in both versions, but no
legacy query can reach v2 data and vice versa.

**Access.** `/v2` and everything under it is GM-only — the same
`getSession → profiles.role === 'gm' → redirect` pattern used by `/words` and
`/leaderboard`. It isn't linked from the legacy home page.

**Eventually** `/v2` becomes the post-login home page, with a button back to the
old one.

---

## Setup

Run in the Supabase SQL editor, in order:

1. `sql/v2_001_galaxy.sql` — required. Creates the tables, RLS policies and
   realtime publication. Safe to re-run.
2. `sql/v2_002_galaxy_seed.sql` — optional sample galaxy. Deletable; see the
   header comment in the file.

Then visit `/v2` → **Galaxy Map**. Until step 1 is done the page shows a
"migration hasn't been applied" banner rather than a blank screen.

---

## Data model

| Table | Purpose |
|---|---|
| `v2_star_systems` | Map nodes: `name`, `x`/`y`/`z` in light-years, `description`, `gm_notes`, `discovered`, `tags` |
| `v2_system_bodies` | Everything inside a system — self-nesting via `parent_id` |
| `v2_galaxy_settings` | Singleton (`id = 1`) holding `galaxy_name` |

### The body hierarchy

This is the core design decision. `v2_system_bodies.parent_id` is a
self-referencing foreign key with `ON DELETE CASCADE`:

- `parent_id IS NULL` → orbits the system barycentre (a star, or a free-floating
  station)
- otherwise → orbits that body

One pointer gives arbitrary depth. A moon is just a body whose parent is a
planet; a station orbiting a moon of a gas giant is four levels down. `kind` is
`star | planet | moon | station | belt`, and `body_class` indexes into the
matching list in `lib/galaxy.ts`.

**Deleting a body deletes everything orbiting it.** The editor warns with a
descendant count first, but the cascade is enforced at the database level.

### Coordinates

`x`/`y`/`z` are light-years. The map is top-down and ignores `z` today — it's
stored so a future 3D view needs no migration.

### Mass and orbits

`mass_solar` is in **solar masses for every body**, so Kepler's third law stays
uniform:

```
P(years) = √( a(AU)³ ÷ M(solar masses) )
```

Verified against Jupiter: 5.2 AU around 1 M☉ → 11.86 years.

The editor displays planets and moons in **Earth masses** and converts on save
(1 M☉ = 332,946 M⊕). `orbital_period_days` is an optional override — when null,
the period is derived from the parent's mass.

### Jump time

```
charge_hours + (distance_ly ÷ speed_ly_per_hour)
```

**Not database-backed.** Charge time and speed belong to the ship and its
components, so they live in `DRIVE_PROFILES` (`lib/galaxy.ts`) and will
eventually be read off a ship record. The map's drive picker is a GM estimating
tool and persists nothing.

> Note: `v2_galaxy_settings` still has unused `jump_charge_hours` /
> `jump_speed_ly_per_hour` columns from the original migration. Nothing reads
> them; they were left rather than forcing another migration.

---

## RLS

GMs manage everything. Players get read-only access to `discovered` systems and
the bodies within them; settings are readable by any authenticated user.

The player policies ship now even though the builder is GM-only, so the future
player view needs no migration.

**Verified** against a local PostgreSQL 16 cluster with stubbed `auth.uid()` and
`profiles`: the migration applies cleanly, is re-runnable, cascades correctly
four levels deep, and the player policies hold (reads limited to discovered,
writes rejected). Not verified against the live Supabase project — worth a
sanity check with a real player account.

⚠️ **`gm_notes` is readable by players** on discovered systems under the current
policy. Keep genuine secrets out of that column until it's locked down.

---

## Key files

| File | What |
|---|---|
| `app/v2/page.tsx` | v2 home shell (GM-gated) |
| `app/v2/galaxy/page.tsx` | Galaxy map: system CRUD, search, measure, settings |
| `app/v2/galaxy/[id]/page.tsx` | System builder: body tree, inspector, orbit schematic |
| `components/galaxy/GalaxyMap.tsx` | The galaxy canvas (pan/zoom/pinch, spiral backdrop, measure) |
| `lib/galaxy.ts` | Types, star/planet/station classes, distance + jump math, Kepler, hierarchy helpers |
| `sql/v2_001_galaxy.sql` | Migration (run manually) |
| `sql/v2_002_galaxy_seed.sql` | Optional sample galaxy |

---

## Ideas not yet built

- **Hyperlanes.** Jumps are currently any-to-any. A `v2_hyperlanes` table would
  restrict travel to fixed routes, which makes chokepoints and blockades
  possible.
- **Ships & components**, carrying the jump drive stats described above.
- **Player view** of the galaxy, gated on `discovered`.
- **3D system view** — `react-three-fiber`, lazy-loaded so it never touches the
  bundle for other pages.
- **Ground maps** for planet surfaces.
