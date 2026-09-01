// Shared types, constants & helpers for the v2 Galaxy map.
//
// Coordinates are light-years on a 3D axis. The map renders top-down (x/y) for now;
// z is stored so a future 3D view needs no migration.
//
// Orbital data uses AU for radii and solar masses for mass, so Kepler's third law
// stays a one-liner (see orbitalPeriodYears).

export type BodyKind = 'star' | 'planet' | 'moon' | 'station' | 'belt'

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
  created_at: string
  updated_at: string
}

// Singleton row (id = 1) holding the tunable travel constants.
export interface GalaxySettings {
  id: number
  galaxy_name: string
  // Fixed spin-up cost paid on every jump, regardless of distance.
  jump_charge_hours: number
  // Cruise speed once the drive is charged.
  jump_speed_ly_per_hour: number
  updated_at: string
}

export const DEFAULT_SETTINGS: GalaxySettings = {
  id: 1,
  galaxy_name: 'Uncharted Galaxy',
  jump_charge_hours: 6,
  jump_speed_ly_per_hour: 1,
  updated_at: '',
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

// Total time for a jump: a fixed drive spin-up plus cruise time over the distance.
export function jumpTimeHours(ly: number, settings: GalaxySettings): number {
  const speed = settings.jump_speed_ly_per_hour
  if (!speed || speed <= 0) return settings.jump_charge_hours
  return settings.jump_charge_hours + ly / speed
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
