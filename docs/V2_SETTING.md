# Basement OS v2 — Setting & Fiction

In-world material for the space campaign. This is the *fiction*; for the app and
schema see [V2_OVERVIEW.md](./V2_OVERVIEW.md).

---

## Jump Drives

> Jump drives are usually low charge time, high power and low speed, or they're
> high charge time, low power and high speed. A good way to think of it is to
> think of time and space as many many layers of fabric. Charging up the jump
> drive 'sharpens' your jump, allowing you to cut through the fabric easier.
> Drives with very little charge time are also known as 'hammer drives' since
> they can be imagined punching through the fabric with blunt force instead of
> cutting through. This is why they have high power draw.
>
> — GM

*One word corrected from the original dictation, which read "low speed" for both
drive types; confirmed that high-charge drives are the fast ones.*

### The three axes

A jump drive trades along three properties:

| Property | What it means at the table |
|---|---|
| **Charge time** | Fixed spin-up before a jump, paid regardless of distance |
| **Power draw** | How much of the ship's power budget the drive eats |
| **Speed** | How fast the ship covers distance once the jump is underway |

The image is **layers of fabric**. Charge sharpens the edge:

- **Long charge → a sharp cut.** The drive slices cleanly between layers. Low
  power draw, because precision does the work instead of force.
- **Little or no charge → a blunt punch.** A **hammer drive** forces its way
  through. Very high power draw, because brute force is expensive.

So the two ends of the spectrum are:

| | Charge | Power | Speed |
|---|---|---|---|
| **Hammer drive** (blunt) | low | high | low |
| **Sharpened drive** | high | low | high |

The tradeoff at the table is therefore *readiness vs. transit*: a hammer drive
gets you moving almost immediately but crawls between stars and strains the
power budget; a sharpened drive demands you sit still and charge, then crosses
the same gap far faster on less power. Fleeing an ambush favours the hammer;
a planned long haul favours the lance.

### Where this lives in code

`DRIVE_PROFILES` in `lib/galaxy.ts` — **placeholder numbers**, tune freely:

| Profile | Charge | Speed | Power | Notes |
|---|---|---|---|---|
| Standard Drive | 6h | 1 ly/h | medium | The baseline most hulls ship with |
| Hammer Drive | 1h | 0.4 ly/h | high | Leaves fast, arrives slow, drinks power |
| Lance Drive | 18h | 2.5 ly/h | low | Long charge, razor cut, sips power |

Jump time is `charge_hours + (distance_ly ÷ speed_ly_per_hour)`.

These are **not stored in the database** — jump performance is a property of the
ship and its components, so it will eventually be read off a ship record. The
galaxy map's drive picker is only a GM estimating tool.

---

## Stars

The map uses **real stellar classification** under approachable labels, so
"Yellow Star" is a G-type and "Red Dwarf" is an M-type, each carrying its real
temperature, mass, radius and luminosity ranges. Full data in `STAR_CLASSES`
(`lib/galaxy.ts`).

Two details worth keeping straight in descriptions given to players:

- **Hot stars are blue-*white*, not blue.** Blackbody colour converges to a pale
  blue-white as temperature rises — no star is ever deeply blue.
- **Red dwarfs are the common case**, roughly 76% of main-sequence stars. A
  randomly chosen system is most likely a dim red one.

Roughly a third of systems are **multiple** (binary or more), and that fraction
climbs steeply with mass: most hot bright stars have companions, while red
dwarfs are usually alone.

### Which stars can host life

Two separate questions, with different answers:

1. **Where around this star could liquid water sit?** — the habitable zone, computed from luminosity.
2. **Could this kind of star host life at all?** — often no, for reasons that have nothing to do with the zone.

A blue giant has a perfectly good habitable zone. It also burns out in a few million years, so nothing in it has time to evolve.

| Star | Verdict | Why |
|---|---|---|
| Blue Giant (O) | ✖ | ~5 million years of life. Sterilising UV besides. |
| Blue-White (B) | ✖ | Tens to a few hundred million years. |
| White (A) | ⚠️ | ~1–3 billion years — borderline for simple life, never enough for complex. Harsh UV. |
| Pale Yellow (F) | ⚠️ | ~4–7 billion years. Fine for simple life; complex life at the cooler end. |
| **Yellow (G)** | 🌱 | The baseline. ~10 billion years, no special hazards. This is the Sun. |
| **Orange Dwarf (K)** | 🌱 | Arguably the best of all — tens of billions of years, far less flaring than an M dwarf. |
| Red Dwarf (M) | ⚠️ | Effectively unlimited time, but tidal locking, flares stripping atmospheres, and a blindingly bright first billion years. **Genuinely disputed among astronomers** — not a settled no. |
| Red Giant | ⚠️ | The zone sweeps outward as the star swells; any orbit is only temperate for a window (~200 Myr to a few Gyr). |
| Red Supergiant | ✖ | Lasts tens of thousands of years, then explodes. |
| White Dwarf | ⚠️ | A real zone, but ~0.005–0.02 AU out, tidally locked, near the shredding limit, shrinking as it cools. Any world there arrived *after* the star died. |
| Neutron Star / Pulsar | ✖ | No steady warmth. Pulsar planets are real — the first exoplanets ever found orbited one — but the radiation is lethal. |
| Black Hole | ✖ | No light, no zone. |

**For the campaign:** yellow and orange stars are where ordinary settled worlds belong. Red dwarfs are the interesting middle ground — abundant (three quarters of all stars), long-lived, and arguable either way, which makes them good ground for a setting to take a position on. The exotic remnants are where you put something that has no business being alive.

### The remnants

White dwarfs, neutron stars, pulsars and black holes are all available as system
centres.

**Black holes** are treated as a genuine special case: no photosphere, so
temperature and luminosity are meaningless and the UI suppresses them rather
than printing zeros. Their one real dimension is the event horizon —
2.95 km per solar mass, so a 12-solar-mass hole has a ~35 km radius.

---

## Places

*(Nothing recorded yet — the seed galaxy in `sql/v2_002_galaxy_seed.sql` has
four placeholder systems that can be deleted or renamed at will.)*
