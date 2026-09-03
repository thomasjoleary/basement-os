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
3. `sql/v2_003_habitability.sql` — required for habitability scoring. Adds the
   per-world trait columns. Additive and safe to re-run.
4. `sql/v2_004_rls_scope_authenticated.sql` — **only if you applied `v2_001`
   before it was patched.** Rescopes the RLS policies to `authenticated`; see
   [RLS](#rls). Harmless to run either way.

Optionally then `sql/v2_rls_verify.sql`, which reports PASS/FAIL for the policies
and rolls back without changing anything.

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

### Habitable zones

The system builder shades the band where liquid water is possible, toggled from
the diagram header. It only appears when a **star** is at the centre of the view
— focused on a gas giant the rings are moons measured from the planet, where a
stellar zone would be meaningless.

Edges come from the **Kopparapu et al. (2013/2014)** parameterisation, the
standard in the literature:

```
S_eff = S_eff0 + a·T + b·T² + c·T³ + d·T⁴     where T = Teff − 5780 K
d_AU  = sqrt( (L / L☉) / S_eff )
```

- **Conservative zone** (the solid band): runaway greenhouse → maximum greenhouse.
- **Optimistic zone** (the faint band): recent Venus → early Mars.
- Verified against the Sun (0.981–1.689 AU) and TRAPPIST-1 (0.025–0.049 AU),
  both matching published values.
- The fit is only valid for **2600–7200 K**. Outside it the UI says the edges are
  rough rather than quietly printing a number — hot A/B stars trip this.

**Luminosity is derived, not stored.** The schema holds mass, so main-sequence
luminosity comes from the Eker et al. (2018) mass–luminosity relation (valid
0.179–31 M☉). That relation is *main sequence only* — a giant's output is set by
its bloated radius and a white dwarf's by residual cooling — so for evolved and
degenerate classes the code falls back to the class's own luminosity range
instead. If you ever want to set a star's luminosity explicitly, that needs a new
column; deriving it avoided a migration.

Planets get a zone verdict in the inspector, a 🌱 in the hierarchy when they sit
in the conservative zone, and a tidal-locking warning where `a⁶/M²` says one face
would always be toward the star. Moons are judged at their *planet's* distance
from the star, which is the distance that actually matters.

### Habitability & settlement scoring

Two scores per world, from `sql/v2_003` trait columns plus derived physics. They
answer different questions and routinely disagree — Mars scores 8/100 for
habitability and rates a strong sealed-habitat colony. See
[V2_SETTING.md](./V2_SETTING.md) for the weights, hard limits and reasoning.

**Traits are nullable and fall back to `CLASS_TRAIT_DEFAULTS`**, so a freshly
placed world scores sensibly with nothing filled in; anything the GM sets
overrides. `resolveTraits(body)` is the single place that resolution happens.

Derived, never stored: surface gravity (`M/R²` in Earth units), oxygen partial
pressure, equilibrium temperature.

Key implementation notes, each of which is a deliberate choice against the
obvious one:

- **Hard limits are ceilings, not deductions.** Without them a vacuum world in a
  perfect orbit coasts to a decent score on the factors it passes. Below the
  Armstrong limit caps at 8; toxic air at 12; unbreathable at 25; gravity outside
  0.3–1.8 g at 30.
- **Gravity is the only factor no technology addresses**, but it is not
  symmetrical. High gravity (>1.8 g) is a hard blocker — orbit only. Low gravity
  (<0.3 g) is a caveat that yields the `outpost` tier: bases are viable and
  cheap to launch from, only a multi-generational population is doubtful. Note
  that partial gravity has never been tested on humans, so the low-g floor is a
  game convention rather than a measured threshold.
- **Magnetosphere is a minor modifier**, never a gate — the science is genuinely
  contested and Venus is a standing counterexample.
- **Axial tilt is weighted low** because the large-moon obliquity-stabilisation
  claim was substantially revised in 2012.

**Validated against real measured bodies.** Solar system: Earth 100/open,
Mars 8/sealed-habitat, Venus surface 12/extreme, Moon 8/outpost,
Titan 19/outpost at 70% self-sufficiency (the best of the moons, as the
literature has it), Io and Mercury blocked on water, a 3.1 g super-Earth
30/orbital-only.

Exoplanets, scored against their real host stars and *assuming* the Earth-like
atmosphere their "potentially habitable" label implicitly hopes for (none of
these atmospheres has actually been measured):

| Planet | Model | Published ESI | Agreement |
|---|---|---|---|
| Proxima Cen b | 100 | 0.87 | ✓ |
| TRAPPIST-1 e | 100 | 0.85 | ✓ |
| Kepler-442 b | 95 | 0.836 | ✓ |
| Teegarden's b | 92 | 0.90 | ✓ |
| TOI-700 d | 90 | ~0.9 | ✓ |
| Kepler-452 b | 40 | 0.83 | model lower — correctly |
| Gliese 667 Cc | 40 | 0.84 | model lower — correctly |
| Kepler-186 f | 30 | ~0.64 | ✓ |
| LHS 1140 b | 30 | ~0.79 | model lower — correctly |
| K2-18 b | 12 | — | ✓ not rocky |

Where the model scores *below* ESI it is on the planets the literature says are
overstated: Kepler-452 b is only 13–60% likely to be rocky, LHS 1140 b's revised
density suggests a mini-Neptune or water world, Gliese 667 Cc's detection itself
is disputed, and K2-18 b is a sub-Neptune whose press coverage ran well ahead of
the evidence. ESI uses only radius, density and temperature, so it cannot
express "this may not have a surface"; the Fulton-gap caps here can.

Zone placements match the literature independently: TRAPPIST-1 e lands
`habitable`, 1 d `optimistic-inner` (published as "likely too hot, inner edge"),
and Kepler-186 f `too-cold` (published as "near the cold outer edge").

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

### The `TO authenticated` bug (fixed by `v2_004`)

As originally written, **none of the v2 policies had a `TO` clause**. A policy
without one defaults to `TO public`, and in Supabase that grouping includes
`anon` — the role behind `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which ships in the
browser bundle of the deployed site and is therefore public knowledge.

So this policy:

```sql
CREATE POLICY "Players read discovered systems" ON v2_star_systems
  FOR SELECT USING (discovered = true);
```

did not mean "players read discovered systems". It meant **"anyone at all reads
discovered systems"**, `gm_notes` included, with no login required. Same for the
bodies policy. `v2_001` was the only migration in the repo missing `TO
authenticated`; every other one has it, and `v2_001`'s own settings policy
already gated on `auth.uid() IS NOT NULL`, which does exclude anon — the two
content policies just never got the same treatment.

Writes were never exposed: the GM policies match a `profiles` row against
`auth.uid()`, which is NULL for anon, so no unauthenticated write could pass
`WITH CHECK`.

**Both halves are fixed.** `v2_001` now scopes its policies, so a fresh install
is correct and re-running it no longer reopens the hole. `sql/v2_004_rls_scope_authenticated.sql`
repairs a database that already had the unscoped version applied — **run it if
you applied `v2_001` before this change**.

### Verification

`sql/v2_rls_verify.sql` is a runnable harness: paste it into the Supabase SQL
Editor and it reports PASS/FAIL for eleven properties (anon reads nothing,
player reads discovered only, player cannot insert/update/delete, GM sees and
writes everything). It impersonates the roles with `SET ROLE` plus a forged
`request.jwt.claims`, which is exactly what `auth.uid()` reads, and it runs
inside a transaction that ends in `ROLLBACK`, so it creates nothing permanent.

Results against a local PostgreSQL 16 cluster stubbed with Supabase's roles,
grants and `auth.uid()`:

| Scenario | Result |
|---|---|
| Original unscoped `v2_001` | **9/11** — anon read both systems and bodies |
| `v2_001` + `v2_004` | 11/11 |
| Patched `v2_001` alone, fresh database | 11/11 |

Still **not** run against the live Supabase project — see
[SUPABASE_ACCESS.md](./SUPABASE_ACCESS.md#network-access-required); the egress
policy on Claude's cloud sessions blocks Supabase, so the harness has to be run
by hand for now. That local cluster replicates Supabase's default grants to
`anon`/`authenticated`; if the live project's grants were ever changed the
harness will say so, reporting "denied (no table GRANT)" instead of "RLS
filtered".

### Still open

**`gm_notes` is readable by logged-in players** on discovered systems and their
bodies. `TO authenticated` does not help here — policies gate rows, not
columns. The established fix in this repo is what `007` did for battlefields:
move the column into a separate GM-only table (`battlefield_gm_notes`) so the
player-readable row holds no private data. That touches app code, so it is
listed under "Ideas not yet built" rather than done. **Until then, keep genuine
secrets out of `gm_notes`** — it is exposed to every player the moment a system
is marked discovered.

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
- **Move `gm_notes` into GM-only tables** (`v2_star_system_gm_notes` /
  `v2_system_body_gm_notes`), the way `007` did for battlefields, so player-
  readable rows carry no private prose. Needed before the player view ships.
