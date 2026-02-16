const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TILE_SIZE = 256;
const PNG_PATH = 'public/maps/BasementMapPNG.png';
const OUTPUT_DIR = 'public/maps/tiles';

// Map dimensions
const MAP_WIDTH = 1707;
const MAP_HEIGHT = 993;

// Calculate how many zoom levels we need
// Level 4 should show full resolution
const MAX_ZOOM = 4;

async function generateTiles() {
  console.log('Starting tile generation...');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read PNG at full resolution
  console.log('Loading PNG at full resolution...');
  const fullResPng = await sharp(PNG_PATH)
    .png()
    .toBuffer();

  // Generate tiles for each zoom level
  for (let z = 0; z <= MAX_ZOOM; z++) {
    console.log(`\nGenerating zoom level ${z}...`);
    
    // Calculate dimensions for this zoom level
    const scale = Math.pow(2, z);
    const levelWidth = MAP_WIDTH * scale / Math.pow(2, MAX_ZOOM);
    const levelHeight = MAP_HEIGHT * scale / Math.pow(2, MAX_ZOOM);
    
    // Resize image for this zoom level
    const levelImage = await sharp(fullResPng)
      .resize(Math.round(levelWidth), Math.round(levelHeight), {
        fit: 'fill',
        kernel: 'lanczos3'
      })
      .toBuffer();
    
    // Calculate tile grid dimensions
    const cols = Math.ceil(levelWidth / TILE_SIZE);
    const rows = Math.ceil(levelHeight / TILE_SIZE);
    
    console.log(`  Size: ${Math.round(levelWidth)}x${Math.round(levelHeight)}, Tiles: ${cols}x${rows} = ${cols * rows} tiles`);
    
    // Create zoom level directory
    const zoomDir = path.join(OUTPUT_DIR, z.toString());
    if (!fs.existsSync(zoomDir)) {
      fs.mkdirSync(zoomDir, { recursive: true });
    }
    
    // Generate each tile
    let tileCount = 0;
    for (let x = 0; x < cols; x++) {
      const colDir = path.join(zoomDir, x.toString());
      if (!fs.existsSync(colDir)) {
        fs.mkdirSync(colDir, { recursive: true });
      }
      
      for (let y = 0; y < rows; y++) {
        const tilePath = path.join(colDir, `${y}.png`);
        
        // Extract tile region
        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const width = Math.min(TILE_SIZE, Math.round(levelWidth) - left);
        const height = Math.min(TILE_SIZE, Math.round(levelHeight) - top);
        
        // Extract and save tile
        await sharp(levelImage)
          .extract({ left, top, width, height })
          .extend({
            right: TILE_SIZE - width,
            bottom: TILE_SIZE - height,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .png({ compressionLevel: 9 })
          .toFile(tilePath);
        
        tileCount++;
      }
    }
    
    console.log(`  Generated ${tileCount} tiles`);
  }
  
  console.log('\n✅ Tile generation complete!');
  console.log(`Total tiles in ${OUTPUT_DIR}`);
}

generateTiles().catch(err => {
  console.error('Error generating tiles:', err);
  process.exit(1);
});
