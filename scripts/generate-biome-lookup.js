const fs = require('fs');
const { createCanvas } = require('canvas');

const JSON_PATH = 'BasementMapJSON.json';
const OUTPUT_PATH = 'public/maps/biome-lookup.png';

// Lookup image dimensions - full resolution for accurate sampling
const LOOKUP_WIDTH = 1707;
const LOOKUP_HEIGHT = 993;

// Original map dimensions (from Azgaar)
const MAP_WIDTH = 2560;
const MAP_HEIGHT = 1366;

async function generateBiomeLookup() {
  console.log('Loading JSON data...');
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  
  const { biomesData, pack } = data;
  const { cells, vertices } = pack;
  
  console.log(`Cells: ${cells.length}`);
  
  // Build vertex lookup
  const vertexCoords = {};
  for (const v of vertices) {
    vertexCoords[v.i] = v.p;
  }
  
  // Create canvas
  const canvas = createCanvas(LOOKUP_WIDTH, LOOKUP_HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // Fill with ocean (biome 0) as default
  ctx.fillStyle = `rgb(0, 0, 0)`;
  ctx.fillRect(0, 0, LOOKUP_WIDTH, LOOKUP_HEIGHT);
  
  // Scale factor from original coords to lookup image
  const scaleX = LOOKUP_WIDTH / MAP_WIDTH;
  const scaleY = LOOKUP_HEIGHT / MAP_HEIGHT;
  
  console.log('Drawing cells...');
  
  for (const cell of cells) {
    // Get vertex coordinates
    const points = [];
    for (const vi of cell.v) {
      const coord = vertexCoords[vi];
      if (coord) {
        points.push([coord[0] * scaleX, coord[1] * scaleY]);
      }
    }
    
    if (points.length < 3) continue;
    
    // Encode biome ID in the red channel (0-12)
    // Use green=255 as a marker that this is valid data
    const biomeId = cell.biome;
    ctx.fillStyle = `rgb(${biomeId}, 255, 0)`;
    
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
  }
  
  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(OUTPUT_PATH, buffer);
  
  console.log(`✅ Saved biome lookup to ${OUTPUT_PATH} (${LOOKUP_WIDTH}x${LOOKUP_HEIGHT})`);
}

generateBiomeLookup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
