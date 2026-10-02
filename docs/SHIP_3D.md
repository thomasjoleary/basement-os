# Ship 3D views and deck heights

Feature-branch implementation. The coordinated database review applied this exact SQL
as migration `20261002154845_ship_deck_heights`; all 26 live rollback-only checks
passed, with existing records and ACLs/RLS unchanged. Publication is preview-only.

## Data and compatibility

`Deck.height_ft` is optional in schema v1: absent means 8 feet. The editor loads
legacy plans with an 8-foot default without marking them dirty. New decks/templates
use 8 feet. GMs can change heights from 1 to 100 feet, including fractional values.
The additive migration is `sql/20261002152056_ship_deck_heights.sql` (filename
created with Supabase CLI, retained in the repository's sql directory).

Apply the migration before publishing the UI. It replaces only the existing plan
validator and before-write trigger function, retaining their ACLs, the save RPC,
RLS, approval gate and optimistic revision checking. There is no table rewrite or
backfill: existing rows and revision numbers remain unchanged until saved.
Old clients may omit heights; updates preserve the previous height by deck ID,
and inserts/new deck IDs receive 8 feet. Explicit invalid/null heights are rejected.
A failed save retains the draft and explains the required height setup.

Application rollback can use the previous UI while leaving this additive migration
in place. Do not restore the old validator after heights have been saved: it would
reject those documents. No destructive height-stripping rollback is provided.

## Rendering conventions

2D remains the authoring canvas. Cutaway and Exterior share the in-memory plan,
selection and inspector. Orbit/zoom/roof/deck controls never alter saved data.
3D receives the plan only, never GM notes or profile records.

One grid cell is displayed as 5 feet (a visual convention, not a combat rule).
The deck list stacks top-first, using saved heights plus a thin floor slab.
Deck origins align at x/y zero; no fabricated offsets or straight shafts are inferred
from connections with different endpoint positions. Connection pads remain inspectable.

Room boundaries create floors/walls. Shared wall edges are deduplicated and door
marks cut openings. Cutaway walls are reduced to 45% height for visibility.
Exterior shows full walls, roof panels, wing forms and booster
nozzles/emissive faces. Unknown part types use generic equipment models. Quantity
is inventory metadata and never multiplies geometry. Existing user ships are not
rewritten or replaced by templates.

The view uses pinned Three.js and its OrbitControls directly, without another React
renderer dependency. It is lazy-loaded and draws on demand rather than in a continuous
animation loop. Instanced geometry keeps draw calls low; pixel ratio is capped at 1.5.
The scene has a 6,000-instance ceiling, prioritizes the active deck, and announces
simplification; the complete plan remains available in 2D and the inventory.
Up to 24 room labels appear on a single-deck cutaway. 2D is the fallback for unavailable
WebGL2 or context loss. Camera, roof and deck-visibility settings are local view state.

## Verification

`npm run test:ships` includes geometry, old-plan normalization, height validation,
legacy-client saves, unchanged ACLs, migration reruns and ship permission tests.
`npm run test:registration` checks compatibility with the existing approval gate.
`npm run test:ships:ui` covers local mocked browser interactions and the 3D fallback;
no live campaign data or credentials are needed. Inspect screenshots in test-results.

Interior assemblies include their caps/screens when fitted below the ceiling.
Console-linked rooftop glazing was removed; cockpit windows belong to the hull.

Exterior fairings add tapered bow segments and sloped side armor outside occupied
rooms. Wing-root fairings appear only where a wing meets the hull. These are visual
skins, not new walkable space or persisted geometry; forward is decreasing grid y.
