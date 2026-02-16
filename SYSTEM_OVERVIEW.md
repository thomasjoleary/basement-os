# BasementOS - System Overview & Architecture

*Last Updated: 2026-02-12*

## Purpose
BasementOS is a web-based D&D/tabletop RPG character sheet and campaign management system. It allows Game Masters (GMs) to manage campaigns, create characters/NPCs, and players to view and track their characters.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- **Backend/Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Authentication:** Supabase Auth

## User Roles
- **GM (Game Master):** Full access - can create/edit/delete all characters, NPCs, tames, wiki entries, words of power
- **Player:** Limited access - can view their assigned characters and public content
- Role stored in `profiles` table

## Core Database Tables

### `profiles`
- User accounts (linked to Supabase Auth)
- Fields: `id`, `username`, `role` (gm/player), `avatar_url`

### `characters`
- Central table for all characters, NPCs, and tames
- Key fields:
  - `id`, `name`, `user_id` (owner/assignment)
  - `is_npc` (boolean) - marks NPCs
  - `is_tame` (boolean) - marks tamed creatures
  - `is_active` (boolean) - whether tame is currently providing buffs
  - `hp_current`, `hp_max`, `mana_current`, `mana_max`
  - `xp_current`, `xp_max`, `level`, `job`
  - `stats` (jsonb) - base stats like strength, speed, fortitude, magic
  - `stat_buffs` (jsonb) - buffs this tame provides when active
  - `inventory` (jsonb array) - items with name, rarity, description
  - `abilities` (jsonb array) - abilities with name, rarity, description, level, type
  - `skills` (jsonb array) - skills with name and level
  - `tags` (text array) - searchable tags
  - `player_name` (text) - for tame linking (which master owns this tame)

### `words_of_power`
- Spell/magic system
- Fields: `id`, `word`, `meaning`, `mana_cost`

### `character_words`
- Junction table linking characters to their known words
- Fields: `character_id`, `word_id`

### `wiki_entries`
- Campaign wiki/notes system
- Fields: `id`, `title`, `content`, `is_public`, `created_by`, `tags`

## Core Systems

### 1. Character Management
**Location:** `app/character/[id]/page.tsx`

- Displays comprehensive character sheet
- GM can edit all fields via "Edit Sheet" mode
- Players can only view their assigned characters
- Features:
  - HP/Mana/XP bars with visual progress
  - Stats display with buff indicators (green text)
  - Inventory with rarity colors (Common → Demonic)
  - Abilities with rarity and descriptions
  - Skills with levels
  - Words of Power list (if character knows any)

**Edit Mode Features (GM only):**
- Inline editing of HP, mana, XP, level
- Add/remove/edit inventory items
- Add/remove/edit abilities and skills
- Configure stat buffs (for tames)
- Toggle tame active/inactive state

### 2. Tame & Buff System
**Documentation:** `TAME_BUFF_SYSTEM.md`

**How Tame Linking Works:**
- Tames are characters with `is_tame = true`
- Linked to master via:
  - `player_name` field matching master's full name, OR
  - `job` field starting with master's first name
- Example: Tame with `player_name = "Alice Smith"` or `job = "Alice's Wolf"`

**Buff Mechanics:**
1. GM configures `stat_buffs` on tame (e.g., `{"strength": 30, "speed": 50}`)
2. GM toggles `is_active` to enable/disable buffs
3. When viewing master's character sheet:
   - System fetches all active tames linked to that character
   - Sums buff values with base stats
   - Displays buffed stats in green with "+X from tames" tooltip
   - Shows "Active Tames" section listing buffs

**Key Fix (2026-02-12):**
- Changed buff calculation to only apply from tames linked to SPECIFIC master
- Previously buffed all characters under same user_id

### 3. Owner Assignment & Cascading
**Location:** `app/character/[id]/page.tsx` → `handleAssignOwner()`

When GM assigns a character to a player:
1. Updates character's `user_id`
2. **Cascades to linked tames:**
   - Finds all tames where `player_name` matches character name OR `job` starts with first name
   - Updates those tames' `user_id` to match
3. Example: Assigning "Alice" to Player1 also assigns "Alice's Wolf" tame to Player1

### 4. Words of Power System
**Location:** `app/words/page.tsx` (management), `app/character/[id]/page.tsx` (display)

- Spell/magic system with mana costs
- GM can create/edit/delete words
- GM can assign words to characters via checkboxes
- Character sheets display known words with:
  - Search filter (word or meaning)
  - Mana cost range filter
  - Sorted by mana cost, then alphabetically

### 5. Wiki System
**Location:** `app/wiki/page.tsx`, `app/wiki/[id]/page.tsx`, `app/wiki/new/page.tsx`

- Campaign notes/lore repository
- **Public entries:** Visible to all users
- **Private entries:** Only visible to GMs
- Features:
  - Markdown-like formatting
  - Tag system for organization
  - Search by title/content/tags
  - GM can create/edit/delete
  - Players can only read public entries

### 6. Dashboard
**Location:** `app/page.tsx`

**For GMs:**
- Quick Stats: Total characters, NPCs, active tames
- Search & filter (by name, tags, job, type)
- Create new character button
- View all characters with edit access

**For Players:**
- List of assigned characters only
- View-only access
- Shows character level, HP, job

## Rarity System
Used for items and abilities:
- **Common** → Gray
- **Uncommon** → Green
- **Rare** → Blue
- **Very Rare** → Purple
- **Legendary** → Orange
- **Holy** → Yellow
- **Unique** → Pink
- **Demonic** → Red

Colors defined in `getRarityColor()` function.

## Key File Locations

### Pages (App Router)
- `app/page.tsx` - Dashboard
- `app/character/[id]/page.tsx` - Character detail/edit
- `app/create/page.tsx` - Create new character
- `app/words/page.tsx` - Words of Power management
- `app/wiki/page.tsx` - Wiki list
- `app/wiki/[id]/page.tsx` - Wiki entry view
- `app/wiki/new/page.tsx` - Create wiki entry
- `app/login/page.tsx` - Authentication

### Utilities
- `lib/supabase.ts` - Supabase client setup

### Configuration
- `.env.local` - Supabase credentials (not in git)
- `next.config.ts` - Next.js config
- `tsconfig.json` - TypeScript config

### SQL Migrations
- `add_default_stats.sql` - Adds default stat structure
- `add_skills_column.sql` - Adds skills system
- `add_tame_buffs.sql` - Adds tame buff system
- `complete_rls_policies.sql` - Row Level Security
- `strict_gm_only_rls.sql` - Restricts editing to GMs
- `words_of_power_schema.sql` - Magic system schema

## Row Level Security (RLS)
Supabase RLS policies control data access:
- **Characters:** All can read, only GMs can insert/update/delete
- **Words of Power:** Same as characters
- **Wiki Entries:** 
  - All can read public entries
  - Only GMs can read private entries
  - Only GMs can insert/update/delete
- **Profiles:** Users can read their own profile, GMs can read all

## Common Workflows

### Adding a New Character
1. GM clicks "Create New Character" on dashboard
2. Fills in basic info (name, job, level, HP, stats)
3. Character created with `user_id = null` (unclaimed)
4. GM can assign to player via dropdown on character page

### Creating a Tame
1. Create character normally
2. Set `is_tame = true`
3. Set `player_name` to master's name OR `job` to "FirstName's CreatureName"
4. Configure `stat_buffs` in edit mode
5. Toggle "Active" to enable buffs

### Assigning Words to a Character
1. GM goes to Words of Power page
2. Selects character from dropdown
3. Checkboxes appear for all words
4. Check words to assign, uncheck to remove
5. Character sheet automatically shows assigned words

### Creating Wiki Entry
1. GM clicks "Create New Entry" on wiki page
2. Writes title and content (supports basic formatting)
3. Adds tags (comma-separated)
4. Sets public/private flag
5. Entry saved and searchable

## Development Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Map System ✅ (Phases 1-3 Complete)

**Location:** `app/map/page.tsx`, `components/map/`

Interactive campaign map with fog of war, markers, and biome overlays.

### Features Implemented
- **Tiled Map Viewer:** Leaflet.js with SVG-sourced tiles (crisp at all zooms)
- **Biome Overlay:** 13 biomes with hover detection and legend
- **420+ Markers:** Imported from Azgaar, with emoji icons and tooltips
- **Fog of War:** Per-player editable polygons, completely black outside revealed area
- **Marker Visibility:** Type-based (cities/towns auto-visible, others need GM grant)

### GM Controls
- Add/delete markers (click to place)
- Edit marker icons and descriptions
- Draw fog polygons per player character
- Grant specific marker visibility to players
- Toggle fog display on/off

### Player View
- Fog always enabled (no toggle)
- Full black fog until data loads (no map flash)
- Only sees markers within fog polygon
- Cities/towns auto-visible, others need GM grant

### Database Tables
- `map_markers` - All map markers with position, type, icon
- `player_fog_polygons` - Per-character fog polygon (JSONB array of points)
- `player_marker_visibility` - Junction table for GM-granted marker access

### Key Files
- `components/map/LeafletMap.tsx` - Main map component
- `components/map/MapViewer.tsx` - UI controls wrapper
- `components/map/FogControls.tsx` - GM fog editing panel
- `sql/001_create_map_markers.sql` - Markers schema
- `sql/002_create_marker_visibility.sql` - Visibility schema
- `public/maps/tiles/` - Map tile images

### Remaining Phases
- **Phase 4:** Player Positions (track locations)
- **Phase 5:** Polish (minimap, search, distance tools)

See `MAP_SYSTEM_DESIGN.md` for full technical specification.

---

## Future Considerations
- Combat tracker system
- Dice roller integration
- Character progression/XP automation
- Import/export characters
- Mobile app version
- Real-time collaboration features

## Troubleshooting

### "Can't edit characters"
- Ensure user's role is 'gm' in profiles table
- Check Supabase RLS policies are applied

### "Tame buffs not showing"
- Verify tame's `is_active = true`
- Check `player_name` or `job` field matches master
- Ensure `stat_buffs` jsonb is properly formatted

### "Words not appearing"
- Check `character_words` junction table has entries
- Verify word IDs are correct
- Ensure character_id matches

### "Wiki entry not visible to player"
- Check `is_public = true` on entry
- Private entries only show to GMs

---

*This document serves as a reference for understanding BasementOS architecture and jumping back into development after time away.*
