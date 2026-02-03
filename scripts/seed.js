require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const NOTES_DIR = '../Basement_notes'; // Relative to basement-os/scripts/
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DRY_RUN = false; // Set to false to actually upload

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing API Keys in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
    console.log(`🌱 Starting Seeder (Dry Run: ${DRY_RUN})`);
    console.log(`📂 Reading from: ${NOTES_DIR}`);

    const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.txt'));
    console.log(`found ${files.length} files.`);

    for (const file of files) {
        const data = parseFile(file);
        if (!data) continue;

        if (data.type === 'PC' || data.type === 'NPC') {
            await uploadCharacter(data);
        } else {
            await uploadNote(data);
        }
    }
    console.log("✅ Done.");
}

async function uploadCharacter(char) {
    const payload = {
        name: char.name,
        job: char.job,
        level: char.level,
        is_npc: char.type === 'NPC',
        player_name: char.playerName || null,
        hp_current: char.hp.current,
        hp_max: char.hp.max,
        xp_current: char.xp.current,
        xp_max: char.xp.max,
        stats: char.stats,
        inventory: char.inventory,
        abilities: char.abilities,
        words: char.words,
        tags: char.tags
    };

    console.log(`[CHARACTER] ${char.name} (${char.type})`);
    if (!DRY_RUN) {
        const { error } = await supabase.from('characters').upsert(payload, { onConflict: 'name' });
        if (error) console.error("  ❌ Error:", error.message);
        else console.log("  ✨ Saved");
    }
}

async function uploadNote(note) {
    const payload = {
        title: note.title,
        type: note.type, 
        content: note.content,
        tags: note.tags,
        // Store abilities AND unlock requirements in data
        data: { 
            abilities: note.abilities || [],
            unlock_requirements: note.unlockRequirements || null
        },
        is_public: false, 
        requires_unlock: true 
    };

    console.log(`[NOTE] ${note.title} (${note.type})`);
    if (!DRY_RUN) {
        const { error } = await supabase.from('notes').upsert(payload, { onConflict: 'title' });
        if (error) console.error("  ❌ Error:", error.message);
        else console.log("  ✨ Saved");
    }
}

// --- PARSER LOGIC (Copied & Refined) ---

function parseFile(filename) {
    const filePath = path.join(NOTES_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim());
    
    // Heuristics
    if (content.includes('HP:') && content.includes('XP:')) {
        return parseCharacter(filename, lines, content);
    }
    if (content.includes('Tags:') && content.includes('Jobs')) {
        return parseClass(filename, lines, content);
    }
    return parseLore(filename, lines, content);
}

function parseCharacter(filename, lines, rawContent) {
    const data = {
        type: 'NPC', 
        name: lines[0], 
        job: lines[1], 
        level: 0,
        hp: { current: 0, max: 0 },
        xp: { current: 0, max: 0 },
        stats: {},
        inventory: [],
        words: [], 
        abilities: [],
        tags: []
    };

    const levelMatch = rawContent.match(/Level (\d+)/i);
    if (levelMatch) data.level = parseInt(levelMatch[1]);

    const hpMatch = rawContent.match(/HP:\s*(\d+)\/(\d+)/i);
    if (hpMatch) data.hp = { current: parseInt(hpMatch[1]), max: parseInt(hpMatch[2]) };

    const xpMatch = rawContent.match(/XP:\s*(\d+)\/(\d+)/i);
    if (xpMatch) data.xp = { current: parseInt(xpMatch[1]), max: parseInt(xpMatch[2]) };

    const statsToCheck = ['Strength', 'Speed', 'Fortitude', 'Magic'];
    statsToCheck.forEach(stat => {
        const regex = new RegExp(`${stat}\\s+(\\d+)`, 'i');
        const match = rawContent.match(regex);
        if (match) data.stats[stat.toLowerCase()] = parseInt(match[1]);
    });

    data.tags = extractTags(rawContent);
    
    if (data.tags.includes('Player')) {
        data.type = 'PC';
        const potentialPlayerNames = data.tags.filter(t => t !== 'Basement' && t !== 'Player' && t !== 'PC');
        if (potentialPlayerNames.length > 0) data.playerName = potentialPlayerNames[0]; 
    }

    const sections = rawContent.split(/-{3,}/);
    let potentialItemDescriptions = [];

    sections.forEach(section => {
        const sectionLines = section.split('\n').map(l => l.trim()).filter(l => l);
        if (sectionLines.length === 0) return;

        const header = sectionLines[0].toUpperCase();
        
        if (header.includes('INVENTORY')) {
            data.inventory = extractInventory(sectionLines.slice(1));
        } else if (header.includes('WORDS')) {
            data.words = extractWords(sectionLines.slice(1));
        } else if (header.includes('ABILITIES')) {
            data.abilities = data.abilities.concat(extractGeneralAbilities(sectionLines.slice(1)));
        } else if (data.job && header.includes(data.job.toUpperCase())) {
            data.abilities = data.abilities.concat(extractClassAbilities(sectionLines.slice(1)));
        } else {
            // Potential description block? (Not Header, has content)
            if (!header.includes('SKILLS') && !header.includes('STATS') && !header.includes('MANA')) {
                 potentialItemDescriptions.push({
                     title: sectionLines[0],
                     description: sectionLines.slice(1).join('\n')
                 });
            }
        }
    });

    // Attach Descriptions
    potentialItemDescriptions.forEach(descBlock => {
        const targetItem = data.inventory.find(item => 
            descBlock.title.toUpperCase() === item.name.toUpperCase() || 
            item.name.toUpperCase().includes(descBlock.title.toUpperCase())
        );
        if (targetItem) {
            targetItem.description = descBlock.description;
        }
    });

    return data;
}

function extractInventory(lines) {
    const items = [];
    lines.forEach(line => {
        const match = line.match(/^[\*\-]+\s*(.+)/);
        if (match) {
            items.push({ name: match[1].trim(), rarity: "Common" });
        } else if (line.length > 0 && !line.startsWith('//')) {
             items.push({ name: line.trim(), rarity: "Common" });
        }
    });
    return items;
}

function extractWords(lines) {
    const words = [];
    lines.forEach(line => {
        if (!line || line.startsWith('-')) return;
        const parts = line.split(/\s{2,}|\t/);
        if (parts.length >= 2) {
            words.push({ name: parts[0].trim(), meaning: parts[1].trim() });
        }
    });
    return words;
}

function extractGeneralAbilities(lines) {
    const abilities = [];
    let currentAbility = null;
    lines.forEach(line => {
        if (!line.startsWith('-')) {
            if (currentAbility) abilities.push(currentAbility);
            currentAbility = { name: line, description: '', rarity: "Rare", type: "general" };
        } else if (currentAbility) {
            currentAbility.description += line.replace(/^-\s*/, '') + ' ';
        }
    });
    if (currentAbility) abilities.push(currentAbility);
    return abilities;
}

function extractClassAbilities(lines) {
    const abilities = [];
    let currentAbility = null;
    lines.forEach(line => {
        const levelMatch = line.match(/Level (\d+) Ability/i) || line.match(/Tactician Level (\d+)/i);
        if (levelMatch) {
            if (currentAbility) abilities.push(currentAbility);
            currentAbility = { 
                level: parseInt(levelMatch[1]), 
                name: '', 
                description: '', 
                rarity: "Rare", 
                type: "job" 
            };
        } else if (currentAbility) {
            if (!currentAbility.name) currentAbility.name = line;
            else currentAbility.description += line + ' ';
        }
    });
    if (currentAbility) abilities.push(currentAbility);
    return abilities;
}

function parseLore(filename, lines, rawContent) {
    const data = {
        type: 'lore',
        title: lines[0],
        content: '',
        tags: extractTags(rawContent)
    };
    const tagIndex = lines.findIndex(l => l.startsWith('Tags:'));
    if (tagIndex > -1) {
        data.content = lines.slice(1, tagIndex).join('\n').trim();
    } else {
        data.content = lines.slice(1).join('\n').trim();
    }
    if (data.tags.includes('Monster')) data.type = 'monster';
    return data;
}

function parseClass(filename, lines, rawContent) {
    return {
        type: 'class',
        title: lines[0], 
        name: lines[0],
        abilities: extractClassAbilities(lines),
        unlockRequirements: extractUnlockRequirements(lines), // New field
        tags: extractTags(rawContent),
        content: rawContent 
    };
}

function extractUnlockRequirements(lines) {
    const startIdx = lines.findIndex(l => l.match(/Unlock Requirements/i));
    if (startIdx === -1) return null;

    // Find where the requirements end (usually the first Level X Ability or Tags)
    let endIdx = lines.slice(startIdx + 1).findIndex(l => l.match(/Level \d+ Ability/i) || l.startsWith('Tags:'));
    
    if (endIdx === -1) {
        endIdx = lines.length;
    } else {
        endIdx += startIdx + 1;
    }

    return lines.slice(startIdx + 1, endIdx).join('\n').trim();
}

function extractTags(content) {
    const match = content.match(/Tags:\s*([\s\S]*?)$/i);
    if (!match) return [];
    return match[1].split(',').map(t => t.trim());
}

seed();
