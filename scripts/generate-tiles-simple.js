const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TILE_SIZE = 256;
const SVG_PATH = 'public/maps/BasementMapSVG-clean.svg';  // Vector source without markers/anchors
const OUTPUT_DIR = 'public/maps/tiles';

// Map dimensions (native SVG dimensions)
const MAP_WIDTH = 1707;
const MAP_HEIGHT = 993;

async function generateTiles() {
  console.log('Starting SVG tile generation...');
  
  // Clear output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Native zoom level: where 1 tile side ≈ 256px of the map  
  // SVG renders crisp at any zoom level!
  const nativeZoom = 6;  // Native resolution at zoom 6
  const minZoom = 3;     // Zoomed out (1/8 scale overview)
  const maxZoom = 8;     // Zoomed in (4x upscale for detail)
  
  console.log(`Zoom range: ${minZoom}-${maxZoom} (native at ${nativeZoom})`);

  for (let z = minZoom; z <= maxZoom; z++) {
    console.log(`\nZoom ${z}...`);
    
    // Calculate map size at this zoom level relative to native
    // At nativeZoom: scale = 1 (native resolution)
    // Below nativeZoom: scale < 1 (smaller)
    // Above nativeZoom: scale > 1 (larger, crisp from SVG!)
    const scale = Math.pow(2, z - nativeZoom);
    const levelWidth = Math.round(MAP_WIDTH * scale);
    const levelHeight = Math.round(MAP_HEIGHT * scale);
    
    console.log(`  Map size: ${levelWidth}x${levelHeight}px`);
    
    // Render SVG at target resolution (density controls SVG rasterization quality)
    // Default SVG density is 72 DPI. Scale it to get our target size.
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
        
        // Pad if needed
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
  
  console.log('\n✅ Tiles generated!');
}

generateTiles().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
