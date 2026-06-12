-- Update dungeon marker names and descriptions by coordinate matching
-- Coordinates stored as x/2560, y/1366 (no Y-flip) per import-markers.ts

UPDATE map_markers SET name = 'Lizard''s Third Tail', description = 'Lizard''s Third Tail Repeatable' WHERE ABS(x - 0.23062) < 0.005 AND ABS(y - 0.63141) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Azaram''s Final Breaths', description = 'Azaram''s Final Breaths Repeatable' WHERE ABS(x - 0.22160) < 0.005 AND ABS(y - 0.57059) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Polar Breeze', description = 'Polar Breeze Dungeon - Found by Kaelen and Repeatable' WHERE ABS(x - 0.19797) < 0.005 AND ABS(y - 0.62416) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'The Gnolls Transgression', description = 'The Gnolls'' Transgression - Rank A Dungeon Found by Drew and Brady' WHERE ABS(x - 0.16433) < 0.005 AND ABS(y - 0.60849) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Rocky Roads', description = 'Rob - Rocky Roads dungeon' WHERE ABS(x - 0.24957) < 0.005 AND ABS(y - 0.86262) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Flying Issues', description = 'Found by Rob' WHERE ABS(x - 0.20765) < 0.005 AND ABS(y - 0.38783) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Green Shell', description = 'Green Shell - Jack' WHERE ABS(x - 0.22659) < 0.005 AND ABS(y - 0.47598) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Prehistory''s Thorns', description = 'Prehistory''s Thorns - Brady' WHERE ABS(x - 0.19734) < 0.005 AND ABS(y - 0.69310) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Imp Problem', description = 'found by luke' WHERE ABS(x - 0.20472) < 0.005 AND ABS(y - 0.60426) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Decisions Decisions', description = 'found by kaelen' WHERE ABS(x - 0.05033) < 0.005 AND ABS(y - 0.60474) < 0.005 AND type IN ('dungeon', 'dungeons');
UPDATE map_markers SET name = 'Rainbow Roads', description = 'Found by Drew' WHERE ABS(x - 0.19934) < 0.005 AND ABS(y - 0.60772) < 0.005 AND type IN ('dungeon', 'dungeons');