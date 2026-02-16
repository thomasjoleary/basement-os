const fs = require('fs');
const path = require('path');

const JSON_PATH = 'BasementMapJSON.json';
const OUTPUT_PATH = 'public/maps/BiomeOverlay.svg';

// Map dimensions (from Azgaar export)
const MAP_WIDTH = 2560;
const MAP_HEIGHT = 1366;

async function generateBiomeSVG() {
  console.log('Loading JSON data...');
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  
  const { biomesData, pack } = data;
  const { cells, vertices } = pack;
  
  console.log(`Biomes: ${biomesData.name.length}`);
  console.log(`Cells: ${cells.length}`);
  console.log(`Vertices: ${vertices.length}`);
  
  // Build vertex lookup (index -> [x, y])
  const vertexCoords = {};
  for (const v of vertices) {
    vertexCoords[v.i] = v.p;
  }
  
  console.log('Generating SVG polygons...');
  
  // Start SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${MAP_WIDTH}" height="${MAP_HEIGHT}" 
     viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">
  <g id="biomes">
`;

  let cellCount = 0;
  let skipped = 0;
  
  for (const cell of cells) {
    // Skip ocean cells (biome 0 is Marine)
    if (cell.biome === 0) {
      skipped++;
      continue;
    }
    
    // Get vertex coordinates for this cell
    const points = [];
    for (const vi of cell.v) {
      const coord = vertexCoords[vi];
      if (coord) {
        points.push(`${coord[0]},${coord[1]}`);
      }
    }
    
    if (points.length < 3) {
      skipped++;
      continue;
    }
    
    const color = biomesData.color[cell.biome];
    const pointsStr = points.join(' ');
    
    svg += `    <polygon points="${pointsStr}" fill="${color}" stroke="none"/>\n`;
    cellCount++;
  }
  
  svg += `  </g>
</svg>`;

  console.log(`Generated ${cellCount} polygons, skipped ${skipped} (ocean/invalid)`);
  
  // Write SVG
  fs.writeFileSync(OUTPUT_PATH, svg);
  console.log(`✅ Saved to ${OUTPUT_PATH}`);
}

generateBiomeSVG().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
