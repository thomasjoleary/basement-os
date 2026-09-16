/**
 * Validates the surface-temperature model in lib/galaxy.ts against measured
 * bodies, the same way the habitability scores were validated.
 *
 * The grey-atmosphere fit is calibrated, not derived, so it is only worth
 * trusting as far as it reproduces worlds we have actually been to. Run it
 * after touching bondAlbedo, GREENHOUSE_POTENCY or computedSurfaceTemp:
 *
 *   npx tsc --outDir /tmp/thermal --module commonjs --target es2020 \
 *     --moduleResolution node --skipLibCheck scripts/validate-thermal.ts
 *   node /tmp/thermal/scripts/validate-thermal.js
 *
 * Every case asserts a tolerance. A non-zero exit means the model moved.
 */
import {
  type SystemBody, type AtmosphereType, type HydrosphereType, type TectonicsType,
  computedSurfaceTemp, bondAlbedo, greenhouseOpticalDepth, resolveTraits,
  habitabilityScore, resolveThermal, habitableZone, zonePlacement, surfaceGravityG,
} from '../lib/galaxy'

function world(over: Partial<SystemBody>): SystemBody {
  return {
    id: 'x', system_id: 's', parent_id: null, kind: 'planet', name: 'test',
    body_class: 'terrestrial', orbital_radius_au: 1, orbital_period_days: null,
    angle_deg: 0, mass_solar: null, radius_km: null, color: null,
    description: '', gm_notes: '',
    atmosphere: null, pressure_atm: null, oxygen_pct: null, hydrosphere: null,
    surface_temp_c: null, tectonics: null, magnetosphere: null,
    axial_tilt_deg: null, rotation_hours: null, eccentricity: null,
    biosphere: null, resources: [], habitability_override: null,
    created_at: '', updated_at: '',
    ...over,
  }
}

interface Case {
  name: string
  luminositySolar: number
  au: number
  atmosphere: AtmosphereType
  pressureAtm: number
  hydrosphere: HydrosphereType
  /** Measured mean surface temperature, degrees C. */
  actualC: number
  /** Allowed error. Wider where the real world is genuinely awkward. */
  tolC: number
  why?: string
  /**
   * A case the model is known to get wrong, and why. Reported but not counted
   * as a failure -- kept so the limitation stays visible and measured instead
   * of being deleted or hidden behind a meaningless tolerance.
   */
  knownMiss?: string
}

const SOL = 1

const CASES: Case[] = [
  // --- Calibration anchors. These are what the constants were fitted to, so
  // they must come out near-exact; a drift here means a constant moved.
  { name: 'Earth', luminositySolar: SOL, au: 1, atmosphere: 'breathable', pressureAtm: 1, hydrosphere: 'seas', actualC: 15, tolC: 3 },
  { name: 'Venus', luminositySolar: SOL, au: 0.723, atmosphere: 'corrosive', pressureAtm: 92, hydrosphere: 'none', actualC: 464, tolC: 20 },
  { name: 'Mars', luminositySolar: SOL, au: 1.524, atmosphere: 'thin', pressureAtm: 0.006, hydrosphere: 'trace', actualC: -63, tolC: 5 },

  // --- Independent checks: bodies the constants were NOT fitted to.
  // Compared against the blackbody temperature (270.4 K) rather than the
  // commonly quoted -20C mean. Those are different quantities: radiated power
  // goes as T^4, so a slow rotator with a 300-degree day/night swing has a MEAN
  // surface temperature well below its equilibrium temperature. The model
  // computes the latter and makes no claim about the former.
  { name: 'Moon', luminositySolar: SOL, au: 1, atmosphere: 'none', pressureAtm: 0, hydrosphere: 'none', actualC: -3, tolC: 10,
    why: 'Airless and dark, so it sits at equilibrium. (Quoted mean is -20C; see note above.)' },
  { name: 'Mercury', luminositySolar: SOL, au: 0.387, atmosphere: 'none', pressureAtm: 0, hydrosphere: 'none', actualC: 167, tolC: 40,
    why: 'Airless and slow-rotating; a mean figure is crude by nature.' },
  { name: 'Titan', luminositySolar: SOL, au: 9.54, atmosphere: 'dense', pressureAtm: 1.45, hydrosphere: 'ice', actualC: -179, tolC: 20,
    why: 'Organic haze makes its real albedo (0.27) far darker than ice suggests.' },
  { name: 'Europa', luminositySolar: SOL, au: 5.2, atmosphere: 'none', pressureAtm: 0, hydrosphere: 'ice', actualC: -171, tolC: 15 },
  { name: 'Callisto', luminositySolar: SOL, au: 5.2, atmosphere: 'none', pressureAtm: 0, hydrosphere: 'ice', actualC: -139, tolC: 15,
    knownMiss: 'One ice albedo cannot span real icy surfaces: Europa is clean ice at 0.62, Callisto is dark dirty ice at ~0.15. '
      + 'bondAlbedo() uses 0.55, which fits Europa and runs Callisto too cold. Set surface_temp_c by hand for a dirty-ice world.' },

  // --- Exoplanets, under the Earth-like atmosphere their "potentially
  // habitable" billing assumes. None of these atmospheres has been measured,
  // so the target is the literature's modelled figure, not an observation.
  { name: 'TRAPPIST-1 e', luminositySolar: 0.000553, au: 0.02925, atmosphere: 'breathable', pressureAtm: 1, hydrosphere: 'seas', actualC: -14, tolC: 25,
    why: 'The system\'s best candidate: temperate under an Earth-like atmosphere.' },
  { name: 'TRAPPIST-1 g', luminositySolar: 0.000553, au: 0.04683, atmosphere: 'breathable', pressureAtm: 1, hydrosphere: 'seas', actualC: -68, tolC: 25,
    why: 'In the conservative zone by Kopparapu, but only 0.25 S-earth: the literature calls it likely icy, and the model must agree.' },
  // Target is derived, not observed: published equilibrium temperature 234 K,
  // plus Earth's own 33 K greenhouse, since that is the atmosphere assumed.
  { name: 'Proxima Cen b', luminositySolar: 0.0017, au: 0.0485, atmosphere: 'breathable', pressureAtm: 1, hydrosphere: 'seas', actualC: -6, tolC: 15 },
]

let failures = 0
const knownMissesNowPassing: string[] = []
console.log('Surface temperature model vs measured bodies\n')
console.log('  body            model     actual    delta   albedo    tau')
console.log('  ' + '-'.repeat(62))

for (const c of CASES) {
  const b = world({
    orbital_radius_au: c.au,
    atmosphere: c.atmosphere,
    pressure_atm: c.pressureAtm,
    hydrosphere: c.hydrosphere,
  })
  const th = computedSurfaceTemp(b, c.luminositySolar, c.au)
  if (!th) { console.log(`  ${c.name}: NO RESULT`); failures++; continue }

  const traits = resolveTraits(b)
  const delta = th.surfaceTempC - c.actualC
  const within = Math.abs(delta) <= c.tolC
  if (!within && !c.knownMiss) failures++
  if (within && c.knownMiss) knownMissesNowPassing.push(c.name)
  console.log(
    `  ${within ? ' ' : c.knownMiss ? '~' : '!'} ${c.name.padEnd(14)}` +
    `${String(th.surfaceTempC).padStart(6)}°C` +
    `${String(c.actualC).padStart(8)}°C` +
    `${(delta >= 0 ? '+' : '') + delta}`.padStart(8) +
    `${bondAlbedo(traits).toFixed(2)}`.padStart(9) +
    `${greenhouseOpticalDepth(traits).toFixed(2)}`.padStart(8) +
    (within ? '' : c.knownMiss ? '   <-- known limitation' : `   <-- outside +/-${c.tolC}`)
  )
  if (c.why) console.log(`      ${c.why}`)
  if (c.knownMiss && !within) console.log(`      KNOWN: ${c.knownMiss}`)
}

console.log()
if (knownMissesNowPassing.length) {
  console.log(`Note: ${knownMissesNowPassing.join(', ')} now pass(es). If that was deliberate, drop the knownMiss note.\n`)
}
const counted = CASES.filter(c => !c.knownMiss).length
console.log(`${counted - failures}/${counted} asserted temperature cases within tolerance (${CASES.length - counted} known limitation(s) reported above).`)


// ===========================================================================
// Effect on the habitability scores
//
// Computing a temperature replaced zone placement as the input to the
// temperature factor and its caps, so it moves scores. This section isolates
// that: the SAME body is scored twice with identical inputs, once through the
// old zone-only path (thermal: null) and once with the computed temperature.
// The delta is the change's effect and nothing else.
//
// Radii and masses are stated here so the numbers quoted in docs/V2_OVERVIEW.md
// are reproducible. For the exoplanets several are poorly constrained -- a
// non-transiting planet has no measured radius at all -- so treat the absolute
// scores as illustrative and the DELTA as the meaningful figure.
// ===========================================================================

const EARTH_MASSES_PER_SOLAR_LOCAL = 332946

interface HabCase {
  name: string
  luminositySolar: number
  teffK: number
  au: number
  radiusEarth: number
  massEarth: number
  atmosphere: AtmosphereType
  pressureAtm: number
  oxygenPct: number
  hydrosphere: HydrosphereType
  tectonics: TectonicsType
  /** Expected delta from the temperature model. 0 = must not move. */
  expectDelta: number
  why?: string
}

const EARTHLIKE = {
  atmosphere: 'breathable' as AtmosphereType, pressureAtm: 1, oxygenPct: 21,
  hydrosphere: 'seas' as HydrosphereType, tectonics: 'active' as TectonicsType,
}

const HAB_CASES: HabCase[] = [
  { name: 'Earth', luminositySolar: 1, teffK: 5772, au: 1, radiusEarth: 1, massEarth: 1, ...EARTHLIKE, expectDelta: 0 },
  { name: 'Venus', luminositySolar: 1, teffK: 5772, au: 0.723, radiusEarth: 0.949, massEarth: 0.815,
    atmosphere: 'corrosive', pressureAtm: 92, oxygenPct: 0, hydrosphere: 'none', tectonics: 'dead', expectDelta: -2,
    why: '464°C trips the lethal-temperature ceiling (10), which binds tighter than the toxic-air one (12).' },
  { name: 'Titan', luminositySolar: 1, teffK: 5772, au: 9.54, radiusEarth: 0.404, massEarth: 0.0225,
    atmosphere: 'dense', pressureAtm: 1.45, oxygenPct: 0, hydrosphere: 'ice', tectonics: 'dead', expectDelta: -9,
    why: 'Was capped at 30 by "too-cold zone"; at a computed -190°C the lethal ceiling (10) applies. Its settlement tier is unchanged -- still a good outpost, which is the point of scoring the two separately.' },
  { name: 'Proxima Cen b', luminositySolar: 0.0017, teffK: 3042, au: 0.0485, radiusEarth: 1.07, massEarth: 1.07, ...EARTHLIKE, expectDelta: 0 },
  { name: 'TRAPPIST-1 e', luminositySolar: 0.000553, teffK: 2566, au: 0.02925, radiusEarth: 0.92, massEarth: 0.69, ...EARTHLIKE, expectDelta: 0 },
  { name: 'Kepler-442 b', luminositySolar: 0.117, teffK: 4402, au: 0.409, radiusEarth: 1.34, massEarth: 2.30, ...EARTHLIKE, expectDelta: 0 },
  { name: "Teegarden's b", luminositySolar: 0.00073, teffK: 2904, au: 0.0252, radiusEarth: 1.02, massEarth: 1.05, ...EARTHLIKE, expectDelta: 8,
    why: 'Zone placement called it optimistic-inner (12/20); the computed 25°C is simply temperate (20/20). The zone proxy was understating it.' },
  { name: 'TOI-700 d', luminositySolar: 0.0233, teffK: 3480, au: 0.163, radiusEarth: 1.07, massEarth: 1.72, ...EARTHLIKE, expectDelta: 8,
    why: 'Same as Teegarden\'s b: optimistic-inner by zone, 6°C by computation.' },
  { name: 'Kepler-452 b', luminositySolar: 1.21, teffK: 5757, au: 1.046, radiusEarth: 1.63, massEarth: 5.00, ...EARTHLIKE, expectDelta: 0 },
  // NOTE: Gliese 667 Cc does not transit, so it has NO measured radius -- only a
  // minimum mass. Its score is therefore decided by whatever radius is assumed:
  // 1.50 R-earth (a rocky reading of 3.8 M-earth) scores 90, while anything above
  // the 1.6 Fulton limit is capped at 40. docs/V2_OVERVIEW.md quotes 40, which
  // implies the larger assumption. The temperature model does not affect either.
  { name: 'Gliese 667 Cc', luminositySolar: 0.0137, teffK: 3700, au: 0.125, radiusEarth: 1.50, massEarth: 3.80, ...EARTHLIKE, expectDelta: 0 },
  { name: 'Kepler-186 f', luminositySolar: 0.0412, teffK: 3788, au: 0.432, radiusEarth: 1.17, massEarth: 1.44, ...EARTHLIKE, expectDelta: 0 },
  { name: 'LHS 1140 b', luminositySolar: 0.00441, teffK: 3096, au: 0.0946, radiusEarth: 1.73, massEarth: 6.98, ...EARTHLIKE, expectDelta: 0 },
  { name: 'K2-18 b', luminositySolar: 0.0234, teffK: 3457, au: 0.1591, radiusEarth: 2.61, massEarth: 8.63, ...EARTHLIKE, expectDelta: 0 },
]

console.log('\n\nHabitability score: zone-only path vs computed temperature')
console.log('(identical inputs both times -- the delta is this change alone)\n')
console.log('  body              zone-only  computed   delta   temp')
console.log('  ' + '-'.repeat(58))

for (const c of HAB_CASES) {
  const b = world({
    orbital_radius_au: c.au,
    atmosphere: c.atmosphere, pressure_atm: c.pressureAtm, oxygen_pct: c.oxygenPct,
    hydrosphere: c.hydrosphere, tectonics: c.tectonics,
    mass_solar: c.massEarth / EARTH_MASSES_PER_SOLAR_LOCAL,
    radius_km: c.radiusEarth * 6371,
  })
  const hz = habitableZone(c.luminositySolar, c.teffK)
  const zone = hz ? zonePlacement(c.au, hz) : null
  const gravityG = surfaceGravityG(b.mass_solar, b.radius_km)
  const before = habitabilityScore(b, { zone, gravityG, tidallyLocked: false, thermal: null }).score
  const th = resolveThermal(b, c.luminositySolar, c.au)
  const after = habitabilityScore(b, { zone, gravityG, tidallyLocked: false, thermal: th }).score
  const delta = after - before
  const ok = delta === c.expectDelta
  if (!ok) failures++
  console.log(
    `  ${ok ? ' ' : '!'} ${c.name.padEnd(16)}` +
    `${String(before).padStart(6)}` +
    `${String(after).padStart(11)}` +
    `${(delta === 0 ? 'same' : (delta > 0 ? '+' : '') + delta).padStart(8)}` +
    `${String(th?.surfaceTempC ?? '-').padStart(7)}°C` +
    (ok ? '' : `   <-- expected ${c.expectDelta >= 0 ? '+' : ''}${c.expectDelta}`)
  )
  if (c.why && delta !== 0) console.log(`      ${c.why}`)
}

console.log()
if (failures) {
  console.error(`${failures} case(s) failed.`)
  process.exit(1)
}
console.log('Habitability deltas all as expected.')
