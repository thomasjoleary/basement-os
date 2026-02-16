const fs = require('fs');
const svg = fs.readFileSync('public/maps/MapOfWorld.svg', 'utf-8');

// Find all g tags with ids and styles
const lines = svg.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('<g') && line.includes('id=')) {
    const idMatch = line.match(/id="([^"]+)"/);
    const styleMatch = line.match(/style="([^"]*)"/);
    const displayMatch = line.match(/display="([^"]*)"/);
    
    if (idMatch) {
      console.log(`Line ${idx}: ${idMatch[1]}`);
      if (styleMatch) console.log(`  style: ${styleMatch[1]}`);
      if (displayMatch) console.log(`  display: ${displayMatch[1]}`);
    }
  }
});
