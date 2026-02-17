# Player Notes System - Implementation Summary

**Date:** 2026-02-17  
**Feature:** Allow players to create their own wiki notes categorized by character

---

## What Was Built

### Database Changes
- **New columns added to `notes` table:**
  - `created_by` (UUID) - References the user who created the note
  - `character_name` (TEXT) - Optional character name to categorize player notes
  
- **Updated RLS (Row Level Security) policies:**
  - Players can now INSERT, UPDATE, and DELETE their own notes
  - Players can SELECT:
    - Their own notes (regardless of public status)
    - Public notes from anyone (GMs and other players)
    - GM lore they've been granted access to (via `unlocks` table)
  - GMs retain full access to all notes

### New Features

#### 1. **Player Note Creation** (`/wiki/new`)
- All authenticated users can create notes (not just GMs)
- **For Players:**
  - Character dropdown (populated from their assigned characters)
  - Notes default to private (only visible to creator + GM)
  - Can toggle notes to public (visible to all players)
  - Simplified interface (no type categorization)
- **For GMs:**
  - Existing lore creation workflow unchanged
  - Can create notes with full type/category options
  - Can create notes without `created_by` (official lore)

#### 2. **Note Editing** (`/wiki/[id]/edit`)
- New edit page created
- **Permissions:**
  - Players can edit their own notes
  - GMs can edit all notes
- **Edit Features:**
  - Players can switch notes between public/private
  - Players can change character association
  - Full content/title/tags editing
  - Delete note option

#### 3. **Enhanced Wiki Index** (`/wiki`)
- **Visual Distinction:**
  - GM lore: Red border (original style)
  - Player notes: Green border
  - Character name badge displayed on player notes
  - "📝 Player Note" indicator badge
- **New Filters:**
  - Filter by Source: All / GM Lore / Player Notes / Specific Character
  - Existing type filters still work
- **Create Button:**
  - Shows for all authenticated users
  - Text changes based on role (GMs: "Create New Lore", Players: "Create Note")

#### 4. **Note Detail View** (`/wiki/[id]`)
- **Edit Button:**
  - Shows for note owners (not just GMs)
  - GMs can edit all notes
- **Player Note Indicators:**
  - "📝 Player Note" badge
  - Character name badge (if applicable)
  - Public/Private status badge
- **GM Controls:**
  - Unlock system still works for GM lore
  - Not shown for player notes (player notes use public/private toggle)

---

## Files Modified

### Created:
1. `sql/player_notes_system.sql` - Database migration
2. `app/wiki/[id]/edit/page.tsx` - Edit page for notes
3. `PLAYER_NOTES_IMPLEMENTATION.md` - This file

### Modified:
1. `app/wiki/new/page.tsx` - Added player note creation
2. `app/wiki/page.tsx` - Added filters, visual distinction, player access
3. `app/wiki/[id]/page.tsx` - Added edit button for owners, player note indicators

---

## How It Works

### Player Workflow:
1. Player navigates to `/wiki`
2. Clicks "Create Note"
3. Fills in title, content, tags
4. Selects character from dropdown (optional)
5. Chooses public/private (defaults to private)
6. Submits → note is created with `created_by = their user ID`
7. Note appears in wiki with green border
8. Only they and the GM can see private notes
9. If made public, all players can see it

### Privacy Model:
- **GM Lore (no `created_by`):**
  - Uses unlock system (GMs grant access per-player)
  - Can be public or private
  
- **Player Notes (has `created_by`):**
  - Uses public/private toggle
  - Private: Only creator + GM can see
  - Public: All players can see
  - Creator can edit/delete anytime
  - GM can edit/delete any note

### Character Categorization:
- Players can associate notes with their characters
- Creates logical grouping (e.g., "Alice's journal entries")
- Filterable in wiki index
- Optional - can leave blank for general notes

---

## Database Migration Required

**Run this SQL in your Supabase SQL Editor:**

```sql
-- Location: sql/player_notes_system.sql
```

This migration will:
1. Add `created_by` and `character_name` columns to `notes`
2. Drop old RLS policies
3. Create new RLS policies with player permissions
4. Add indexes for performance

**⚠️ Important:** This migration is safe to run on existing data. Existing notes will have `created_by = NULL` (treated as GM lore).

---

## Troubleshooting

### Issue: Players can't see their own private notes

**Quick Fix:**
1. Run `sql/debug_player_notes.sql` to see current policies
2. Run `sql/fix_player_notes_rls.sql` to force-reset RLS policies
3. Test again

**Root Cause:** Old RLS policies may conflict with new ones. The fix script drops ALL policies and recreates them cleanly.

---

## Testing Checklist

- [ ] Run SQL migration in Supabase (`sql/player_notes_system.sql`)
- [ ] Test as GM:
  - [ ] Create lore (should work as before)
  - [ ] Edit any note
  - [ ] Delete any note
  - [ ] See unlock controls on GM lore
  - [ ] See all notes in index

- [ ] Test as Player:
  - [ ] Create note with character selection
  - [ ] Create note without character
  - [ ] Toggle note to public
  - [ ] Edit own note
  - [ ] Delete own note
  - [ ] Cannot edit/delete GM lore or other players' notes
  - [ ] See own private notes
  - [ ] See public notes from GM and players
  - [ ] Filter by character name

- [ ] Test Permissions:
  - [ ] Player cannot see other players' private notes
  - [ ] Player can see other players' public notes
  - [ ] Player can see GM public lore
  - [ ] Player cannot see GM private lore (unless unlocked)

---

## Next Steps (Optional Enhancements)

1. **Rich Text Editor** - Add markdown/formatting support for note content
2. **Note Comments** - Allow players to comment on public notes
3. **Note Sharing** - Direct share links for specific players
4. **Session Date Tagging** - Auto-tag notes with session date
5. **Search Improvements** - Search by author, character, date
6. **Export Notes** - Let players export their notes to PDF/markdown

---

## Rollback Plan

If you need to revert this feature:

```sql
-- 1. Drop new policies
DROP POLICY IF EXISTS "GMs have full access to notes" ON notes;
DROP POLICY IF EXISTS "Players can read accessible notes" ON notes;
DROP POLICY IF EXISTS "Players can create their own notes" ON notes;
DROP POLICY IF EXISTS "Players can update their own notes" ON notes;
DROP POLICY IF EXISTS "Players can delete their own notes" ON notes;

-- 2. Restore old policies (see fix_notes_rls.sql)

-- 3. Drop new columns (optional - doesn't break anything if left)
ALTER TABLE notes DROP COLUMN IF EXISTS created_by;
ALTER TABLE notes DROP COLUMN IF EXISTS character_name;
```

---

**System is ready to deploy! Run the SQL migration and test.** 🎉
