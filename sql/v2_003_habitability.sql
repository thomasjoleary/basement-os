-- v2 Galaxy: planetary traits for habitability scoring
-- Run this in the Supabase SQL Editor, after v2_001_galaxy.sql.
--
-- Adds the per-world properties that cannot be derived from mass and orbit.
-- Everything here is nullable: a body with none of it set still scores, using
-- defaults inferred from its class (see CLASS_TRAIT_DEFAULTS in lib/galaxy.ts).
--
-- Two scores are computed from these, and they deliberately disagree:
--   habitability -- can an unprotected being survive on the surface?
--   settlement   -- can a technological species build a colony here?
-- An airless ice moon scores 0 for the first and very well for the second.

ALTER TABLE v2_system_bodies
  -- Atmosphere -------------------------------------------------------------
  -- 'none' | 'trace' | 'thin' | 'breathable' | 'dense' | 'toxic' | 'corrosive'
  ADD COLUMN IF NOT EXISTS atmosphere TEXT,
  -- Surface pressure in Earth atmospheres. Earth = 1, Mars = 0.006, Venus = 92.
  ADD COLUMN IF NOT EXISTS pressure_atm NUMERIC,
  -- Oxygen as a percentage of the atmosphere. What actually matters for
  -- breathing is the PARTIAL pressure (pressure_atm * oxygen_pct), since a
  -- thin atmosphere of pure oxygen is still suffocating.
  ADD COLUMN IF NOT EXISTS oxygen_pct NUMERIC,

  -- Surface ----------------------------------------------------------------
  -- 'none' | 'ice' | 'trace' | 'seas' | 'ocean_world'
  ADD COLUMN IF NOT EXISTS hydrosphere TEXT,
  -- Mean surface temperature in Celsius. Null = derive from stellar flux.
  ADD COLUMN IF NOT EXISTS surface_temp_c NUMERIC,

  -- Long-term climate ------------------------------------------------------
  -- 'dead' | 'stagnant' | 'active' -- drives the carbonate-silicate thermostat
  ADD COLUMN IF NOT EXISTS tectonics TEXT,
  -- 'none' | 'weak' | 'strong'. Deliberately a MINOR factor: Venus has no
  -- intrinsic field and 90 bar of atmosphere, and a dipole can increase escape
  -- via polar wind. Never gate habitability on this.
  ADD COLUMN IF NOT EXISTS magnetosphere TEXT,
  ADD COLUMN IF NOT EXISTS axial_tilt_deg NUMERIC,
  ADD COLUMN IF NOT EXISTS rotation_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS eccentricity NUMERIC,

  -- Fiction ----------------------------------------------------------------
  -- 'none' | 'microbial' | 'complex' | 'exotic' -- the GM's call, not physics
  ADD COLUMN IF NOT EXISTS biosphere TEXT,
  -- What can be mined or cracked locally, e.g. ["water_ice","metals","nitrogen"].
  -- Drives self-sufficiency in the settlement score.
  ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '[]',

  -- GM override: when set, this number is shown instead of the computed
  -- habitability score. For when the fiction should beat the physics.
  ADD COLUMN IF NOT EXISTS habitability_override INT;

COMMENT ON COLUMN v2_system_bodies.oxygen_pct IS
  'Oxygen as a percent of the atmosphere. Breathability uses the partial pressure (pressure_atm * oxygen_pct/100), not this figure alone.';
COMMENT ON COLUMN v2_system_bodies.magnetosphere IS
  'Minor modifier only. Field strength does not reliably determine atmospheric retention (Venus counterexample; polar-wind escape).';
