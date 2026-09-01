-- OPTIONAL sample galaxy for the v2 map.
--
-- Run this only if you want something on the map immediately -- it is a
-- convenient way to confirm v2_001 worked end to end. It is safe to delete
-- everything it creates afterwards:
--
--   DELETE FROM v2_star_systems WHERE name IN
--     ('Helios Reach', 'Tarsis Gate', 'Cold Harbour', 'The Maw');
--
-- (bodies cascade away with their system)
--
-- Masses/radii are real-ish so the derived orbital periods come out sensible.

-- ---------------------------------------------------------------------------
-- Helios Reach -- a Sun-like anchor system with a nested moon + station chain
-- ---------------------------------------------------------------------------
WITH sys AS (
  INSERT INTO v2_star_systems (name, x, y, z, description, discovered)
  VALUES ('Helios Reach', 0, 0, 0, 'A yellow star and the first foothold. Everything is measured from here.', true)
  RETURNING id
), star AS (
  INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, mass_solar, radius_km)
  SELECT id, NULL, 'star', 'Helios', 'yellow', 0, 1.0, 696340 FROM sys
  RETURNING id, system_id
), inner_world AS (
  INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, angle_deg, mass_solar, radius_km, description)
  SELECT system_id, id, 'planet', 'Kess', 'terrestrial', 0.9, 40, 3.0e-6, 6100, 'Temperate and settled. The closest thing to a capital.' FROM star
  RETURNING id
), giant AS (
  INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, angle_deg, mass_solar, radius_km, description)
  SELECT system_id, id, 'planet', 'Tannhauser', 'gas_giant', 5.2, 210, 9.5e-4, 69911, 'A banded giant with a crowded moon system.' FROM star
  RETURNING id, (SELECT system_id FROM star) AS system_id
), moon AS (
  -- A moon of the gas giant: three levels deep from the barycentre.
  INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, angle_deg, mass_solar, radius_km, description)
  SELECT system_id, id, 'moon', 'Verge', 'ice', 0.0071, 90, 2.4e-7, 1560, 'Ice crust over a liquid ocean. Something is under it.' FROM giant
  RETURNING id, system_id
)
-- A station orbiting that moon: four levels deep.
INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, angle_deg, description)
SELECT system_id, id, 'station', 'Waystation Kell', 'trade_hub', 0.0002, 15, 'Fuel, contraband, and bad coffee.' FROM moon;

-- ---------------------------------------------------------------------------
-- Tarsis Gate -- a hot blue-white star with an asteroid belt
-- ---------------------------------------------------------------------------
WITH sys AS (
  INSERT INTO v2_star_systems (name, x, y, z, description, discovered)
  VALUES ('Tarsis Gate', 18, -11, 4, 'Young, bright and violent. The belt is worth more than the planets.', true)
  RETURNING id
), star AS (
  INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, mass_solar, radius_km)
  SELECT id, NULL, 'star', 'Tarsis', 'blue_white', 0, 4.2, 2500000 FROM sys
  RETURNING id, system_id
)
INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, angle_deg, description)
SELECT system_id, id, 'belt', 'The Tarsis Belt', 'asteroid_belt', 12, 0, 'Metal-rich rubble. Contested by three mining concerns.' FROM star;

-- ---------------------------------------------------------------------------
-- Cold Harbour -- a red dwarf with a close-in tidally locked world
-- ---------------------------------------------------------------------------
WITH sys AS (
  INSERT INTO v2_star_systems (name, x, y, z, description, discovered)
  VALUES ('Cold Harbour', -24, 9, -6, 'A dim red dwarf. Its one habitable world hugs the star.', false)
  RETURNING id
), star AS (
  INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, mass_solar, radius_km)
  SELECT id, NULL, 'star', 'Cold Harbour', 'red_dwarf', 0, 0.3, 210000 FROM sys
  RETURNING id, system_id
)
INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, angle_deg, mass_solar, radius_km, description)
SELECT system_id, id, 'planet', 'Lantern', 'terrestrial', 0.12, 300, 2.5e-6, 5800, 'Tidally locked. One face burns, one freezes, life clings to the terminator.' FROM star;

-- ---------------------------------------------------------------------------
-- The Maw -- a black hole at the centre and NOTHING else orbiting it
-- ---------------------------------------------------------------------------
WITH sys AS (
  INSERT INTO v2_star_systems (name, x, y, z, description, discovered)
  VALUES ('The Maw', 41, 33, 12, 'No planets. No debris. Only the hole, and whatever is brave enough to sit near it.', false)
  RETURNING id
)
INSERT INTO v2_system_bodies (system_id, parent_id, kind, name, body_class, orbital_radius_au, mass_solar, radius_km, description)
-- 12 solar masses -> event horizon radius ~35.4 km (r_s = 2.95km per solar mass).
SELECT id, NULL, 'star', 'The Maw', 'black_hole', 0, 12.0, 35.4,
       'A stellar-mass black hole. No surface, no light -- only the horizon.'
FROM sys;
