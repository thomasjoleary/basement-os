const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TILE_SIZE = 256;
const SVG_PATH = 'public/maps/BiomeOverlay.svg';
const OUTPUT_DIR = 'public/maps/biome-tiles';

// Map dimensions (matches base map)
const MAP_WIDTH = 1707;
const MAP_HEIGHT = 993;

async function generateTiles() {
  console.log('Starting biome tile generation...');
  
  // Clear output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Same zoom levels as base map
  const nativeZoom = 6;
  const minZoom = 6;  // Only need zoom 6+ since minMapZoom is 0
  const maxZoom = 8;
  
  console.log(`Zoom range: ${minZoom}-${maxZoom} (native at ${nativeZoom})`);

  for (let z = minZoom; z <= maxZoom; z++) {
    console.log(`\nZoom ${z}...`);
    
    const scale = Math.pow(2, z - nativeZoom);
    const levelWidth = Math.round(MAP_WIDTH * scale);
    const levelHeight = Math.round(MAP_HEIGHT * scale);
    
    console.log(`  Map size: ${levelWidth}x${levelHeight}px`);
    
    // Render SVG at target resolution
    const density = Math.round(72 * scale);
    const levelImage = await sharp(SVG_PATH, { density: Math.max(density, 72) })
      .resize(levelWidth, levelHeight, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    
    // Calculate tiles needed
    const tilesX = Math.ceil(levelWidth / TILE_SIZE);
    const tilesY = Math.ceil(levelHeight / TILE_SIZE);
    
    console.log(`  Tiles: ${tilesX}x${tilesY}`);
    
    const zoomDir = path.join(OUTPUT_DIR, z.toString());
    fs.mkdirSync(zoomDir, { recursive: true });
    
    for (let x = 0; x < tilesX; x++) {
      const colDir = path.join(zoomDir, x.toString());
      fs.mkdirSync(colDir, { recursive: true });
      
      for (let y = 0; y < tilesY; y++) {
        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const width = Math.min(TILE_SIZE, levelWidth - left);
        const height = Math.min(TILE_SIZE, levelHeight - top);
        
        let tile = sharp(levelImage).extract({ left, top, width, height });
        
        // Pad if needed (with transparency)
        if (width < TILE_SIZE || height < TILE_SIZE) {
          tile = tile.extend({
            right: TILE_SIZE - width,
            bottom: TILE_SIZE - height,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          });
        }
        
        await tile.png({ compressionLevel: 9 }).toFile(path.join(colDir, `${y}.png`));
      }
    }
  }
  
  console.log('\n✅ Biome tiles generated!');
}

generateTiles().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
