# Multi-Polygon Fog of War Migration Guide

## Overview
Enhanced the fog of war system to support **multiple polygons per character**, making it easier for GMs to manage complex revealed areas.

## Changes Made

### 1. Database Schema (`sql/multi_fog_polygons.sql`)
- Added `label` column: User-friendly name for each polygon (e.g., "Town Square", "Forest Path")
- Added `is_active` column: Toggle polygons on/off without deleting them
- Removed unique constraint on `character_id` to allow multiple rows per character
- Added indexes for faster lookups

**Migration:** Run `sql/multi_fog_polygons.sql` in Supabase SQL Editor

### 2. GM Controls (`components/map/FogControls.tsx`)
**New Features:**
- List all fog polygons for selected character
- Create new polygon with "➕ New Area" button
- Select which polygon to edit
- Rename polygons (click on name)
- Toggle polygons active/inactive (👁️ / 🚫 icons)
- Delete individual polygons
- Visual indicators:
  - Selected polygon: Red border
  - Point count per polygon
  - Active/inactive status

**Props Changed:**
- Added: `selectedPolygonId`, `onSelectPolygon`
- Removed: Single polygon assumption

### 3. Map Rendering (`components/map/LeafletMap.tsx`)
**GM View:**
- Renders ALL polygons for selected character with different colors:
  - **Red** (selected, opacity 0.3): Currently editing
  - **Green** (active, opacity 0.15): Active but not selected
  - **Gray** (inactive, opacity 0.05): Disabled polygons
- Only shows draggable vertices for the selected polygon
- Clicking adds points to the selected polygon only

**Player View:**
- Combines ALL active polygons into revealed area
- Black fog everywhere except within active polygon boundaries
- Markers visible if within ANY active polygon
- Smooth performance with multiple polygons

### 4. Map Viewer (`components/map/MapViewer.tsx`)
**State Updates:**
- Added `selectedPolygonId` state
- Updated handlers to work with polygon IDs instead of character-only
- Clear/Undo actions now target specific polygons

## How to Use (GM)

### Creating Multiple Areas
1. Select a character from the dropdown
2. Click "➕ New Area" to create a new polygon
3. Select the polygon from the list
4. Click "✏️ Edit Polygon"
5. Click on the map to add points
6. Click "✓ Done Editing" when finished

### Managing Polygons
- **Rename:** Click on polygon name, type new name, press Enter
- **Toggle Active:** Click 👁️/🚫 icon to show/hide on map
- **Delete:** Click 🗑️ button (confirmation required)
- **Edit Points:** Select polygon → "✏️ Edit Polygon" → click map or drag vertices

### Best Practices
- Use descriptive names: "Town Square", "Eastern Road", "Secret Cave"
- Keep active only what players currently see
- Disable (don't delete) areas they might revisit
- Multiple small polygons are easier to manage than one huge complex shape

## Backward Compatibility
- Existing single polygons will work as-is (displayed as "Area 1")
- All polygons default to `is_active = true`
- No data loss during migration

## Testing Checklist
- [ ] Run SQL migration
- [ ] Create multiple polygons for a character
- [ ] Rename polygons
- [ ] Toggle polygons active/inactive
- [ ] Edit each polygon independently
- [ ] Test player view shows all active areas
- [ ] Test marker visibility with multiple polygons
- [ ] Delete a polygon
- [ ] Verify viewport-fixed fog renders correctly

## Rollback
If issues occur, to revert:
1. Keep only one polygon per character (delete extras)
2. Restore unique constraint:
   ```sql
   ALTER TABLE player_fog_polygons 
   ADD CONSTRAINT player_fog_polygons_character_id_key UNIQUE (character_id);
   ```
3. Revert code changes via git

---

**Migration completed:** 2026-02-16
