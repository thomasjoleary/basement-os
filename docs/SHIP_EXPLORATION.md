# Paint and Walkthrough

Both views share the current in-memory editor plan. Switching views never saves, discards, or grants edit access. Accepted/submitted designs and crew views remain read-only. No database migration or access changes are required.

Paint presents all room floors or a selected room face (floor, ceiling, roof, interior wall or exterior section) on the selected deck at one-foot resolution. Brush and eraser use a square footprint, 1–20 feet per side; the hover preview shows exactly the clipped squares affected. Select supports rectangles and Shift-add; Fill uses the selection or visible floor area. Pan is an explicit separate tool. Completed strokes enter the shared map undo history; canceled strokes do not. Existing room-local paint, colors and off-footprint retained squares survive deck-wide editing. Floor painting and individual surface editing use the same stored surfaces.

Walkthrough uses WASD/arrows, drag-to-look, optional mouse lock, and on-screen movement controls. Escape, loss of focus, hidden tabs and changing views release movement. Walls block a swept circular body; saved doors are open passages. Movement stays on room floors. Furniture is decorative and does not block movement. This is exploration, not combat or a movement simulation.

Connections render as ladders without changing their stored kind, name or endpoints. Click a ladder within 10 feet, or its accessible button. Transfers follow the actual connection and look for a clear landing within one cell of its saved endpoint. Missing or unsafe destinations are refused; no alternate deck links are invented. Ladder travel preserves the canvas, movement mode, mouse look and pointer lock. Escape still exits. Existing lift/stair connections retain their data and semantics.

Local browser fixtures cover brush sizes, undo/redo, panning, cancellation, view switches, save/reload, read-only views, wall collisions, ladders and control release. Live CI remains read-only and does not create campaign data.


## Physical deck openings

`connections[].aperture` is optional `{width, height, ladder_part_id}`. Dimensions use five-foot plan cells. A null ladder reference means a view-only opening; a non-null reference points to a separate quantity-one `Ladder` component at the source endpoint. Removing a ladder leaves the opening. Copying a plan remaps the fixture reference.

Deck order is top to bottom. Physical openings join adjacent decks and must fit the room-floor union at both ends. Saved endpoints determine horizontal display alignment; no saved positions are rewritten. Multiple openings between the same decks must agree on alignment. Multi-level holds use a larger opening for each adjacent pair. Legacy links keep their IDs, kinds and destinations: compatible links display as one-cell apertures with ladders without any record backfill. Legacy nonadjacent, uncovered or inconsistently aligned links retain travel and show an explicit limitation instead of a fake through-hole.

Upper floors and lower ceilings/roof faces are actually subdivided around openings, including their solid floor bases. Paint retains local UV coordinates and hidden squares while skipping holes. All connected decks are rendered in Walkthrough; ladders rise from the lower deck into the opening and have short upper handholds. Movement stays on solid room floor and stops at hole edges; no falling or free flight. Arrival selects a clear nearby point and refuses unsafe destinations. No ladder means no traversal, although the room above/below remains visible.

Apply reviewed `sql/20261002200613_ship_deck_openings.sql` before publishing aperture-writing UI. The migration only updates validators and optional-field preservation in existing save paths; authorization and RLS are unchanged. Older clients omitting aperture fields retain prior values by stable connection ID. Removing referenced ladder inventory through an old client clears traversal, not the opening. New explicit invalid geometry is rejected atomically. Accepted snapshots follow the existing frozen submission/GM acceptance workflow.
