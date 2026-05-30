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

## Key Files
- `app/character/[id]/page.tsx` — the main character sheet page (everything: view, edit, level-up modal, power level display)
- `app/leaderboard/page.tsx` — leaderboard (GM: all categories + publish panel; players: published categories only)
- `app/create/page.tsx` — new character creation form (includes tame_class/species fields for tames)
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
