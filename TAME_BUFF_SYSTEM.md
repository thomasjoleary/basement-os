# Tame Buff System

## Overview
Tamed creatures can provide stat buffs to their owners when marked as "active". This allows GMs to configure powerful bonuses that tames grant during combat or specific situations.

## How It Works

### For Tames (GM Only)
1. **Configure Buffs** (Edit Mode)
   - Open a tame's character sheet
   - Click "Edit Sheet"
   - Scroll to "Tame Buffs" section
   - Set buff amounts for each stat (e.g., +50 Speed, +30 Strength)
   - Click "Save Changes"

2. **Activate/Deactivate Tame**
   - Click the "Active"/"Inactive" toggle button
   - Only active tames provide buffs to their owner
   - Use this to represent tames being "in the fight" vs "resting"

### For Owners (Automatic)
When viewing a character sheet:
- **Stats Section**: Shows total stats (base + buffs from active tames)
  - Buffed stats appear in **green**
  - Hover tooltip shows "+X from tames"
- **Active Tames Section**: Lists all active tames and their buffs
  - Only shows if the character has active tames

## Example

**Setup:**
- Character "Alice" has 100 Speed (base stat)
- Tame "Shadow Wolf" provides +50 Speed
- GM marks Shadow Wolf as "Active"

**Result:**
- Alice's character sheet shows:
  - Speed: **150** (in green)
  - Tooltip: "+50 from tames"
- "Active Tames" section shows:
  - ✓ Shadow Wolf
    - +50 Speed

**During Combat:**
- If Shadow Wolf is knocked out, GM clicks "Active" to deactivate
- Alice's Speed immediately drops back to 100 (base)

## Database Structure

```sql
-- Added to characters table:
is_active boolean DEFAULT false
stat_buffs jsonb DEFAULT '{}'::jsonb

-- Example stat_buffs value:
{
  "strength": 30,
  "speed": 50,
  "fortitude": 20
}
```

## Technical Notes
- Buffs are calculated on page load by querying all active tames owned by the character
- Toggling a tame's active state triggers a page reload to recalculate owner stats
- Only stats that exist on the character can be buffed
- Setting a buff to 0 removes it from the stat_buffs object
