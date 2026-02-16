const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TILE_SIZE = 256;
const PNG_PATH = 'public/maps/BasementMapPNG.png';
const OUTPUT_DIR = 'public/maps/tiles';

// Map dimensions
const MAP_WIDTH = 1707;
const MAP_HEIGHT = 993;

async function generateTiles() {
  console.log('Starting Leaflet-compatible tile generation...');
  
  // Create output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Read PNG at full resolution
  console.log('Loading PNG at full resolution...');
  const fullResPng = await sharp(PNG_PATH)
    .png()
    .toBuffer();

  // Determine max zoom - add extra levels for zooming in beyond 1:1
  const maxZoom = Math.ceil(Math.log2(Math.max(MAP_WIDTH, MAP_HEIGHT) / TILE_SIZE)) + 2;
  console.log(`Max zoom level: ${maxZoom}`);

  // Generate tiles for each zoom level
  for (let z = 0; z <= maxZoom; z++) {
    console.log(`\nGenerating zoom level ${z}...`);
    
    // At each zoom level, calculate the scaled dimensions
    const scale = Math.pow(2, z - maxZoom);
    const levelWidth = Math.round(MAP_WIDTH * scale);
    const levelHeight = Math.round(MAP_HEIGHT * scale);
    
    console.log(`  Scaled size: ${levelWidth}x${levelHeight}`);
    
    // Resize image for this zoom level
    const levelImage = await sharp(fullResPng)
      .resize(levelWidth, levelHeight, {
        fit: 'fill',
        kernel: 'lanczos3'
      })
      .png()
      .toBuffer();
    
    // Calculate how many tiles we need (round up)
    const tilesX = Math.ceil(levelWidth / TILE_SIZE);
    const tilesY = Math.ceil(levelHeight / TILE_SIZE);
    
    console.log(`  Tiles: ${tilesX}x${tilesY} = ${tilesX * tilesY} tiles`);
    
    // Create zoom level directory
    const zoomDir = path.join(OUTPUT_DIR, z.toString());
    fs.mkdirSync(zoomDir, { recursive: true });
    
    // Generate each tile
    let tileCount = 0;
    for (let x = 0; x < tilesX; x++) {
      const colDir = path.join(zoomDir, x.toString());
      fs.mkdirSync(colDir, { recursive: true });
      
      for (let y = 0; y < tilesY; y++) {
        const tilePath = path.join(colDir, `${y}.png`);
        
        // Calculate extraction region
        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const width = Math.min(TILE_SIZE, levelWidth - left);
        const height = Math.min(TILE_SIZE, levelHeight - top);
        
        // Extract tile region
        let tile = sharp(levelImage)
          .extract({ left, top, width, height });
        
        // If tile is smaller than TILE_SIZE, extend it with transparent background
        if (width < TILE_SIZE || height < TILE_SIZE) {
          tile = tile.extend({
            right: TILE_SIZE - width,
            bottom: TILE_SIZE - height,
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          });
        }
        
        // Save tile
        await tile.png({ compressionLevel: 9 }).toFile(tilePath);
        tileCount++;
      }
    }
    
    console.log(`  Generated ${tileCount} tiles`);
  }
  
  console.log('\n✅ Tile generation complete!');
  console.log(`Tiles generated for zoom levels 0-${maxZoom}`);
}

generateTiles().catch(err => {
  console.error('Error generating tiles:', err);
  process.exit(1);
});
