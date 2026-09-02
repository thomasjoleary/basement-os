// Shared types, constants & helpers for the v2 Galaxy map.
//
// Coordinates are light-years on a 3D axis. The map renders top-down (x/y) for now;
// z is stored so a future 3D view needs no migration.
//
// Orbital data uses AU for radii and solar masses for mass, so Kepler's third law
// stays a one-liner (see orbitalPeriodYears).

export type BodyKind = 'star' | 'planet' | 'moon' | 'station' | 'belt'

export type AtmosphereType = 'none' | 'trace' | 'thin' | 'breathable' | 'dense' | 'toxic' | 'corrosive'
export type HydrosphereType = 'none' | 'ice' | 'trace' | 'seas' | 'ocean_world'
export type TectonicsType = 'dead' | 'stagnant' | 'active'
export type MagnetosphereType = 'none' | 'weak' | 'strong'
export type BiosphereType = 'none' | 'microbial' | 'complex' | 'exotic'
export type ResourceId = 'water_ice' | 'liquid_water' | 'metals' | 'nitrogen' | 'carbon' | 'organics' | 'fissiles' | 'geothermal'

export interface StarSystem {
  id: string
  name: string
  // Position in light-years from the galactic origin.
  x: number
  y: number
  z: number
  description: string
  gm_notes: string
  // Player-facing visibility flag. Unused by the GM builder; reserved for the player view.
  discovered: boolean
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SystemBody {
  id: string
  system_id: string
  // null = orbits the system barycentre (a star, or a free-floating station).
  // Otherwise the body this one orbits -- that is what makes a "moon" a moon.
  parent_id: string | null
  kind: BodyKind
  name: string
  // Id from STAR_CLASSES / PLANET_CLASSES / STATION_CLASSES depending on kind.
  body_class: string
  // Distance from the parent, in AU.
  orbital_radius_au: number
  // Orbital period in days. Null = derive it from Kepler's third law.
  orbital_period_days: number | null
  // Where the body sits on its orbit at epoch, in degrees (0-360).
  angle_deg: number
  // Mass in solar masses for every body, so Kepler math is uniform.
  // The editor shows planets/moons in Earth masses and converts on save.
  mass_solar: number | null
  radius_km: number | null
  color: string | null
  description: string
  gm_notes: string
  // --- Habitability traits (sql/v2_003). All nullable; when unset the body's
  // class supplies a default so every world still scores. ---
  atmosphere: AtmosphereType | null
  pressure_atm: number | null
  oxygen_pct: number | null
  hydrosphere: HydrosphereType | null
  surface_temp_c: number | null
  tectonics: TectonicsType | null
  magnetosphere: MagnetosphereType | null
  axial_tilt_deg: number | null
  rotation_hours: number | null
  eccentricity: number | null
  biosphere: BiosphereType | null
  resources: ResourceId[]
  habitability_override: number | null
  created_at: string
  updated_at: string
}

// Singleton row (id = 1). Galaxy-level data only.
//
// NOTE: this table still has jump_charge_hours / jump_speed_ly_per_hour columns
// from the original migration, but nothing reads them any more -- jump
// performance is a property of the SHIP, not the galaxy (see JumpDrive below).
// The columns are left in place rather than forcing another migration.
export interface GalaxySettings {
  id: number
  galaxy_name: string
  updated_at: string
}

export const DEFAULT_SETTINGS: GalaxySettings = {
  id: 1,
  galaxy_name: 'Uncharted Galaxy',
  updated_at: '',
}

// ===========================================================================
// Jump drives
//
// Charge time and speed belong to the ship and its components, not the galaxy,
// so these live in code (and eventually on a ship record) rather than the DB.
//
// The setting's fiction: space is many layers of fabric. Charging longer
// "sharpens" the jump so the drive cuts through cleanly; a drive with almost no
// charge time is a "hammer drive" that punches through by brute force, which is
// why it draws so much power.
// ===========================================================================

export interface JumpDrive {
  id: string
  label: string
  // Fixed spin-up paid on every jump, regardless of distance.
  charge_hours: number
  // Cruise speed once charged.
  speed_ly_per_hour: number
  // Flavour, and a hook for future power/component budgeting.
  power_draw: 'low' | 'medium' | 'high'
  blurb: string
}

// Placeholder values -- tune freely, nothing depends on these numbers.
export const DRIVE_PROFILES: JumpDrive[] = [
  {
    id: 'standard',
    label: 'Standard Drive',
    charge_hours: 6,
    speed_ly_per_hour: 1,
    power_draw: 'medium',
    blurb: 'A balanced cut. What most hulls ship with.',
  },
  {
    id: 'hammer',
    label: 'Hammer Drive',
    charge_hours: 1,
    speed_ly_per_hour: 0.4,
    power_draw: 'high',
    blurb: 'Almost no charge time -- it punches through the fabric by force. Fast to leave, slow to arrive, and it drinks power.',
  },
  {
    id: 'lance',
    label: 'Lance Drive',
    charge_hours: 18,
    speed_ly_per_hour: 2.5,
    power_draw: 'low',
    blurb: 'A long charge sharpens the jump to a razor. Sips power and covers ground once underway -- if you can afford the wait.',
  },
]

export const DEFAULT_DRIVE: JumpDrive = DRIVE_PROFILES[0]

export function driveProfile(id: string): JumpDrive {
  return DRIVE_PROFILES.find(d => d.id === id) ?? DEFAULT_DRIVE
}

// ===========================================================================
// Star classes
//
// Real stellar classification under approachable labels. Temperature, mass,
// radius and luminosity are the standard main-sequence ranges.
//
// Colours come from Mitchell Charity's blackbody table (CIE 1931 matching
// functions, sRGB/D65) -- the same values planetarium software uses. Note that
// O/B stars are blue-WHITE, not the saturated blue of pop culture: blackbody
// chromaticity converges to a pale blue-white as temperature rises, so no
// thermal starlight is ever deeply blue.
//
// Worth knowing when populating the map: roughly a third of systems are
// multiple (binary or more), and that fraction rises steeply with mass --
// most O/B stars have companions, while red dwarfs are usually alone.
// ===========================================================================

export interface StarClass {
  id: string
  label: string
  // Real spectral type, shown as a subtitle for the astronomy-minded.
  spectral: string
  color: string
  // Surface temperature range in Kelvin.
  tempK: [number, number]
  // Mass / radius in solar units.
  massSolar: [number, number]
  radiusSolar: [number, number]
  // Luminosity in solar units.
  luminosity: [number, number]
  // Share of main-sequence stars, where meaningful.
  abundance: string
  blurb: string
}

export const STAR_CLASSES: StarClass[] = [
  {
    id: 'blue_giant',
    label: 'Blue Giant',
    spectral: 'O-type main sequence',
    color: '#9bb0ff',
    tempK: [30000, 52000],
    massSolar: [15, 90],
    radiusSolar: [6.6, 15],
    luminosity: [30000, 1000000],
    abundance: 'Vanishingly rare (~1 in 3 million)',
    blurb: 'Enormous, furiously hot and short-lived. Burns out in a few million years.',
  },
  {
    id: 'blue_white',
    label: 'Blue-White Star',
    spectral: 'B-type main sequence',
    color: '#aabfff',
    tempK: [10000, 30000],
    massSolar: [2.1, 16],
    radiusSolar: [1.8, 8],
    luminosity: [25, 30000],
    abundance: '~0.1% of main-sequence stars',
    blurb: 'Hot and luminous. Often found in young clusters near its birth nebula.',
  },
  {
    id: 'white',
    label: 'White Star',
    spectral: 'A-type main sequence',
    color: '#cad7ff',
    tempK: [7500, 10000],
    massSolar: [1.4, 2.1],
    radiusSolar: [1.4, 2.4],
    luminosity: [5, 25],
    abundance: '~0.6% of main-sequence stars',
    blurb: 'Bright white and fast-burning. Sirius is the familiar example.',
  },
  {
    id: 'pale_yellow',
    label: 'Pale Yellow Star',
    spectral: 'F-type main sequence',
    color: '#f8f7ff',
    tempK: [6000, 7500],
    massSolar: [1.04, 1.4],
    radiusSolar: [1.15, 1.7],
    luminosity: [1.5, 5],
    abundance: '~3% of main-sequence stars',
    blurb: 'Slightly hotter and whiter than the Sun, with a wide habitable band.',
  },
  {
    id: 'yellow',
    label: 'Yellow Star',
    spectral: 'G-type main sequence',
    color: '#fff4ea',
    tempK: [5300, 6000],
    massSolar: [0.8, 1.04],
    radiusSolar: [0.96, 1.15],
    luminosity: [0.6, 1.5],
    abundance: '~7.6% of main-sequence stars',
    blurb: 'A Sun-like star. Stable for roughly ten billion years.',
  },
  {
    id: 'orange_dwarf',
    label: 'Orange Dwarf',
    spectral: 'K-type main sequence',
    color: '#ffd2a1',
    tempK: [3900, 5300],
    massSolar: [0.45, 0.8],
    radiusSolar: [0.7, 0.96],
    luminosity: [0.08, 0.6],
    abundance: '~12.1% of main-sequence stars',
    blurb: 'Cooler and dimmer than the Sun, but burns steadily for tens of billions of years.',
  },
  {
    id: 'red_dwarf',
    label: 'Red Dwarf',
    spectral: 'M-type main sequence',
    color: '#ffcc6f',
    tempK: [2300, 3900],
    massSolar: [0.08, 0.45],
    radiusSolar: [0.1, 0.7],
    luminosity: [0.0001, 0.08],
    abundance: '~76% of main-sequence stars -- by far the most common',
    blurb: 'Dim, cool and staggeringly long-lived. Habitable worlds must huddle close.',
  },
  {
    id: 'red_giant',
    label: 'Red Giant',
    spectral: 'Evolved giant (K/M III)',
    color: '#ffb56c',
    tempK: [3000, 5000],
    massSolar: [0.3, 8],
    radiusSolar: [10, 200],
    luminosity: [100, 3000],
    abundance: 'A late-life stage, not a birth class',
    blurb: 'A dying star swollen after exhausting its core hydrogen. Swallows close orbits.',
  },
  {
    id: 'red_supergiant',
    label: 'Red Supergiant',
    spectral: 'Evolved supergiant (M I)',
    color: '#ff9d5c',
    tempK: [3000, 4500],
    massSolar: [8, 40],
    radiusSolar: [200, 1500],
    luminosity: [1000, 800000],
    abundance: 'Extremely rare; a massive star near death',
    blurb: 'Vast and unstable, destined for a supernova. Betelgeuse is one.',
  },
  {
    id: 'white_dwarf',
    label: 'White Dwarf',
    spectral: 'Stellar remnant',
    color: '#e8f1ff',
    tempK: [4000, 40000],
    massSolar: [0.17, 1.33],
    radiusSolar: [0.0086, 0.0144],
    luminosity: [0.0001, 100],
    abundance: 'The end state of most stars, including the Sun',
    blurb: 'An Earth-sized cinder of degenerate matter, cooling slowly for aeons. Cannot exceed 1.44 solar masses.',
  },
  {
    id: 'neutron_star',
    label: 'Neutron Star',
    spectral: 'Stellar remnant',
    color: '#cfe8ff',
    tempK: [100000, 1000000],
    massSolar: [1.1, 2.2],
    radiusSolar: [0.0000144, 0.0000187],
    luminosity: [0.00001, 10],
    abundance: 'Left behind by a core-collapse supernova',
    blurb: 'A city-sized object -- roughly 20km across -- with a sugar-cube mass of a billion tonnes.',
  },
  {
    id: 'pulsar',
    label: 'Pulsar',
    spectral: 'Rotating neutron star',
    color: '#bcdcff',
    tempK: [100000, 1000000],
    massSolar: [1.1, 2.2],
    radiusSolar: [0.0000144, 0.0000187],
    luminosity: [0.00001, 10],
    abundance: 'A neutron star whose beam sweeps across us',
    blurb: 'Spins up to hundreds of times a second, sweeping lighthouse beams of radiation.',
  },
  {
    id: 'black_hole',
    label: 'Black Hole',
    spectral: 'Stellar remnant',
    color: '#120c1f',
    tempK: [0, 0],
    massSolar: [3, 100],
    radiusSolar: [0.0000128, 0.00043],
    luminosity: [0, 0],
    abundance: 'The collapse of the most massive stars',
    blurb: 'No surface and no light -- only an event horizon. Anything that falls in stays in.',
  },
]

export function starClassMeta(id: string): StarClass {
  return STAR_CLASSES.find(s => s.id === id) ?? STAR_CLASSES[4] // default: Yellow Star
}

// A black hole has no photosphere, so temperature/luminosity readouts are meaningless.
export function isLightless(classId: string): boolean {
  return classId === 'black_hole'
}

// Event horizon radius in km: r_s = 2GM/c², which reduces to 2.95 km per solar mass.
// A 10-solar-mass black hole has a ~29.5km radius -- the size of a city.
export const SCHWARZSCHILD_KM_PER_SOLAR_MASS = 2.95

export function schwarzschildRadiusKm(massSolar: number): number {
  return SCHWARZSCHILD_KM_PER_SOLAR_MASS * massSolar
}

// ===========================================================================
// Habitability
//
// Two separate questions, and they have different answers:
//   1. WHERE around this star could liquid water sit?  -> habitableZone()
//   2. COULD this kind of star host life at all?        -> starHabitability()
// A blue giant has a habitable zone. It also burns out in a few million years,
// so nothing has time to evolve in it.
// ===========================================================================

// Kopparapu et al. (2013, ApJ 765:131 / 2014, ApJL 787:L29) boundary
// coefficients for a 1 Earth-mass planet.
//   S_eff = S_eff0 + a*T + b*T^2 + c*T^3 + d*T^4,  where T = Teff - 5780 K
//   distance_AU = sqrt( (L / L_sun) / S_eff )
interface HzCoefficients {
  s0: number
  a: number
  b: number
  c: number
  d: number
}

const HZ_COEFFICIENTS: Record<string, HzCoefficients> = {
  recentVenus:       { s0: 1.7763, a: 1.4335e-4, b: 3.3954e-9, c: -7.6364e-12, d: -1.1950e-15 },
  runawayGreenhouse: { s0: 1.0385, a: 1.2456e-4, b: 1.4612e-8, c: -7.6345e-12, d: -1.7511e-15 },
  moistGreenhouse:   { s0: 1.0146, a: 8.1884e-5, b: 1.9394e-9, c: -4.3618e-12, d: -6.8260e-16 },
  maxGreenhouse:     { s0: 0.3507, a: 5.9578e-5, b: 1.6707e-9, c: -3.0058e-12, d: -5.1925e-16 },
  earlyMars:         { s0: 0.3207, a: 5.4471e-5, b: 1.5275e-9, c: -2.1709e-12, d: -3.8282e-16 },
}

// The polynomial is only fitted between these temperatures. Outside it we are
// extrapolating, and the UI says so rather than quietly printing a number.
export const HZ_TEFF_MIN = 2600
export const HZ_TEFF_MAX = 7200

export interface HabitableZone {
  // Optimistic edges: Venus and Mars may have held surface water this far out.
  optimisticInner: number
  optimisticOuter: number
  // Conservative edges: the pair used as "the" habitable zone in the literature.
  conservativeInner: number
  conservativeOuter: number
  // True when the star's temperature falls outside the fit's valid range.
  extrapolated: boolean
}

function hzEdgeAu(coeff: HzCoefficients, luminositySolar: number, teffK: number): number {
  const t = teffK - 5780
  const sEff = coeff.s0 + coeff.a * t + coeff.b * t ** 2 + coeff.c * t ** 3 + coeff.d * t ** 4
  if (sEff <= 0) return 0
  return Math.sqrt(luminositySolar / sEff)
}

// Habitable zone edges in AU. Returns null when the star emits no useful light.
export function habitableZone(luminositySolar: number | null, teffK: number): HabitableZone | null {
  if (!luminositySolar || luminositySolar <= 0) return null
  return {
    optimisticInner:   hzEdgeAu(HZ_COEFFICIENTS.recentVenus, luminositySolar, teffK),
    conservativeInner: hzEdgeAu(HZ_COEFFICIENTS.runawayGreenhouse, luminositySolar, teffK),
    conservativeOuter: hzEdgeAu(HZ_COEFFICIENTS.maxGreenhouse, luminositySolar, teffK),
    optimisticOuter:   hzEdgeAu(HZ_COEFFICIENTS.earlyMars, luminositySolar, teffK),
    extrapolated: teffK < HZ_TEFF_MIN || teffK > HZ_TEFF_MAX,
  }
}

export type ZonePlacement = 'too-hot' | 'optimistic-inner' | 'habitable' | 'optimistic-outer' | 'too-cold'

// Where an orbit sits relative to the zone.
export function zonePlacement(au: number, hz: HabitableZone): ZonePlacement {
  if (au < hz.optimisticInner) return 'too-hot'
  if (au < hz.conservativeInner) return 'optimistic-inner'
  if (au <= hz.conservativeOuter) return 'habitable'
  if (au <= hz.optimisticOuter) return 'optimistic-outer'
  return 'too-cold'
}

export const ZONE_LABELS: Record<ZonePlacement, { label: string; color: string; note: string }> = {
  'too-hot': { label: 'Too hot', color: '#f87171', note: 'Inside the inner edge — surface water boils away.' },
  'optimistic-inner': { label: 'Optimistic (hot edge)', color: '#fbbf24', note: 'Habitable only under generous assumptions — a Venus that stayed wet.' },
  'habitable': { label: 'Habitable zone', color: '#4ade80', note: 'Liquid water is possible on the surface.' },
  'optimistic-outer': { label: 'Optimistic (cold edge)', color: '#60a5fa', note: 'Habitable only under generous assumptions — an early, warmer Mars.' },
  'too-cold': { label: 'Too cold', color: '#93c5fd', note: 'Beyond the outer edge — surface water freezes.' },
}

// Main-sequence mass-luminosity relation, Eker et al. (2018), from 509
// eclipsing binaries. Valid roughly 0.179-31 solar masses; outside that we
// fall back to the class's own luminosity range.
const EKER_SEGMENTS: { maxMass: number; alpha: number }[] = [
  { maxMass: 0.45, alpha: 2.028 },
  { maxMass: 0.72, alpha: 4.572 },
  { maxMass: 1.05, alpha: 5.743 },
  { maxMass: 2.40, alpha: 4.329 },
  { maxMass: 7.00, alpha: 3.967 },
  { maxMass: 31.0, alpha: 2.865 },
]

export function luminosityFromMass(massSolar: number): number | null {
  if (massSolar < 0.179 || massSolar > 31) return null
  const seg = EKER_SEGMENTS.find(s => massSolar <= s.maxMass) ?? EKER_SEGMENTS[EKER_SEGMENTS.length - 1]
  return massSolar ** seg.alpha
}

// Main-sequence lifetime. The Sun checks out: 1 solar mass -> 10 Gyr.
export function mainSequenceLifetimeGyr(massSolar: number): number {
  if (massSolar <= 0) return 0
  return 10 * massSolar ** -2.5
}

// Geometric mean is the honest midpoint for a range spanning orders of magnitude.
function rangeMidGeometric(range: [number, number]): number {
  if (range[0] <= 0) return range[1] / 2
  return Math.sqrt(range[0] * range[1])
}

// Luminosity to use for a star, in solar units.
//
// The mass-luminosity relation is a MAIN SEQUENCE relation. A red giant's
// output is set by its bloated radius, and a white dwarf's by residual cooling,
// so for those we take the class's own luminosity range instead of deriving.
export function starLuminositySolar(classId: string, massSolar: number | null): number | null {
  const cls = starClassMeta(classId)
  if (isLightless(classId)) return null
  if (MAIN_SEQUENCE_CLASSES.has(classId) && massSolar && massSolar > 0) {
    const derived = luminosityFromMass(massSolar)
    if (derived != null) return derived
  }
  const mid = rangeMidGeometric(cls.luminosity)
  return mid > 0 ? mid : null
}

// Representative temperature for a class, used by the HZ polynomial.
export function starTeffK(classId: string): number {
  const cls = starClassMeta(classId)
  return (cls.tempK[0] + cls.tempK[1]) / 2
}

const MAIN_SEQUENCE_CLASSES = new Set([
  'blue_giant', 'blue_white', 'white', 'pale_yellow', 'yellow', 'orange_dwarf', 'red_dwarf',
])

export type HabitabilityVerdict = 'plausible' | 'marginal' | 'ruled-out'

export interface StarHabitability {
  verdict: HabitabilityVerdict
  headline: string
  reason: string
}

// Whether this KIND of star could host life at all, independent of where its
// habitable zone happens to fall.
export const STAR_HABITABILITY: Record<string, StarHabitability> = {
  blue_giant: {
    verdict: 'ruled-out',
    headline: 'Burns out far too fast',
    reason: 'Lives only a few million years — orders of magnitude short of the ~1 billion life needed even to begin. Its ultraviolet output is sterilising besides.',
  },
  blue_white: {
    verdict: 'ruled-out',
    headline: 'Burns out too fast',
    reason: 'Tens to a few hundred million years on the main sequence. No time for life to get started.',
  },
  white: {
    verdict: 'marginal',
    headline: 'Short-lived and harshly ultraviolet',
    reason: 'Around 1-3 billion years of life — borderline for simple life, effectively never enough for complex life. Heavy UV flux also shrinks the genuinely safe band well inside the liquid-water zone.',
  },
  pale_yellow: {
    verdict: 'marginal',
    headline: 'Workable, with a UV problem',
    reason: 'Roughly 4-7 billion years is enough for simple life throughout, and for complex life at the cooler end. Ultraviolet output is a milder version of the white-star problem.',
  },
  yellow: {
    verdict: 'plausible',
    headline: 'The baseline case',
    reason: 'About 10 billion years of stable output and no special hazards. This is the kind of star Earth orbits.',
  },
  orange_dwarf: {
    verdict: 'plausible',
    headline: 'Arguably the best of all',
    reason: 'Tens of billions of years of stable burning, far less flaring than a red dwarf, and a comfortably placed zone. Often called the sweet spot for life.',
  },
  red_dwarf: {
    verdict: 'marginal',
    headline: 'Enormous time, serious hazards',
    reason: 'Lives effectively forever, but the zone sits so close that worlds there are likely tidally locked, flares and X-rays erode atmospheres, and the star was blindingly bright for its first billion years — long enough to boil a world dry before settling. Genuinely disputed among astronomers.',
  },
  red_giant: {
    verdict: 'marginal',
    headline: 'A moving window, not a home',
    reason: 'As the star swells its zone sweeps outward, so a given orbit is only temperate for a stretch — anywhere from ~200 million to a few billion years — before the zone moves past it.',
  },
  red_supergiant: {
    verdict: 'ruled-out',
    headline: 'Dying, violently',
    reason: 'This stage lasts only tens of thousands to a million years, with savage mass loss and a supernova at the end of it.',
  },
  white_dwarf: {
    verdict: 'marginal',
    headline: 'A narrow, closing window',
    reason: 'A real zone exists, but only a few thousandths of an AU out — perilously near the tidal-shredding limit, tidally locked for certain, and creeping inward as the ember cools. Any world there had to arrive after the star died.',
  },
  neutron_star: {
    verdict: 'ruled-out',
    headline: 'No warmth to offer',
    reason: 'No steady starlight, and any planet would have had to survive the supernova that made it.',
  },
  pulsar: {
    verdict: 'ruled-out',
    headline: 'Real planets, lethal skies',
    reason: 'Pulsar planets genuinely exist — the first exoplanets ever found orbited one — but the beamed radiation makes conventional life wildly implausible.',
  },
  black_hole: {
    verdict: 'ruled-out',
    headline: 'No light, no zone',
    reason: 'Emits nothing usable. Exotic schemes exist on paper for harvesting the background radiation near a giant spinning hole, but their own authors treat them as thought experiments.',
  },
}

export function starHabitability(classId: string): StarHabitability {
  return STAR_HABITABILITY[classId] ?? STAR_HABITABILITY.yellow
}

// Tidal locking scales as a^6 / M^2, so it falls off ferociously with distance.
// Worlds in the zone of a star below roughly half a solar mass lock within a
// few billion years; around a Sun-like star they essentially never do.
export function likelyTidallyLocked(au: number, starMassSolar: number | null): boolean {
  if (!starMassSolar || starMassSolar <= 0 || au <= 0) return false
  // Calibrated so Proxima b (0.0485 AU, 0.12 M) locks and Earth does not.
  return (au ** 6) / (starMassSolar ** 2) < 1e-4
}

// ===========================================================================
// Planetary traits & habitability scoring
//
// Two scores, because they answer different questions and routinely disagree:
//
//   habitability -- could an unprotected being survive on the surface?
//   settlement   -- could a technological species build a colony here?
//
// An airless ice moon scores ~0 on the first and very well on the second:
// vacuum is cheap to seal against and the water is right there. A high-gravity
// world scores badly on BOTH, because gravity is the one factor no amount of
// technology can engineer around -- you cannot build a wall against it.
// ===========================================================================

export const ATMOSPHERE_TYPES: { id: AtmosphereType; label: string; note: string }[] = [
  { id: 'none', label: 'None (vacuum)', note: 'No atmosphere at all. Cheap to seal against — a hard vacuum is routine engineering.' },
  { id: 'trace', label: 'Trace', note: 'Barely there. Too thin to breathe or to shield against radiation.' },
  { id: 'thin', label: 'Thin', note: 'Real but insufficient — a pressure suit is needed outdoors.' },
  { id: 'breathable', label: 'Breathable', note: 'Oxygen-bearing at survivable pressure. Rare and precious.' },
  { id: 'dense', label: 'Dense', note: 'Thick. Excellent radiation shielding, but crushing at the extreme.' },
  { id: 'toxic', label: 'Toxic', note: 'Poisonous to breathe, whatever the pressure.' },
  { id: 'corrosive', label: 'Corrosive', note: 'Actively eats equipment. The hardest kind to build in.' },
]

export const HYDROSPHERE_TYPES: { id: HydrosphereType; label: string; note: string }[] = [
  { id: 'none', label: 'Bone dry', note: 'No water in any form.' },
  { id: 'ice', label: 'Ice only', note: 'Frozen water. The single most valuable thing a colony can find.' },
  { id: 'trace', label: 'Trace / subsurface', note: 'Damp, or liquid water hidden below the surface.' },
  { id: 'seas', label: 'Seas and land', note: 'Open water with exposed continents — the best case for life.' },
  { id: 'ocean_world', label: 'Ocean world', note: 'Global ocean, no exposed land. Whether that helps or hurts climate is genuinely disputed.' },
]

export const TECTONICS_TYPES: { id: TectonicsType; label: string; note: string }[] = [
  { id: 'dead', label: 'Dead', note: 'Geologically inert. No thermostat, no fresh volatiles.' },
  { id: 'stagnant', label: 'Stagnant lid', note: 'Volcanism without plate recycling — a weaker thermostat, like Mars or Venus.' },
  { id: 'active', label: 'Active plates', note: 'Full carbonate-silicate cycle: the thermostat that kept Earth temperate for four billion years.' },
]

export const MAGNETOSPHERE_TYPES: { id: MagnetosphereType; label: string; note: string }[] = [
  { id: 'none', label: 'None', note: 'No intrinsic field. Not the disaster it is often made out to be — Venus has none and 90 bar of air.' },
  { id: 'weak', label: 'Weak / induced', note: 'A modest or atmosphere-induced field.' },
  { id: 'strong', label: 'Strong', note: 'An Earth-like dynamo. Helps against flares; its effect on atmospheric retention is contested.' },
]

export const BIOSPHERE_TYPES: { id: BiosphereType; label: string; note: string }[] = [
  { id: 'none', label: 'Sterile', note: 'Nothing lives here.' },
  { id: 'microbial', label: 'Microbial', note: 'Life, but nothing you can talk to.' },
  { id: 'complex', label: 'Complex', note: 'A full biosphere.' },
  { id: 'exotic', label: 'Exotic', note: 'Life running on chemistry that has no business working.' },
]

export const RESOURCES: { id: ResourceId; label: string; icon: string; note: string }[] = [
  { id: 'water_ice', label: 'Water ice', icon: '🧊', note: 'The master resource: drinking water, breathable oxygen, and fuel.' },
  { id: 'liquid_water', label: 'Liquid water', icon: '💧', note: 'Accessible without melting anything first.' },
  { id: 'metals', label: 'Metals', icon: '⛏️', note: 'Construction and manufacturing.' },
  { id: 'nitrogen', label: 'Nitrogen', icon: '🫧', note: 'Buffer gas. A sealed habitat cannot run on pure oxygen without becoming a bomb, so this is a real constraint.' },
  { id: 'carbon', label: 'Carbon', icon: '⚫', note: 'Plastics, fuel, and food.' },
  { id: 'organics', label: 'Organics', icon: '🧬', note: 'Complex carbon chemistry ready to use.' },
  { id: 'fissiles', label: 'Fissiles', icon: '☢️', note: 'Power where sunlight is too weak.' },
  { id: 'geothermal', label: 'Geothermal / tidal heat', icon: '♨️', note: 'Energy from the world itself. What keeps Europa\'s ocean liquid.' },
]

export interface BodyTraits {
  atmosphere: AtmosphereType
  pressure_atm: number
  oxygen_pct: number
  hydrosphere: HydrosphereType
  tectonics: TectonicsType
  magnetosphere: MagnetosphereType
  axial_tilt_deg: number
  eccentricity: number
  resources: ResourceId[]
}

// Plausible defaults per class, so a freshly-placed world scores sensibly with
// nothing filled in. Anything the GM sets overrides these.
export const CLASS_TRAIT_DEFAULTS: Record<string, Partial<BodyTraits>> = {
  // "Terrestrial" in the class list sits alongside Barren Rock and Desert World,
  // so a GM picking it usually means the Earth-like one. Defaults reflect that
  // intent rather than the statistically likelier dead rock.
  terrestrial: { atmosphere: 'breathable', pressure_atm: 1, oxygen_pct: 20, hydrosphere: 'seas', tectonics: 'active', magnetosphere: 'weak', resources: ['liquid_water', 'water_ice', 'metals', 'nitrogen', 'carbon'] },
  ocean:       { atmosphere: 'breathable', pressure_atm: 1.1, oxygen_pct: 20, hydrosphere: 'ocean_world', tectonics: 'active', magnetosphere: 'weak', resources: ['liquid_water', 'water_ice'] },
  desert:      { atmosphere: 'thin', pressure_atm: 0.6, oxygen_pct: 2, hydrosphere: 'trace', tectonics: 'stagnant', magnetosphere: 'none', resources: ['metals'] },
  ice:         { atmosphere: 'trace', pressure_atm: 0.05, oxygen_pct: 0, hydrosphere: 'ice', tectonics: 'dead', magnetosphere: 'none', resources: ['water_ice'] },
  volcanic:    { atmosphere: 'toxic', pressure_atm: 2.5, oxygen_pct: 0, hydrosphere: 'none', tectonics: 'active', magnetosphere: 'weak', resources: ['metals', 'geothermal', 'fissiles'] },
  toxic:       { atmosphere: 'corrosive', pressure_atm: 8, oxygen_pct: 0, hydrosphere: 'none', tectonics: 'stagnant', magnetosphere: 'none', resources: ['carbon'] },
  barren:      { atmosphere: 'none', pressure_atm: 0, oxygen_pct: 0, hydrosphere: 'none', tectonics: 'dead', magnetosphere: 'none', resources: ['metals'] },
  gas_giant:   { atmosphere: 'dense', pressure_atm: 1000, oxygen_pct: 0, hydrosphere: 'none', tectonics: 'dead', magnetosphere: 'strong', resources: ['nitrogen', 'carbon'] },
  ice_giant:   { atmosphere: 'dense', pressure_atm: 800, oxygen_pct: 0, hydrosphere: 'ice', tectonics: 'dead', magnetosphere: 'strong', resources: ['water_ice', 'nitrogen'] },
  dwarf:       { atmosphere: 'none', pressure_atm: 0, oxygen_pct: 0, hydrosphere: 'ice', tectonics: 'dead', magnetosphere: 'none', resources: ['water_ice', 'metals'] },
}

const TRAIT_FALLBACK: BodyTraits = {
  atmosphere: 'none', pressure_atm: 0, oxygen_pct: 0, hydrosphere: 'none',
  tectonics: 'dead', magnetosphere: 'none', axial_tilt_deg: 20, eccentricity: 0.02, resources: [],
}

// A body's effective traits: what the GM set, else the class default, else nothing.
export function resolveTraits(body: SystemBody): BodyTraits {
  const d = CLASS_TRAIT_DEFAULTS[body.body_class] ?? {}
  return {
    atmosphere: body.atmosphere ?? d.atmosphere ?? TRAIT_FALLBACK.atmosphere,
    pressure_atm: body.pressure_atm ?? d.pressure_atm ?? TRAIT_FALLBACK.pressure_atm,
    oxygen_pct: body.oxygen_pct ?? d.oxygen_pct ?? TRAIT_FALLBACK.oxygen_pct,
    hydrosphere: body.hydrosphere ?? d.hydrosphere ?? TRAIT_FALLBACK.hydrosphere,
    tectonics: body.tectonics ?? d.tectonics ?? TRAIT_FALLBACK.tectonics,
    magnetosphere: body.magnetosphere ?? d.magnetosphere ?? TRAIT_FALLBACK.magnetosphere,
    axial_tilt_deg: body.axial_tilt_deg ?? d.axial_tilt_deg ?? TRAIT_FALLBACK.axial_tilt_deg,
    eccentricity: body.eccentricity ?? d.eccentricity ?? TRAIT_FALLBACK.eccentricity,
    resources: (body.resources?.length ? body.resources : d.resources) ?? TRAIT_FALLBACK.resources,
  }
}

// ---------------------------------------------------------------------------
// Derived physical quantities
// ---------------------------------------------------------------------------

export const EARTH_RADIUS_KM = 6371
// Above roughly this radius a world is a sub-Neptune rather than a rock: the
// Fulton gap, an observed scarcity of planets between ~1.5 and 2 Earth radii.
export const ROCKY_RADIUS_LIMIT_EARTH = 1.6

// Surface gravity in Earth gravities: g = M / R², both in Earth units.
export function surfaceGravityG(massSolar: number | null, radiusKm: number | null): number | null {
  if (!massSolar || !radiusKm || massSolar <= 0 || radiusKm <= 0) return null
  const massEarth = solarToEarthMasses(massSolar)
  const radiusEarth = radiusKm / EARTH_RADIUS_KM
  return massEarth / (radiusEarth * radiusEarth)
}

// Oxygen partial pressure in atmospheres -- the figure that decides whether air
// is breathable. A thin atmosphere of pure oxygen still suffocates you.
export function oxygenPartialPressureAtm(traits: BodyTraits): number {
  return traits.pressure_atm * (traits.oxygen_pct / 100)
}

// Pressure below which exposed body fluids boil at body temperature.
export const ARMSTRONG_LIMIT_ATM = 0.0618
// Human-survivable oxygen partial pressure band.
export const PO2_MIN_ATM = 0.16
export const PO2_MAX_ATM = 0.5

// Equilibrium temperature in Celsius, ignoring greenhouse effects.
export function equilibriumTempC(luminositySolar: number | null, au: number, albedo = 0.3): number | null {
  if (!luminositySolar || luminositySolar <= 0 || au <= 0) return null
  // 278.5 K is the equilibrium temperature at 1 AU from a 1 L-sun star at zero albedo.
  const kelvin = 278.5 * ((1 - albedo) ** 0.25) * (luminositySolar ** 0.25) / Math.sqrt(au)
  return kelvin - 273.15
}

// ---------------------------------------------------------------------------
// Habitability score -- unprotected survival on the surface
// ---------------------------------------------------------------------------

export interface ScoreFactor {
  label: string
  points: number
  max: number
  note: string
}

export interface HabitabilityScore {
  score: number // 0-100
  band: 'garden' | 'habitable' | 'marginal' | 'hostile' | 'lethal'
  factors: ScoreFactor[]
  overridden: boolean
}

export const HABITABILITY_BANDS: Record<HabitabilityScore['band'], { label: string; color: string }> = {
  garden:    { label: 'Garden world', color: '#4ade80' },
  habitable: { label: 'Habitable', color: '#a3e635' },
  marginal:  { label: 'Marginal', color: '#facc15' },
  hostile:   { label: 'Hostile', color: '#fb923c' },
  lethal:    { label: 'Lethal', color: '#f87171' },
}

function bandFor(score: number): HabitabilityScore['band'] {
  if (score >= 80) return 'garden'
  if (score >= 60) return 'habitable'
  if (score >= 35) return 'marginal'
  if (score >= 15) return 'hostile'
  return 'lethal'
}

export interface HabitabilityContext {
  zone: ZonePlacement | null
  gravityG: number | null
  tidallyLocked: boolean
}

// Weights reflect what actually kills you fastest, and what regulates a climate
// over geological time. Deliberately NOT weighted heavily: magnetosphere (its
// effect on retention is contested) and axial tilt (the large-moon
// stabilisation claim was substantially revised).
export function habitabilityScore(body: SystemBody, ctx: HabitabilityContext): HabitabilityScore {
  const t = resolveTraits(body)
  const factors: ScoreFactor[] = []

  // --- Breathable air (35) -- the fastest-acting factor of all.
  const po2 = oxygenPartialPressureAtm(t)
  let air = 0
  let airNote: string
  if (t.pressure_atm < ARMSTRONG_LIMIT_ATM) {
    airNote = 'Below the Armstrong limit — exposed body fluids boil. Unsurvivable unsuited.'
  } else if (t.atmosphere === 'corrosive') {
    air = 1
    airNote = 'Corrosive. Lethal to breathe and hostile to equipment.'
  } else if (t.atmosphere === 'toxic') {
    air = 2
    airNote = 'Poisonous whatever the pressure.'
  } else if (po2 < PO2_MIN_ATM) {
    air = po2 <= 0 ? 3 : 10
    airNote = `Oxygen partial pressure ${po2.toFixed(3)} atm — below the ${PO2_MIN_ATM} atm needed to stay conscious.`
  } else if (po2 > PO2_MAX_ATM) {
    air = 14
    airNote = `Oxygen partial pressure ${po2.toFixed(2)} atm — high enough for oxygen toxicity and severe fire risk.`
  } else if (t.pressure_atm > 4) {
    air = 20
    airNote = 'Breathable mix, but the pressure itself brings narcosis.'
  } else {
    air = 35
    airNote = `Breathable: ${po2.toFixed(2)} atm oxygen at ${t.pressure_atm} atm total.`
  }
  factors.push({ label: 'Breathable air', points: air, max: 35, note: airNote })

  // --- Temperature / zone (20)
  let temp = 0
  let tempNote = 'No star to warm it.'
  if (ctx.zone) {
    const map: Record<ZonePlacement, [number, string]> = {
      'habitable': [20, 'Squarely in the habitable zone.'],
      'optimistic-inner': [12, 'Just inside the hot edge — habitable only on generous assumptions.'],
      'optimistic-outer': [12, 'Just outside the cold edge — habitable only on generous assumptions.'],
      'too-hot': [0, 'Too close to its star for surface water.'],
      'too-cold': [2, 'Too far from its star; surface water is frozen.'],
    }
    const [pts, note] = map[ctx.zone]
    temp = pts
    tempNote = note
  }
  factors.push({ label: 'Temperature', points: temp, max: 20, note: tempNote })

  // --- Water (15). Presence of exposed land is the discontinuity, not the amount.
  const waterPts: Record<HydrosphereType, [number, string]> = {
    'seas': [15, 'Open water with exposed land — the ideal arrangement.'],
    'ocean_world': [10, 'A global ocean with no land. Whether that helps or hurts long-term climate is genuinely disputed.'],
    'trace': [7, 'Some water, but little of it accessible at the surface.'],
    'ice': [4, 'Water, but frozen.'],
    'none': [0, 'No water in any form.'],
  }
  const [wp, wn] = waterPts[t.hydrosphere]
  factors.push({ label: 'Water', points: wp, max: 15, note: wn })

  // --- Gravity (12)
  let grav = 0
  let gravNote = 'Unknown mass or radius.'
  if (ctx.gravityG != null) {
    const g = ctx.gravityG
    if (g >= 0.7 && g <= 1.3) { grav = 12; gravNote = `${g.toFixed(2)} g — comfortable indefinitely.` }
    else if (g >= 0.5 && g < 0.7) { grav = 8; gravNote = `${g.toFixed(2)} g — below the point where exercise alone stops muscle and bone loss.` }
    else if (g > 1.3 && g <= 1.6) { grav = 7; gravNote = `${g.toFixed(2)} g — tiring, and hard on the heart over years.` }
    else if (g >= 0.3 && g < 0.5) { grav = 4; gravNote = `${g.toFixed(2)} g — long residence means permanent physical decline.` }
    else if (g > 1.6 && g <= 2.5) { grav = 2; gravNote = `${g.toFixed(2)} g — punishing. Sustained habitation is doubtful.` }
    else { grav = 0; gravNote = `${g.toFixed(2)} g — outside anything a body tolerates for long.` }
  }
  factors.push({ label: 'Gravity', points: grav, max: 12, note: gravNote })

  // --- Long-term climate stability (12): the thermostat plus orbital behaviour.
  const tectPts: Record<TectonicsType, [number, string]> = {
    'active': [8, 'Active plates drive the carbonate-silicate cycle — the thermostat that held Earth temperate for four billion years.'],
    'stagnant': [4, 'Volcanism without plate recycling gives a weaker thermostat.'],
    'dead': [0, 'Geologically dead: no thermostat, and no fresh volatiles.'],
  }
  const [tp, tn] = tectPts[t.tectonics]
  let ecc = 4
  let eccNote = `Orbit is near-circular (e=${t.eccentricity}).`
  if (t.eccentricity > 0.6) { ecc = 0; eccNote = `e=${t.eccentricity} — violent swings in stellar heating each orbit.` }
  else if (t.eccentricity > 0.3) { ecc = 2; eccNote = `e=${t.eccentricity} — noticeable seasonal extremes from the orbit itself.` }
  factors.push({ label: 'Climate stability', points: tp + ecc, max: 12, note: `${tn} ${eccNote}` })

  // --- Radiation shelter (6). Atmospheric mass matters far more than a magnetic
  // field here: Earth's air is ~1000 g/cm² of shielding, which no dynamo matches.
  let rad = 0
  let radNote: string
  if (t.pressure_atm >= 0.5) { rad = 6; radNote = 'A thick atmosphere is the real radiation shield — worth far more than any magnetic field.' }
  else if (t.pressure_atm >= 0.1) { rad = 3; radNote = 'Thin air gives only partial protection from cosmic rays and flares.' }
  else { rad = 0; radNote = 'Effectively no atmospheric shielding. Surface radiation is unmitigated.' }
  if (t.magnetosphere === 'strong') { rad = Math.min(6, rad + 1); radNote += ' A strong field helps against flares.' }
  factors.push({ label: 'Radiation shelter', points: rad, max: 6, note: radNote })

  const raw = factors.reduce((s, f) => s + f.points, 0)

  // Some conditions kill you outright, and no amount of scoring well elsewhere
  // changes that. A world in the perfect orbit with no air is still vacuum, and
  // breathable air on a three-gravity world still crushes you. These are ceilings,
  // not deductions -- without them a lethal world can coast to a high score on
  // the factors it happens to pass.
  const caps: { cap: number; why: string }[] = []
  if (t.pressure_atm < ARMSTRONG_LIMIT_ATM) {
    caps.push({ cap: 8, why: 'Effectively vacuum — unprotected exposure kills in under two minutes.' })
  }
  if (t.atmosphere === 'toxic' || t.atmosphere === 'corrosive') {
    caps.push({ cap: 12, why: 'The air itself is lethal to breathe.' })
  } else if (po2 < PO2_MIN_ATM || po2 > PO2_MAX_ATM) {
    caps.push({ cap: 25, why: 'Air is unbreathable — survivable only behind a mask or a seal.' })
  }
  if (ctx.gravityG != null && (ctx.gravityG < GRAVITY_MIN_G || ctx.gravityG > GRAVITY_MAX_G)) {
    caps.push({ cap: 30, why: `${ctx.gravityG.toFixed(2)} g is outside what a body endures for long, whatever the air is like.` })
  }

  const ceiling = caps.length ? Math.min(...caps.map(c => c.cap)) : 100
  if (caps.length) {
    const binding = caps.reduce((a, b) => (a.cap <= b.cap ? a : b))
    factors.push({ label: 'Hard limit', points: 0, max: 0, note: binding.why })
  }

  const score = body.habitability_override != null
    ? Math.max(0, Math.min(100, body.habitability_override))
    : Math.max(0, Math.min(ceiling, Math.round(raw)))

  return { score, band: bandFor(score), factors, overridden: body.habitability_override != null }
}

// ---------------------------------------------------------------------------
// Settlement rating -- can a technological species build here?
//
// Gravity is the gate. Everything else is a cost: pressure, temperature, air
// and radiation are all things a wall can be built against, and the resources
// on hand decide whether the colony can ever feed itself.
// ---------------------------------------------------------------------------

export type SettlementTier = 'open' | 'easy' | 'engineered' | 'sealed' | 'extreme' | 'orbital-only'

export interface SettlementRating {
  tier: SettlementTier
  label: string
  color: string
  summary: string
  selfSufficiency: number // 0-100, how far local resources go
  blockers: string[]
  costs: string[]
}

const TIER_META: Record<SettlementTier, { label: string; color: string }> = {
  'open':         { label: 'Open settlement', color: '#4ade80' },
  'easy':         { label: 'Light habitats', color: '#a3e635' },
  'engineered':   { label: 'Engineered colony', color: '#facc15' },
  'sealed':       { label: 'Sealed habitat', color: '#fb923c' },
  'extreme':      { label: 'Extreme outpost', color: '#f87171' },
  'orbital-only': { label: 'Orbit only', color: '#a78bfa' },
}

// Gravity bounds beyond which a surface colony is not viable however much
// technology you throw at it. You cannot build a wall against gravity.
export const GRAVITY_MIN_G = 0.3
export const GRAVITY_MAX_G = 1.8

export function settlementRating(
  body: SystemBody,
  ctx: HabitabilityContext,
  habitability: number
): SettlementRating {
  const t = resolveTraits(body)
  const blockers: string[] = []
  const costs: string[] = []

  // --- Self-sufficiency from local resources.
  const has = (r: ResourceId) => t.resources.includes(r)
  let selfSufficiency = 0
  if (has('water_ice') || has('liquid_water') || t.hydrosphere !== 'none') selfSufficiency += 40
  else blockers.push('No water of any kind — everything must be shipped in.')
  if (has('metals')) selfSufficiency += 20
  else costs.push('No local metals; construction material must be imported.')
  if (has('nitrogen') || t.atmosphere === 'breathable') selfSufficiency += 20
  else costs.push('No buffer gas. A sealed habitat cannot run on pure oxygen without becoming a firetrap, so nitrogen or argon must come from somewhere.')
  if (has('carbon') || has('organics')) selfSufficiency += 10
  else costs.push('No local carbon for plastics, fuel or food.')
  if (has('geothermal') || has('fissiles')) selfSufficiency += 10
  selfSufficiency = Math.min(100, selfSufficiency)

  // --- The hard gate.
  const g = ctx.gravityG
  if (g != null && (g < GRAVITY_MIN_G || g > GRAVITY_MAX_G)) {
    blockers.push(
      g < GRAVITY_MIN_G
        ? `${g.toFixed(2)} g is too little to live in permanently — bone and muscle waste away and exercise alone does not stop it. Rotating habitats can fake gravity; a planet's surface cannot.`
        : `${g.toFixed(2)} g is crushing. There is no engineering fix for gravity: it pulls on every cell, continuously, and no wall stops it.`
    )
    return {
      tier: 'orbital-only',
      ...TIER_META['orbital-only'],
      summary: g < GRAVITY_MIN_G
        ? 'Fine for mining camps and rotating tours of duty, but nobody raises a family here. Permanent population belongs in a spun station overhead.'
        : 'No permanent surface population. Work it from orbit and send machines down.',
      selfSufficiency, blockers, costs,
    }
  }

  // --- Engineering costs, none of which are dealbreakers on their own.
  if (t.atmosphere === 'corrosive') costs.push('Corrosive air attacks structures and seals — a materials problem before an engineering one.')
  if (t.pressure_atm > 20) costs.push(`${t.pressure_atm} atm needs submarine-grade pressure hulls.`)
  if (t.pressure_atm > 0 && t.pressure_atm < ARMSTRONG_LIMIT_ATM) costs.push('Effectively vacuum outdoors — pressure suits at all times.')
  if (t.atmosphere === 'none') costs.push('No atmosphere: sealing is straightforward, but there is nothing to shield against radiation, so build under regolith.')
  if (t.pressure_atm < 0.1) costs.push('Little atmospheric shielding — bury the habitat or accept the dose.')
  if (ctx.zone === 'too-hot') costs.push('Fierce heat load; cooling runs continuously.')
  if (ctx.zone === 'too-cold') costs.push('Deep cold; heating is a permanent power draw.')

  // --- Tier: how much has to be built before anyone can live there.
  let tier: SettlementTier
  let summary: string
  if (habitability >= 70) {
    tier = 'open'
    summary = 'Walk out and breathe. Settlement needs shelter, not life support.'
  } else if (habitability >= 45) {
    tier = 'easy'
    summary = 'Nearly liveable. Habitats are light, and the outdoors is survivable with a mask or warm clothes.'
  } else if (t.atmosphere === 'corrosive' || t.pressure_atm > 20 || (ctx.zone === 'too-hot' && t.pressure_atm > 5)) {
    tier = 'extreme'
    summary = 'Heat, pressure and corrosion together push this to the edge of what can be built. Consider the upper atmosphere instead of the surface.'
  } else if (selfSufficiency >= 40) {
    tier = 'sealed'
    summary = 'Lethal outside, but sealed habitats work and there is enough here to keep them running.'
  } else {
    tier = 'engineered'
    summary = 'Buildable, but the colony lives on supply ships until something worth mining turns up.'
  }

  // Resource-rich vacuum worlds are genuinely good colonies. The Moon and Ceres
  // score zero for habitability and are still excellent places to settle.
  if (tier === 'sealed' && selfSufficiency >= 70) {
    summary = 'Nothing breathes out there, but vacuum is cheap to seal against and the resources are right here. A strong colony site.'
  }

  return { tier, ...TIER_META[tier], summary, selfSufficiency, blockers, costs }
}

// ===========================================================================
// Planet & station classes (game flavour rather than formal taxonomy)
// ===========================================================================

export interface BodyClass {
  id: string
  label: string
  color: string
  icon: string
  blurb: string
}

export const PLANET_CLASSES: BodyClass[] = [
  { id: 'terrestrial', label: 'Terrestrial', color: '#8fae6b', icon: '🪨', blurb: 'Rocky, with a solid surface you can stand on.' },
  { id: 'ocean', label: 'Ocean World', color: '#3b82f6', icon: '🌊', blurb: 'Surface almost entirely liquid.' },
  { id: 'desert', label: 'Desert World', color: '#d4a15e', icon: '🏜️', blurb: 'Arid and hot, with little surface water.' },
  { id: 'ice', label: 'Ice World', color: '#a5d8e6', icon: '🧊', blurb: 'Frozen over, often far from its star.' },
  { id: 'volcanic', label: 'Volcanic World', color: '#dc2626', icon: '🌋', blurb: 'Tectonically violent, wreathed in ash.' },
  { id: 'toxic', label: 'Toxic World', color: '#84cc16', icon: '☣️', blurb: 'A corrosive or poisonous atmosphere.' },
  { id: 'barren', label: 'Barren Rock', color: '#78716c', icon: '⚪', blurb: 'Airless and cratered.' },
  { id: 'gas_giant', label: 'Gas Giant', color: '#e0a458', icon: '🪐', blurb: 'A vast ball of hydrogen and helium. Often keeps many moons.' },
  { id: 'ice_giant', label: 'Ice Giant', color: '#60a5fa', icon: '🔵', blurb: 'Cold and massive, rich in water, ammonia and methane.' },
  { id: 'dwarf', label: 'Dwarf Planet', color: '#a8a29e', icon: '·', blurb: 'Too small to have cleared its orbit.' },
]

export const STATION_CLASSES: BodyClass[] = [
  { id: 'orbital', label: 'Orbital Station', color: '#94a3b8', icon: '🛰️', blurb: 'A permanent habitat in orbit.' },
  { id: 'trade_hub', label: 'Trade Hub', color: '#facc15', icon: '💱', blurb: 'A commercial waypoint. Buy, sell, refuel.' },
  { id: 'shipyard', label: 'Shipyard', color: '#38bdf8', icon: '🔧', blurb: 'Builds and repairs ships.' },
  { id: 'military', label: 'Military Outpost', color: '#ef4444', icon: '🎖️', blurb: 'A fortified garrison.' },
  { id: 'research', label: 'Research Station', color: '#a78bfa', icon: '🔬', blurb: 'A scientific installation, often somewhere inconvenient.' },
  { id: 'mining', label: 'Mining Platform', color: '#b45309', icon: '⛏️', blurb: 'Extracts ore, gas or ice.' },
  { id: 'derelict', label: 'Derelict', color: '#57534e', icon: '💀', blurb: 'Abandoned. Something happened here.' },
]

export const BELT_CLASSES: BodyClass[] = [
  { id: 'asteroid_belt', label: 'Asteroid Belt', color: '#a8a29e', icon: '☄️', blurb: 'A ring of rubble and metal.' },
  { id: 'ice_belt', label: 'Ice Belt', color: '#bae6fd', icon: '❄️', blurb: 'Cometary debris in a distant ring.' },
  { id: 'debris', label: 'Debris Field', color: '#71717a', icon: '🛠️', blurb: 'The wreckage of something that used to be here.' },
]

export function classesForKind(kind: BodyKind): BodyClass[] {
  if (kind === 'station') return STATION_CLASSES
  if (kind === 'belt') return BELT_CLASSES
  if (kind === 'star') {
    return STAR_CLASSES.map(s => ({ id: s.id, label: s.label, color: s.color, icon: '★', blurb: s.blurb }))
  }
  return PLANET_CLASSES // planet + moon share a taxonomy
}

export function bodyClassMeta(kind: BodyKind, classId: string): BodyClass {
  const list = classesForKind(kind)
  return list.find(c => c.id === classId) ?? list[0]
}

export const BODY_KINDS: { kind: BodyKind; label: string; icon: string }[] = [
  { kind: 'star', label: 'Star', icon: '★' },
  { kind: 'planet', label: 'Planet', icon: '🪐' },
  { kind: 'moon', label: 'Moon', icon: '🌙' },
  { kind: 'station', label: 'Station', icon: '🛰️' },
  { kind: 'belt', label: 'Belt / Field', icon: '☄️' },
]

// What a new child of this parent most likely is. The hierarchy is authoritative,
// so this is only a sensible default the GM can override.
export function defaultChildKind(parent: SystemBody | null): BodyKind {
  if (!parent) return 'star'
  if (parent.kind === 'star') return 'planet'
  return 'moon'
}

// ===========================================================================
// Unit conversions
// ===========================================================================

// 1 solar mass in Earth masses.
export const EARTH_MASSES_PER_SOLAR = 332946
export const KM_PER_AU = 149597870.7
export const SOLAR_RADIUS_KM = 695700

export function earthMassesToSolar(earth: number): number {
  return earth / EARTH_MASSES_PER_SOLAR
}

export function solarToEarthMasses(solar: number): number {
  return solar * EARTH_MASSES_PER_SOLAR
}

// ===========================================================================
// Distance & jump time
// ===========================================================================

// Straight-line distance between two systems, in light-years.
export function distanceLy(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Total time for a jump: the drive's fixed spin-up plus cruise time over the distance.
export function jumpTimeHours(ly: number, drive: JumpDrive): number {
  const speed = drive.speed_ly_per_hour
  if (!speed || speed <= 0) return drive.charge_hours
  return drive.charge_hours + ly / speed
}

// "3d 4h" / "6h 30m" -- compact enough for a map overlay.
export function formatDuration(hours: number): string {
  if (!isFinite(hours) || hours < 0) return '--'
  const totalMinutes = Math.round(hours * 60)
  const d = Math.floor(totalMinutes / (60 * 24))
  const h = Math.floor((totalMinutes % (60 * 24)) / 60)
  const m = totalMinutes % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  // Only bother with minutes on short hops.
  if (m && !d) parts.push(`${m}m`)
  return parts.length ? parts.join(' ') : '0m'
}

export function formatLy(ly: number): string {
  if (ly >= 100) return `${ly.toFixed(0)} ly`
  if (ly >= 10) return `${ly.toFixed(1)} ly`
  return `${ly.toFixed(2)} ly`
}

// Systems sorted by proximity, for jump planning.
export function nearestSystems(
  origin: StarSystem,
  all: StarSystem[],
  limit = 5
): { system: StarSystem; ly: number }[] {
  return all
    .filter(s => s.id !== origin.id)
    .map(s => ({ system: s, ly: distanceLy(origin, s) }))
    .sort((a, b) => a.ly - b.ly)
    .slice(0, limit)
}

// ===========================================================================
// Orbital mechanics
//
// Kepler's third law in solar units: P(years)^2 = a(AU)^3 / M(solar masses).
// Earth checks out: sqrt(1^3 / 1) = 1 year.
// ===========================================================================

export function orbitalPeriodYears(semiMajorAxisAu: number, parentMassSolar: number): number {
  if (semiMajorAxisAu <= 0 || parentMassSolar <= 0) return 0
  return Math.sqrt((semiMajorAxisAu ** 3) / parentMassSolar)
}

export const DAYS_PER_YEAR = 365.25

export function orbitalPeriodDays(semiMajorAxisAu: number, parentMassSolar: number): number {
  return orbitalPeriodYears(semiMajorAxisAu, parentMassSolar) * DAYS_PER_YEAR
}

// The period actually used for a body: an explicit override, else derived from Kepler.
export function resolvePeriodDays(body: SystemBody, parentMassSolar: number | null): number | null {
  if (body.orbital_period_days != null) return body.orbital_period_days
  if (!parentMassSolar || parentMassSolar <= 0 || body.orbital_radius_au <= 0) return null
  return orbitalPeriodDays(body.orbital_radius_au, parentMassSolar)
}

export function formatPeriod(days: number | null): string {
  if (days == null || !isFinite(days) || days <= 0) return '--'
  if (days < 2) return `${(days * 24).toFixed(1)} hours`
  if (days < 700) return `${days.toFixed(1)} days`
  return `${(days / DAYS_PER_YEAR).toFixed(2)} years`
}

// Where a body sits at a given time, in degrees, wrapping at 360.
export function angleAtTime(body: SystemBody, periodDays: number | null, elapsedDays: number): number {
  if (!periodDays || periodDays <= 0) return body.angle_deg
  return (body.angle_deg + (elapsedDays / periodDays) * 360) % 360
}

// ===========================================================================
// Hierarchy helpers
// ===========================================================================

// Direct children of a body (or of the system barycentre when parentId is null),
// ordered by how far out they orbit.
export function childrenOf(bodies: SystemBody[], parentId: string | null): SystemBody[] {
  return bodies
    .filter(b => b.parent_id === parentId)
    .sort((a, b) => a.orbital_radius_au - b.orbital_radius_au)
}

// Every descendant of a body, depth-first. Used when deleting a parent.
export function descendantsOf(bodies: SystemBody[], id: string): SystemBody[] {
  const out: SystemBody[] = []
  const walk = (parentId: string) => {
    for (const child of bodies.filter(b => b.parent_id === parentId)) {
      out.push(child)
      walk(child.id)
    }
  }
  walk(id)
  return out
}

// Would re-parenting `id` under `newParentId` create a cycle?
// Guards the drag-to-reparent path in the editor.
export function wouldCycle(bodies: SystemBody[], id: string, newParentId: string | null): boolean {
  if (!newParentId) return false
  if (id === newParentId) return true
  const byId = new Map(bodies.map(b => [b.id, b]))
  let cursor = byId.get(newParentId) ?? null
  while (cursor) {
    if (cursor.id === id) return true
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) ?? null : null
  }
  return false
}

// The stars of a system (top-level bodies of kind 'star').
export function starsOf(bodies: SystemBody[]): SystemBody[] {
  return bodies.filter(b => b.kind === 'star')
}

// A system's headline star class, used for its dot colour on the galaxy map.
export function primaryStarClass(bodies: SystemBody[]): string | null {
  const stars = starsOf(bodies)
  if (!stars.length) return null
  // The most massive star is the primary; fall back to the first one added.
  const sorted = [...stars].sort((a, b) => (b.mass_solar ?? 0) - (a.mass_solar ?? 0))
  return sorted[0].body_class
}

export function systemColor(bodies: SystemBody[]): string {
  const cls = primaryStarClass(bodies)
  return cls ? starClassMeta(cls).color : '#64748b'
}

// ===========================================================================
// Map rendering constants
// ===========================================================================

// Pixels per light-year at 100% zoom.
export const BASE_PX_PER_LY = 8
export const MIN_SCALE = 0.15
export const MAX_SCALE = 8
// Snap increment, in light-years, when snap-to-grid is on.
export const SNAP_LY = 1
