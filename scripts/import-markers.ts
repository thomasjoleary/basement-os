/**
 * Import markers from Azgaar JSON into Supabase
 * 
 * Run with: npx tsx scripts/import-markers.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

// Load .env.local
config({ path: '.env.local' })

// Azgaar map dimensions
const AZGAAR_WIDTH = 2560
const AZGAAR_HEIGHT = 1366

// Marker type icons (emoji)
const TYPE_ICONS: Record<string, string> = {
  // Burgs
  'city': '🏰',
  'town': '🏘️',
  // Natural features
  'volcanoes': '🌋',
  'hot-springs': '♨️',
  'water-sources': '💧',
  'caves': '🕳️',
  'mountains': '⛰️',
  // Custom
  'dungeon': '⚔️',
  'landmark': '📍',
  'custom': '📌',
}

// Marker type colors
const TYPE_COLORS: Record<string, string> = {
  'city': '#FFD700',      // Gold
  'town': '#C0C0C0',      // Silver
  'volcanoes': '#FF4500', // Red-Orange
  'hot-springs': '#00CED1', // Cyan
  'water-sources': '#4169E1', // Blue
  'caves': '#8B4513',     // Brown
  'mountains': '#708090', // Gray
  'dungeon': '#8B0000',   // Dark Red
  'landmark': '#32CD32',  // Green
  'custom': '#9370DB',    // Purple
}

async function importMarkers() {
  // Check env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_SECRET_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
    console.error('Set these environment variables and try again')
    process.exit(1)
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // Load JSON
  console.log('Loading Azgaar JSON...')
  const data = JSON.parse(fs.readFileSync('BasementMapJSON.json', 'utf-8'))
  
  const markers: any[] = []
  
  // Import burgs (cities & towns)
  console.log(`\nProcessing ${data.pack.burgs.length} burgs...`)
  for (const burg of data.pack.burgs) {
    if (!burg.name || burg.i === 0) continue  // Skip index 0 (usually empty)
    
    const type = burg.group === 'cities' ? 'city' : 'town'
    
    markers.push({
      x: burg.x / AZGAAR_WIDTH,
      y: burg.y / AZGAAR_HEIGHT,
      type,
      name: burg.name,
      description: burg.capital ? 'Capital city' : null,
      icon: TYPE_ICONS[type],
      color: TYPE_COLORS[type],
      size: type === 'city' ? 'large' : 'medium',
      is_visible: true,
      azgaar_data: {
        source: 'burg',
        population: burg.population,
        state: burg.state,
        culture: burg.culture,
        port: burg.port,
        capital: burg.capital,
        ...burg
      }
    })
  }
  
  // Import markers (volcanoes, springs, etc.)
  console.log(`Processing ${data.pack.markers.length} markers...`)
  for (const marker of data.pack.markers) {
    const type = marker.type || 'custom'
    
    markers.push({
      x: marker.x / AZGAAR_WIDTH,
      y: marker.y / AZGAAR_HEIGHT,
      type,
      name: type.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: null,
      icon: TYPE_ICONS[type] || '📍',
      color: TYPE_COLORS[type] || '#9370DB',
      size: 'small',
      is_visible: true,
      azgaar_data: {
        source: 'marker',
        ...marker
      }
    })
  }
  
  console.log(`\nTotal markers to import: ${markers.length}`)
  
  // Check if table is empty
  const { count } = await supabase
    .from('map_markers')
    .select('*', { count: 'exact', head: true })
  
  if (count && count > 0) {
    console.log(`\n⚠️  Table already has ${count} markers.`)
    console.log('To re-import, first delete existing markers:')
    console.log('  DELETE FROM map_markers WHERE azgaar_data IS NOT NULL;')
    process.exit(0)
  }
  
  // Insert in batches
  const BATCH_SIZE = 100
  let inserted = 0
  
  for (let i = 0; i < markers.length; i += BATCH_SIZE) {
    const batch = markers.slice(i, i + BATCH_SIZE)
    
    const { error } = await supabase
      .from('map_markers')
      .insert(batch)
    
    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error)
      process.exit(1)
    }
    
    inserted += batch.length
    console.log(`Inserted ${inserted}/${markers.length}`)
  }
  
  console.log(`\n✅ Successfully imported ${inserted} markers!`)
}

importMarkers().catch(console.error)
