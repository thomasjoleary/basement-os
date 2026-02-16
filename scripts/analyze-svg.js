const fs = require('fs');
const svg = fs.readFileSync('public/maps/BasementMapSVG.svg', 'utf-8');

// Find all symbol definitions
const symbols = svg.match(/<symbol[^>]*id="([^"]+)"/g);
console.log('Symbol definitions:');
symbols?.forEach(s => console.log('  ' + s));

// Find all group IDs  
const groups = svg.match(/<g[^>]*id="([^"]+)"/g);
console.log('\nGroup IDs (first 30):');
groups?.slice(0, 30).forEach(g => console.log('  ' + g));

// Count use elements by href
const uses = svg.match(/href="#([^"]+)"/g);
const useCounts = {};
uses?.forEach(u => {
  const match = u.match(/href="#([^"]+)"/);
  if (match) {
    const id = match[1];
    useCounts[id] = (useCounts[id] || 0) + 1;
  }
});
console.log('\nMost used references (top 20):');
Object.entries(useCounts).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([id, count]) => {
  console.log(`  ${id}: ${count}`);
});

// Look for anything with "anchor" or "marker" in the name
console.log('\nAnchor/marker related patterns:');
const anchorPatterns = svg.match(/[^"]*anchor[^"]*/gi);
const uniqueAnchors = [...new Set(anchorPatterns || [])].slice(0, 10);
uniqueAnchors.forEach(a => console.log('  ' + a.substring(0, 80)));

const markerPatterns = svg.match(/id="[^"]*marker[^"]*"/gi);
console.log('\nMarker IDs:');
markerPatterns?.slice(0, 10).forEach(m => console.log('  ' + m));
