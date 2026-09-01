-- v2 Galaxy map (Basement OS v2 -- the space setting)
-- Run this in the Supabase SQL Editor.
--
-- All v2 tables are prefixed `v2_` and live alongside the existing D&D tables.
-- Nothing here touches the legacy schema; auth/profiles stay shared so logins
-- work across both versions.
--
-- Three tables:
--   v2_star_systems     -- nodes on the galaxy map, positioned in light-years
--   v2_system_bodies    -- stars, planets, moons, stations, belts (self-nesting)
--   v2_galaxy_settings  -- singleton (id = 1) holding the jump-time constants

-- =========================================================================
-- v2_star_systems
-- =========================================================================
CREATE TABLE IF NOT EXISTS v2_star_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL DEFAULT 'New System',

  -- Position in light-years from the galactic origin.
  -- z is stored now (top-down map ignores it) so a future 3D view needs no migration.
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  z NUMERIC NOT NULL DEFAULT 0,

  description TEXT NOT NULL DEFAULT '',
  gm_notes TEXT NOT NULL DEFAULT '',

  -- Player-facing visibility. The GM builder ignores this; the future player
  -- view will only show discovered systems (see the RLS policy below).
  discovered BOOLEAN NOT NULL DEFAULT false,

  tags TEXT[] NOT NULL DEFAULT '{}',

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- v2_system_bodies
--
-- One table for everything inside a system. The hierarchy is the point:
-- parent_id NULL means the body orbits the system barycentre (i.e. it is a
-- star, or a free-floating station); otherwise it orbits that body. That is
-- what makes moons moons, and lets a station orbit a moon of a gas giant.
-- =========================================================================
CREATE TABLE IF NOT EXISTS v2_system_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES v2_star_systems(id) ON DELETE CASCADE,

  -- Deleting a body removes everything orbiting it, recursively.
  parent_id UUID REFERENCES v2_system_bodies(id) ON DELETE CASCADE,

  kind TEXT NOT NULL DEFAULT 'planet'
    CHECK (kind IN ('star', 'planet', 'moon', 'station', 'belt')),

  name TEXT NOT NULL DEFAULT 'New Body',

  -- Id from the matching class list in lib/galaxy.ts
  -- (STAR_CLASSES / PLANET_CLASSES / STATION_CLASSES / BELT_CLASSES).
  body_class TEXT NOT NULL DEFAULT 'terrestrial',

  -- Distance from the parent, in AU.
  orbital_radius_au NUMERIC NOT NULL DEFAULT 1,

  -- Explicit period override in days. NULL = derive it from Kepler's third law
  -- using the parent's mass (P_years = sqrt(a_AU^3 / M_solar)).
  orbital_period_days NUMERIC,

  -- Position on the orbit at epoch, in degrees.
  angle_deg NUMERIC NOT NULL DEFAULT 0,

  -- Always solar masses, for uniform Kepler math. The editor shows planets and
  -- moons in Earth masses and converts on save (1 solar = 332,946 Earth).
  mass_solar NUMERIC,
  radius_km NUMERIC,

  -- Optional colour override; otherwise the class colour is used.
  color TEXT,

  description TEXT NOT NULL DEFAULT '',
  gm_notes TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_bodies_system ON v2_system_bodies(system_id);
CREATE INDEX IF NOT EXISTS idx_v2_bodies_parent ON v2_system_bodies(parent_id);

-- =========================================================================
-- v2_galaxy_settings -- singleton, same pattern as published_leaderboard
--
-- Jump time = jump_charge_hours + (distance_ly / jump_speed_ly_per_hour),
-- kept in the database so travel times are tunable without a deploy.
-- =========================================================================
CREATE TABLE IF NOT EXISTS v2_galaxy_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  galaxy_name TEXT NOT NULL DEFAULT 'Uncharted Galaxy',
  jump_charge_hours NUMERIC NOT NULL DEFAULT 6,
  jump_speed_ly_per_hour NUMERIC NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO v2_galaxy_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- updated_at triggers
-- =========================================================================
CREATE OR REPLACE FUNCTION set_v2_galaxy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS v2_star_systems_updated_at ON v2_star_systems;
CREATE TRIGGER v2_star_systems_updated_at
  BEFORE UPDATE ON v2_star_systems
  FOR EACH ROW EXECUTE FUNCTION set_v2_galaxy_updated_at();

DROP TRIGGER IF EXISTS v2_system_bodies_updated_at ON v2_system_bodies;
CREATE TRIGGER v2_system_bodies_updated_at
  BEFORE UPDATE ON v2_system_bodies
  FOR EACH ROW EXECUTE FUNCTION set_v2_galaxy_updated_at();

DROP TRIGGER IF EXISTS v2_galaxy_settings_updated_at ON v2_galaxy_settings;
CREATE TRIGGER v2_galaxy_settings_updated_at
  BEFORE UPDATE ON v2_galaxy_settings
  FOR EACH ROW EXECUTE FUNCTION set_v2_galaxy_updated_at();

-- =========================================================================
-- RLS
--
-- GMs manage everything. Players get read-only access to discovered systems
-- only -- the builder is GM-only today, but shipping the player-read policies
-- now means the future player view needs no migration.
--
-- NOTE: the player policies are written but untested against a live database.
-- Verify them with a player account before relying on them to hide anything.
-- =========================================================================
ALTER TABLE v2_star_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_system_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_galaxy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GMs manage star systems" ON v2_star_systems;
CREATE POLICY "GMs manage star systems" ON v2_star_systems
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

-- Players see discovered systems only. gm_notes is still exposed by this policy;
-- keep private prose out of that column until a column-level view is added.
DROP POLICY IF EXISTS "Players read discovered systems" ON v2_star_systems;
CREATE POLICY "Players read discovered systems" ON v2_star_systems
  FOR SELECT
  USING (discovered = true);

DROP POLICY IF EXISTS "GMs manage system bodies" ON v2_system_bodies;
CREATE POLICY "GMs manage system bodies" ON v2_system_bodies
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

DROP POLICY IF EXISTS "Players read bodies of discovered systems" ON v2_system_bodies;
CREATE POLICY "Players read bodies of discovered systems" ON v2_system_bodies
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM v2_star_systems s
    WHERE s.id = v2_system_bodies.system_id AND s.discovered = true
  ));

DROP POLICY IF EXISTS "GMs manage galaxy settings" ON v2_galaxy_settings;
CREATE POLICY "GMs manage galaxy settings" ON v2_galaxy_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'gm'));

-- Jump-time constants are not secret; players need them to read travel times.
DROP POLICY IF EXISTS "Authenticated read galaxy settings" ON v2_galaxy_settings;
CREATE POLICY "Authenticated read galaxy settings" ON v2_galaxy_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =========================================================================
-- Realtime
-- Guarded so this migration can be re-run safely.
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'v2_star_systems'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE v2_star_systems;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'v2_system_bodies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE v2_system_bodies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'v2_galaxy_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE v2_galaxy_settings;
  END IF;
END $$;
