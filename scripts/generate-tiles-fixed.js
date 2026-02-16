const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TILE_SIZE = 256;
const SVG_PATH = 'public/maps/BasementMapClean.svg';
const OUTPUT_DIR = 'public/maps/tiles';

// Map dimensions (SVG dimensions)
const MAP_WIDTH = 2560;
const MAP_HEIGHT = 1366;

async function generateTiles() {
  console.log('Generating tiles with fixed coordinate space...');
  console.log(`Coordinate space: ${MAP_WIDTH}x${MAP_HEIGHT}`);
  
  // Clear output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Read SVG and render at exact dimensions
  console.log('Loading SVG...');
  const fullResPng = await sharp(SVG_PATH)
    .resize(MAP_WIDTH, MAP_HEIGHT)
    .png()
    .toBuffer();

  // Calculate zoom levels
  // At each zoom level z:
  // - The map is 2^z * MAP_WIDTH x 2^z * MAP_HEIGHT pixels on screen
  // - But we render it at the appropriate resolution for that zoom
  // We want zoom 0 to show the whole map at roughly viewport size
  // So zoom 0 = ~1707x993 pixels, zoom 1 = ~3414x1986, etc.
  
  // Min zoom: map fits in one tile
  const minZoom = 0;
  // Max zoom: just 1 extra level for zooming in (2x native)
  const maxZoom = 1;
  
  for (let z = minZoom; z <= maxZoom; z++) {
    console.log(`\nZoom ${z}...`);
    
    // At zoom z, the map is rendered at:
    // - Screen size: MAP_WIDTH * 2^z x MAP_HEIGHT * 2^z
    // - But we can only render up to the source resolution
    const scaleFactor = Math.pow(2, z);
    const renderWidth = Math.min(MAP_WIDTH * scaleFactor, MAP_WIDTH);
    const renderHeight = Math.min(MAP_HEIGHT * scaleFactor, MAP_HEIGHT);
    
    // For higher zooms, we upscale the image
    const targetWidth = Math.round(MAP_WIDTH * scaleFactor);
    const targetHeight = Math.round(MAP_HEIGHT * scaleFactor);
    
    console.log(`  Render: ${targetWidth}x${targetHeight}`);
    
    // Resize image for this zoom level
    const levelImage = await sharp(fullResPng)
      .resize(targetWidth, targetHeight, { 
        fit: 'fill', 
        kernel: targetWidth > MAP_WIDTH ? 'lanczos3' : 'lanczos3'
      })
      .png()
      .toBuffer();
    
    // Calculate tiles needed
    const tilesX = Math.ceil(targetWidth / TILE_SIZE);
    const tilesY = Math.ceil(targetHeight / TILE_SIZE);
    
    console.log(`  Tiles: ${tilesX}x${tilesY} = ${tilesX * tilesY}`);
    
    const zoomDir = path.join(OUTPUT_DIR, z.toString());
    fs.mkdirSync(zoomDir, { recursive: true });
    
    for (let x = 0; x < tilesX; x++) {
      const colDir = path.join(zoomDir, x.toString());
      fs.mkdirSync(colDir, { recursive: true });
      
      for (let y = 0; y < tilesY; y++) {
        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const width = Math.min(TILE_SIZE, targetWidth - left);
        const height = Math.min(TILE_SIZE, targetHeight - top);
        
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
  console.log('Zoom 0 = native resolution (1707x993)');
  console.log('Zoom 3 = 8x zoom (13656x7944, capped at source resolution)');
}

generateTiles().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
