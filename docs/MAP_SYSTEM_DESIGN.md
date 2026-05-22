# Map System Design - BasementOS

## Overview
Interactive campaign map with fog of war, markers, and player position tracking.

## Features
1. **Interactive Viewer**: Zoom, pan, drag controls
2. **Biome Overlay**: Toggleable layer showing 13 biome types (extracted from Azgaar data)
3. **Dynamic Markers**: Create, edit, delete, link to wiki
4. **Fog of War**: Per-player editable polygons define visible regions
5. **Player Positions**: Track player locations (self + GM visible only)

---

## Database Schema

### 1. `map_markers`
Stores all map markers (generated + custom).

```sql
CREATE TABLE map_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Position (normalized 0-1 coordinates)
  x FLOAT NOT NULL,  -- 0.0 to 1.0 (percentage of map width)
  y FLOAT NOT NULL,  -- 0.0 to 1.0 (percentage of map height)
  
  -- Marker data
  type VARCHAR(50) NOT NULL,  -- 'city', 'dungeon', 'landmark', 'custom', etc.
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),  -- Icon identifier
  
  -- Wiki integration
  wiki_page_id UUID REFERENCES wiki_pages(id) ON DELETE SET NULL,
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,  -- Visible to all players
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Original Azgaar data (JSON for flexibility)
  azgaar_data JSONB  -- Store original marker data if imported
);

CREATE INDEX idx_markers_campaign ON map_markers(campaign_id);
CREATE INDEX idx_markers_wiki ON map_markers(wiki_page_id);
```

### 2. `player_fog_polygons`
Per-character editable polygon defining their visible map area.

```sql
CREATE TABLE player_fog_polygons (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Polygon as array of [x, y] points (0-1 normalized coordinates)
  -- Example: [[0.2, 0.3], [0.5, 0.4], [0.3, 0.6]]
  polygon JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fog_polygons_campaign ON player_fog_polygons(campaign_id);
```

### 3. `player_marker_visibility`
Tracks which markers each player can see (independent of fog polygon).

```sql
CREATE TABLE player_marker_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  marker_id UUID NOT NULL REFERENCES map_markers(id) ON DELETE CASCADE,
  
  -- Metadata
  revealed_by UUID REFERENCES profiles(id),  -- Which GM revealed it
  revealed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(character_id, marker_id)
);

CREATE INDEX idx_marker_visibility_character ON player_marker_visibility(character_id);
CREATE INDEX idx_marker_visibility_marker ON player_marker_visibility(marker_id);
```

**Note:** Players see markers if:
1. Marker is public (`is_public = true`), OR
2. Marker granted in `player_marker_visibility`, AND
3. Marker is within player's fog polygon

### 4. `player_positions`
Current player positions on the map.

```sql
CREATE TABLE player_positions (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Position (normalized 0-1 coordinates)
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  
  -- Metadata
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional notes
  location_name VARCHAR(255),  -- "Outside Dungeon X"
  notes TEXT
);

CREATE INDEX idx_positions_campaign ON player_positions(campaign_id);
```

---

## Row Level Security (RLS) Policies

### `map_markers`
```sql
-- GMs can see all markers
CREATE POLICY gm_view_all_markers ON map_markers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.campaign_id = map_markers.campaign_id
        AND characters.user_id = auth.uid()
        AND characters.role = 'gm'
    )
  );

-- Players can see public markers or markers revealed to them
CREATE POLICY player_view_markers ON map_markers
  FOR SELECT
  USING (
    is_public = true
    OR EXISTS (
      SELECT 1 FROM player_map_visibility pmv
      JOIN characters c ON c.id = pmv.character_id
      WHERE pmv.marker_id = map_markers.id
        AND c.user_id = auth.uid()
        AND c.campaign_id = map_markers.campaign_id
    )
  );

-- Only GMs can create/update/delete markers
CREATE POLICY gm_manage_markers ON map_markers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.campaign_id = map_markers.campaign_id
        AND characters.user_id = auth.uid()
        AND characters.role = 'gm'
    )
  );
```

### `player_fog_polygons`
```sql
-- GMs can view and manage all fog polygons
CREATE POLICY gm_manage_fog_polygons ON player_fog_polygons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.campaign_id = player_fog_polygons.campaign_id
        AND characters.user_id = auth.uid()
        AND characters.role = 'gm'
    )
  );

-- Players can view only their own fog polygon
CREATE POLICY player_view_own_fog ON player_fog_polygons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = player_fog_polygons.character_id
        AND characters.user_id = auth.uid()
    )
  );
```

### `player_marker_visibility`
```sql
-- GMs can manage all marker visibility
CREATE POLICY gm_manage_marker_visibility ON player_marker_visibility
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.campaign_id = player_marker_visibility.campaign_id
        AND characters.user_id = auth.uid()
        AND characters.role = 'gm'
    )
  );

-- Players can view their own visibility records
CREATE POLICY player_view_own_marker_visibility ON player_marker_visibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = player_marker_visibility.character_id
        AND characters.user_id = auth.uid()
    )
  );
```

### `player_positions`
```sql
-- GMs can see all positions
CREATE POLICY gm_view_all_positions ON player_positions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.campaign_id = player_positions.campaign_id
        AND characters.user_id = auth.uid()
        AND characters.role = 'gm'
    )
  );

-- Players can only see their own position
CREATE POLICY player_view_own_position ON player_positions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = player_positions.character_id
        AND characters.user_id = auth.uid()
    )
  );

-- GMs can update any position
CREATE POLICY gm_manage_positions ON player_positions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.campaign_id = player_positions.campaign_id
        AND characters.user_id = auth.uid()
        AND characters.role = 'gm'
    )
  );
```

---

## Frontend Architecture

### Component Structure

```
app/
  campaign/
    [id]/
      map/
        page.tsx              # Main map page
        components/
          MapViewer.tsx       # Core map display with zoom/pan
          MarkerLayer.tsx     # Render markers
          FogLayer.tsx        # Render fog of war
          PlayerLayer.tsx     # Render player positions
          MarkerEditor.tsx    # GM: Create/edit markers
          FogEditor.tsx       # GM: Draw fog regions
          VisibilityPanel.tsx # GM: Grant visibility
```

### Technology Stack

**Map Rendering:**
- **react-zoom-pan-pinch** or **Leaflet.js** for zoom/pan
- **SVG rendering** for map background
- **Canvas overlay** (optional) for fog effects

**State Management:**
- React hooks for local UI state
- Supabase real-time subscriptions for live updates
- Optimistic updates for marker dragging

---

## Implementation Phases

### Phase 1: Basic Map Viewer + Biomes ✅ COMPLETE
**Goal:** Display map with zoom/pan and toggleable biome overlay

**Completed:**
- [x] Leaflet.js tiled map at `/map` route
- [x] SVG-sourced tiles (vector-crisp at all zoom levels)
- [x] Zoom range: 0 (native 1707×993) to +2 (4× upscale)
- [x] Biome overlay toggle (13 biomes, 50% opacity)
- [x] Biome hover detection via 1:1 lookup image
- [x] Biome legend panel

**Key Files:**
- `components/map/LeafletMap.tsx` - Main map component
- `components/map/MapViewer.tsx` - UI wrapper with controls
- `scripts/generate-tiles-simple.js` - SVG → tile generator
- `public/maps/tiles/{z}/{x}/{y}.png` - Map tiles (zoom 3-8)
- `public/maps/biome-tiles/` - Biome overlay tiles
- `public/maps/biome-lookup.png` - 1707×993 lookup image

**Biome Data:**
- Marine (#466eab), Hot desert (#fbe79f), Cold desert (#b5b887)
- Savanna (#d2d082), Grassland (#c8d68f), Tropical seasonal forest (#b6d95d)
- Temperate deciduous forest (#29bc56), Tropical rainforest (#7dcb35)
- Temperate rainforest (#409c43), Taiga (#4b6b32), Tundra (#96784b)
- Glacier (#d5e7eb), Wetland (#0b9131)

---

### Phase 2: Marker System ✅ COMPLETE
**Goal:** Display and manage markers

**Completed:**
- [x] `map_markers` table with RLS policies
- [x] Imported 420 markers from Azgaar JSON data
- [x] Emoji icons with hover tooltips
- [x] Click popups with name, type, description
- [x] GM: Create new markers (click map to place)
- [x] GM: Delete markers
- [x] GM: Edit marker descriptions
- [x] GM: Edit marker icons (with type-based suggestions)
- [x] Marker type filtering (checkbox UI)
- [x] GM visibility toggle (hidden markers at 50% opacity)

**Marker Types:**
- Cities (🏰), Towns (🏘️), Volcanoes (🌋)
- Hot Springs (♨️), Water Sources (💧), Dungeons (💀)

**Key Files:**
- `sql/001_create_map_markers.sql` - Schema + RLS
- `scripts/import-markers.ts` - Azgaar import script

---

### Phase 3: Fog of War (Per-Player Polygons) ✅ COMPLETE
**Goal:** Implement per-character visibility polygons

**Completed:**
- [x] `player_fog_polygons` table - stores polygon per character
- [x] `player_marker_visibility` table - grants specific markers to players
- [x] GM: Select character from dropdown (FogControls component)
- [x] GM: Edit fog polygon (click to add vertices)
- [x] GM: Drag vertices to reposition
- [x] GM: Undo last point / Clear polygon
- [x] GM: Toggle fog visibility on/off
- [x] GM: Grant/revoke marker visibility per player (checkbox panel)
- [x] Player view: completely black fog outside polygon (fillOpacity: 1)
- [x] Players cannot toggle fog off (always enabled)
- [x] No map flash on load (full black fog until data loads)
- [x] Type-based auto-visibility:
  - Cities & Towns: auto-visible within fog polygon
  - Volcanoes, Hot Springs, Water Sources, Dungeons: need GM grant
- [x] Real-time updates via Supabase subscriptions

**Key Files:**
- `sql/002_create_marker_visibility.sql` - Schema + RLS
- `components/map/FogControls.tsx` - GM fog editing panel

**Technical Notes:**
- `fogLoaded` state prevents map flash
- `AUTO_VISIBLE_TYPES = ['city', 'town']` for auto-visibility
- Point-in-polygon uses ray casting algorithm

---

### Phase 4: Player Positions & Travel ✅ COMPLETE
**Goal:** Track player locations and animate travel along routes

**Completed:**
- [x] `player_positions` table with RLS (GM sees all, players see own only)
- [x] `active_travels` table — stores waypoint routes, speed, progress, status
- [x] GM: Set player position by clicking map
- [x] GM: View all player positions
- [x] Player: See own position (pin/icon)
- [x] Route planning — GM plots multi-waypoint paths on the map
- [x] Travel controls — start, pause, resume travel along a route
- [x] Travel time calculation based on route distance + speed (mph)
- [x] Real-time travel animation via Supabase subscriptions (`travel_changes` channel)
- [x] Distance tool integrated into route planning (`DistanceTool.tsx`)

**Key Files:**
- `components/map/TravelControls.tsx` - Travel UI, route management, position sync
- `components/map/DistanceTool.tsx` - Distance measurement along plotted routes
- `components/map/PositionControls.tsx` - Position placement UI

---

### Phase 5: Polish & Features ⏳ PARTIAL
**Goal:** UX improvements

- ⬜ Minimap for navigation
- ⬜ Search markers
- [x] Marker categories/filtering (implemented in Phase 2)
- [x] Distance measurement tool (implemented in Phase 4 via route planning)
- [x] Travel time calculator (implemented in Phase 4)
- ⬜ Export/share map view (screenshot)

---

## Technical Challenges & Solutions

### Challenge 1: 4.4MB SVG Performance
**Problem:** Large file may cause lag

**Solutions:**
- Lazy load SVG (only render in viewport)
- Convert to optimized image tiles
- Use `<img>` tag instead of inline SVG (less DOM overhead)
- Cache aggressively

**Decision:** Start with `<img>` tag, convert to tiles if needed

---

### Challenge 2: Fog Rendering
**Problem:** Complex shapes, real-time updates

**Solutions:**
- **Option A:** SVG `<mask>` element (clean, performant)
- **Option B:** Canvas overlay with compositing
- **Option C:** CSS `clip-path` on regions

**Decision:** SVG `<mask>` for cleanliness, canvas if performance issues

---

### Challenge 3: Coordinate Normalization
**Problem:** Map might be resized/scaled

**Solution:**
- Store all coordinates as 0-1 normalized values
- Convert to pixels on render: `x_pixels = x * map_width`
- Scale-independent positioning

---

### Challenge 4: Real-time Sync
**Problem:** Multiple GMs editing simultaneously

**Solutions:**
- Supabase real-time subscriptions
- Optimistic UI updates
- Conflict resolution (last-write-wins)
- Show "X is editing" indicators

---

## File Locations

**Pages:**
- `app/campaign/[id]/map/page.tsx` - Main map route

**Components:**
- `components/map/MapViewer.tsx`
- `components/map/MarkerLayer.tsx`
- `components/map/FogLayer.tsx`
- `components/map/PlayerLayer.tsx`
- `components/map/MarkerEditor.tsx`
- `components/map/FogEditor.tsx`
- `components/map/VisibilityPanel.tsx`

**Database:**
- `supabase/migrations/` - Migration files for new tables

**Assets:**
- `public/maps/MapOfWorld.svg` - Extracted map file

---

## Migration Files Needed

### `01_create_map_markers.sql`
### `02_create_player_fog_polygons.sql`
### `03_create_player_marker_visibility.sql`
### `04_create_player_positions.sql`
### `05_setup_rls_policies.sql`

---

## Data Migration: Import Azgaar Markers

After tables exist, run script to parse MapOfWorld.map:

```typescript
// scripts/import-azgaar-markers.ts
async function importMarkers() {
  const mapFile = await readFile('MapOfWorld.map', 'utf-8');
  const sections = mapFile.split('|');
  
  // Find markers section
  const markersJson = sections.find(s => s.trim().startsWith('"markers":'));
  const markers = JSON.parse('{' + markersJson + '}').markers;
  
  // Map dimensions from file
  const mapWidth = 2560;
  const mapHeight = 1366;
  
  for (const marker of markers) {
    await supabase.from('map_markers').insert({
      campaign_id: CAMPAIGN_ID,
      x: marker.x / mapWidth,  // Normalize
      y: marker.y / mapHeight,
      type: marker.type,
      name: marker.legend || 'Unnamed',
      icon: marker.icon,
      azgaar_data: marker,  // Preserve original
    });
  }
}
```

---

## UI/UX Considerations

### GM View
- **Controls Sidebar:**
  - Toggle layers (markers/fog/players)
  - Add marker button
  - Draw fog region tool
  - Manage visibility button
  - Set player position mode

- **Map Interactions:**
  - Click marker → Edit
  - Drag marker → Reposition
  - Right-click → Context menu
  - Draw mode → Create fog region

### Player View
- **Minimal UI:**
  - Zoom controls only
  - Visible markers (tooltips)
  - Own position indicator
  - Fog overlay (grayed/blurred)

- **No editing capabilities**

---

## Security Notes

1. **All RLS policies must check campaign ownership**
2. **Never expose fog regions to players** (not even coordinates)
3. **Player positions private** (except to GMs)
4. **Marker visibility strictly enforced** (public flag + visibility table)
5. **Wiki links validated** (must be in same campaign)

---

## Testing Checklist

### Phase 1 (Map Viewer)
- [ ] Map loads and displays correctly
- [ ] Zoom in/out works smoothly
- [ ] Pan/drag responsive
- [ ] No performance issues with 4.4MB SVG

### Phase 2 (Markers)
- [ ] GM can create/edit/delete markers
- [ ] Players see only public markers
- [ ] Wiki linking works
- [ ] Marker tooltips display correctly
- [ ] Import script loads all 64 Azgaar markers

### Phase 3 (Fog of War)
- [ ] GM can draw fog regions
- [ ] GM can grant/revoke visibility
- [ ] Players see only revealed areas
- [ ] Fog updates in real-time
- [ ] Marker visibility tied to fog correctly

### Phase 4 (Player Positions & Travel)
- [x] GM can set player positions
- [x] Players see own position only
- [x] GM sees all positions
- [x] Position updates persist
- [x] Real-time position sync works
- [x] Route planning with multi-waypoint support
- [x] Travel start / pause / resume
- [x] Travel time calculated from distance + speed
- [x] Distance tool integrated into route planning

---

## Future Enhancements

- **Pathfinding:** Calculate routes between markers
- **Travel Time:** Estimate based on terrain/roads
- **Weather Overlay:** Show current weather by region
- **Time of Day:** Day/night visual changes
- **Battle Maps:** Zoom to tactical grid view
- **3D Terrain:** Elevation/height map overlay
- **Mobile Support:** Touch gestures for zoom/pan
- **Collaborative Drawing:** Multiple GMs draw simultaneously
- **Version History:** Track map changes over time
- **Export Maps:** Download as image with fog applied

---

## Open Questions

1. **Should markers auto-create wiki pages?**
   - Pro: Less manual work
   - Con: Clutters wiki with stubs
   - **Decision:** Manual linking only (dropdown selector)

2. **Fog polygon editing UX?**
   - Allow polygon holes (donut shapes)?
   - Snap-to-grid for cleaner polygons?
   - Copy polygon from another character?
   - **Decision:** Start simple (single polygon), add features as needed

3. **Player position movement?**
   - GM sets only
   - Players request, GM approves
   - Automatic based on session location
   - **Decision:** GM sets only (initially)

4. **Historical positions?**
   - Track movement over time
   - Show travel paths
   - Or just current position?
   - **Decision:** Current position only (add history later if needed)

5. **Biome overlay interaction?**
   - Show biome name on hover?
   - Legend in corner?
   - Both?
   - **Decision:** Both (hover tooltips + legend toggle)

---

## Next Steps

**Decision Points:**
1. Build now or document for later?
2. Start with Phase 1 (basic viewer)?
3. Need to estimate scope/time?

**If building now:**
1. Create database migration files
2. Extract SVG from MapOfWorld.map
3. Build MapViewer component
4. Test performance

**If documenting:**
- This spec is complete and ready for future work
- Link from SYSTEM_OVERVIEW.md
