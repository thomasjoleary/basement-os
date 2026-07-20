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
- SQL migrations (run in order): `sql/005_create_battlefields.sql`, `sql/006_battlefield_presets.sql`, `sql/007_battlefield_visibility.sql` — **must be run in Supabase** before use

### Data model
- **`battlefields`**: `cols`/`rows` (size in 5ft squares, 1–100), `bg_color`, `border_type` (`'indoor'`|`'outdoor'` — drives border styling so players know where they can flee), `gm_notes` (private), `round`, `turn_entity_id` (whose turn), `is_archived`
- **`battlefield_entities`**: `kind` (`player`|`tame`|`enemy`|`object`|`wall`|`door`), `character_id` (nullable link to `characters`), `x`/`y`/`width`/`height` (in squares), `color`, `icon`, `hp/mana_current/max`, `move_ft`, `conditions` (jsonb string[]), `initiative`, `hidden_until_revealed` (reserved for Phase 2 fog), `notes`
- Both tables are on the Supabase realtime publication; the editor also subscribes to `characters` UPDATEs for live vitals

### Behavior
- **HP/mana**: player/tame tokens are `character_id`-linked and read **live** from the character sheet (`resolveVitals()` in `lib/battlefield.ts`); enemies/objects use their own manual `hp/mana_*` fields
- Multiple creatures can share a square — `BattlefieldGrid` fans/shrinks stacked creature tokens (mounts, tiny creatures)
- Extras: initiative/turn tracker (`round` + `turn_entity_id`, "Next turn" wraps and increments round), toggleable status conditions (`CONDITIONS` in `lib/battlefield.ts`), distance measure + movement-range highlight (5e "every square = 5ft", `move_ft`)
- Walls/doors/objects are cell-based tokens (v1 simplification — not edge-drawn)
- Linked from home nav (visible to all; list is empty for players until Phase 2)

### GM grid interactions (PC)
- Three tools in the floating toolbar: **select** (↖️), **pan** (✋), **measure** (📏). Marquee needs left-drag, so panning moved to its own tool; middle/right-mouse-drag also pans in any tool, and one-finger drag pans on touch (mobile is view-first)
- **select tool**: drag empty space = marquee multi-select (shift adds); drag a token = move it (dragging one of a multi-selection moves the whole group, formation-clamped to the grid); drag the amber handles on a single selected token = resize; **Delete/Backspace** removes the selection, **Esc** clears it
- Any click/tap on a token selects just it and opens the Inspect panel (`onInspect`)
- Selection is a `string[]` (`selectedIds`) in the page; Inspect shows a single-token editor or a bulk panel (recolor / delete N) when several are selected

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
- **Player view:** read-only, fogged (blacked-out outside `visible_cells`), pan/look only. Tapping a visible token opens a read-only card (`PlayerTokenCard`) with its name/kind/conditions; HP/mana bars + a character-sheet link appear only when the RPC returned vitals (i.e. own character + tames + party NPCs) — privacy stays server-enforced.
- Grid fog props: `fogDisplay` (`'none'|'player'|'edit'`), `fogVisibleCells`, `hiddenEntityIds`, `fogReveal`, `fogShape`, `onPaintCells`.

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
