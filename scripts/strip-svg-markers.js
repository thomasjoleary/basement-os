const fs = require('fs');

const INPUT_SVG = 'public/maps/BasementMapSVG.svg';
const OUTPUT_SVG = 'public/maps/BasementMapClean.svg';

console.log('Reading SVG...');
let svg = fs.readFileSync(INPUT_SVG, 'utf-8');
const originalSize = svg.length;

// 1. Remove the icon-anchor symbol definition
console.log('Removing icon-anchor symbol...');
const anchorSymbolMatch = svg.match(/<symbol[^>]*id="icon-anchor"[\s\S]*?<\/symbol>/);
if (anchorSymbolMatch) {
  svg = svg.replace(anchorSymbolMatch[0], '');
  console.log('  Removed icon-anchor symbol');
}

// 2. Remove all <use> elements referencing icon-anchor
const anchorUses = (svg.match(/<use[^>]*href="#icon-anchor"[^>]*\/?>/g) || []).length;
svg = svg.replace(/<use[^>]*href="#icon-anchor"[^>]*\/?>/g, '');
console.log(`  Removed ${anchorUses} anchor use elements`);

// 3. Remove the entire anchors group
// Find <g id="anchors"...>...</g> - need to handle nested groups
const anchorsStart = svg.indexOf('<g id="anchors"');
if (anchorsStart !== -1) {
  let depth = 0;
  let i = anchorsStart;
  let endIndex = -1;
  
  while (i < svg.length) {
    if (svg.substring(i, i + 2) === '<g') {
      depth++;
    } else if (svg.substring(i, i + 4) === '</g>') {
      depth--;
      if (depth === 0) {
        endIndex = i + 4;
        break;
      }
    }
    i++;
  }
  
  if (endIndex !== -1) {
    svg = svg.substring(0, anchorsStart) + svg.substring(endIndex);
    console.log('  Removed anchors group');
  }
}

// 4. Remove the entire markers group
const markersStart = svg.indexOf('<g id="markers"');
if (markersStart !== -1) {
  let depth = 0;
  let i = markersStart;
  let endIndex = -1;
  
  while (i < svg.length) {
    if (svg.substring(i, i + 2) === '<g') {
      depth++;
    } else if (svg.substring(i, i + 4) === '</g>') {
      depth--;
      if (depth === 0) {
        endIndex = i + 4;
        break;
      }
    }
    i++;
  }
  
  if (endIndex !== -1) {
    svg = svg.substring(0, markersStart) + svg.substring(endIndex);
    console.log('  Removed markers group');
  }
}

// 5. Remove icon-circle symbol and uses (city/town markers)
const circleSymbolMatch = svg.match(/<symbol[^>]*id="icon-circle"[\s\S]*?<\/symbol>/g);
if (circleSymbolMatch) {
  circleSymbolMatch.forEach(match => {
    svg = svg.replace(match, '');
  });
  console.log(`  Removed ${circleSymbolMatch.length} icon-circle symbols`);
}

const circleUses = (svg.match(/<use[^>]*href="#icon-circle"[^>]*\/?>/g) || []).length;
svg = svg.replace(/<use[^>]*href="#icon-circle"[^>]*\/?>/g, '');
console.log(`  Removed ${circleUses} circle use elements`);

// Write the cleaned SVG
console.log('Writing cleaned SVG...');
fs.writeFileSync(OUTPUT_SVG, svg);

console.log(`\n✅ Saved to ${OUTPUT_SVG}`);
console.log(`Original size: ${originalSize} bytes`);
console.log(`Cleaned size: ${svg.length} bytes`);
console.log(`Removed: ${originalSize - svg.length} bytes`);
