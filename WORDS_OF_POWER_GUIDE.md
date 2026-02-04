# Words of Power Feature - Implementation Guide

## Overview
This feature adds a **GM-only spell management system** for Basement OS. Instead of manually editing the database, you can now manage Words of Power and assign them to characters through a dedicated UI.

---

## What's New

### 1. **Database Tables**
Two new tables for managing spells:

- **`words_of_power`** - Global spell library
  - `word` (TEXT) - The spell word (e.g., "IGNIS")
  - `meaning` (TEXT) - What it means (e.g., "Fire")
  - `mana_cost` (INTEGER) - MP required to cast

- **`character_words`** - Join table tracking who knows what
  - Links characters to words they've learned

### 2. **New GM Interface** (`/words`)
A dedicated page where GMs can:
- View all Words of Power in a table
- Toggle checkboxes to grant/revoke knowledge to characters
- Add new words with word, meaning, and mana cost
- Edit existing words inline
- Delete words (removes from all characters)

### 3. **Updated Character Sheets**
Character detail pages now:
- Fetch words from the new `character_words` table
- Display word, meaning, and mana cost
- Show a "Manage Words" link (GM-only) to jump to the words page

### 4. **Dashboard Link**
Added "✨ Words of Power" button to the dashboard (GM-only)

---

## Deployment Steps

### Step 1: Run Database Migration
Copy and run the SQL file in your Supabase SQL Editor:

**File:** `words_of_power_schema.sql`

This will:
- Create the two new tables
- Set up Row Level Security (RLS) policies
- Ensure GMs have full access, players can read

### Step 2: (Optional) Import Your Google Sheet Data
If you want to migrate your existing Google Sheets data, you can:

1. Export your Google Sheet as CSV
2. Use the Supabase Table Editor to bulk-import into `words_of_power`
3. Manually assign initial knowledge via the new UI (or write a custom migration script)

**OR** just start fresh and add words through the UI!

### Step 3: Deploy to Vercel
Commit all changes and push to your git repo:

```bash
cd basement-os
git add .
git commit -m "Add Words of Power management system"
git push
```

Vercel will auto-deploy. No environment variable changes needed!

---

## How to Use

### As a GM:

1. **Go to the Dashboard** and click **"✨ Words of Power"**
2. **Add a new word:**
   - Click "+ Add Word"
   - Enter: Word (e.g., "IGNIS"), Meaning (e.g., "Fire"), Mana Cost (e.g., 10)
   - Click "Create Word"

3. **Assign knowledge to characters:**
   - Check the box under a character's name to grant them the word
   - Uncheck to revoke it

4. **Edit/Delete words:**
   - Click ✏️ to edit a word inline
   - Click 🗑️ to delete (confirms before removing)

5. **View on character sheets:**
   - Words now appear in a dedicated "Words of Power" section
   - Shows word, meaning, and mana cost
   - Click "Manage Words" to jump back to the management page

### As a Player:
- You'll see your character's Words of Power on their sheet automatically
- You **cannot** modify who knows what (GM-only)

---

## File Changes Summary

### New Files:
- `words_of_power_schema.sql` - Database migration
- `app/words/page.tsx` - GM management interface
- `WORDS_OF_POWER_GUIDE.md` - This guide

### Modified Files:
- `app/page.tsx` - Added "Words of Power" button to dashboard
- `app/character/[id]/page.tsx` - Updated to fetch words from new tables

---

## Migration from Old System

If you had words stored in the `characters.words` JSONB field:

**Option A: Fresh Start (Recommended)**
- Just use the new UI to add words
- Old data in `characters.words` won't interfere (it's just ignored now)

**Option B: Data Migration**
If you want to preserve old data, uncomment and run the migration helper in `words_of_power_schema.sql`:

```sql
INSERT INTO words_of_power (word, meaning, mana_cost)
SELECT DISTINCT
  (word->>'name')::TEXT as word,
  (word->>'meaning')::TEXT as meaning,
  COALESCE((word->>'mana_cost')::INTEGER, 0) as mana_cost
FROM characters, jsonb_array_elements(words) as word
WHERE words IS NOT NULL
ON CONFLICT (word) DO NOTHING;
```

Then manually assign knowledge via the UI.

---

## Features at a Glance

✅ GM-only spell library management  
✅ Checkbox UI for granting/revoking knowledge  
✅ Inline editing of words  
✅ Automatic sync to character sheets  
✅ Mana cost tracking  
✅ Row Level Security (players can't cheat!)  
✅ Clean migration from Google Sheets workflow  

---

## Troubleshooting

**"Access denied" when visiting /words**
- Make sure you're logged in as a GM
- Check your `profiles` table - your user should have `role = 'gm'`

**Words not showing on character sheet**
- Check the `/words` page and verify checkboxes are checked
- Refresh the character page

**Can't edit words**
- Ensure RLS policies are active (run the migration SQL)
- Verify you're logged in as GM

---

## Next Steps

Some ideas for future enhancements:
- **Word categories** (Combat, Utility, Healing, etc.)
- **Spell descriptions** (additional lore text)
- **Rarity levels** (Common, Rare, Legendary words)
- **Bulk import** from CSV/Google Sheets
- **Word combinations** (tracking multi-word spells)

---

**Enjoy your new spell management system!** 🔮✨

Questions? Check the code comments or reach out!
