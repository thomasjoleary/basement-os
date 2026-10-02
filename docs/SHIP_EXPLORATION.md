# Paint and Walkthrough

Both views share the current in-memory editor plan. Switching views never saves, discards, or grants edit access. Accepted/submitted designs and crew views remain read-only. No database migration or access changes are required.

Paint presents all room floors on the selected deck at one-foot resolution. Brush and eraser use a square footprint, 1–20 feet per side; the hover preview shows exactly the clipped squares affected. Select supports rectangles and Shift-add; Fill uses the selection or visible floor area. Pan is an explicit separate tool. Completed strokes enter the shared map undo history; canceled strokes do not. Existing room-local paint, colors and off-footprint retained squares survive deck-wide editing. Floor painting and individual surface editing use the same stored surfaces.

Walkthrough uses WASD/arrows, drag-to-look, optional mouse lock, and on-screen movement controls. Escape, loss of focus, hidden tabs and changing views release movement. Walls block a swept circular body; saved doors are open passages. Movement stays on room floors. Furniture is decorative and does not block movement. This is exploration, not combat or a movement simulation.

Connections render as ladders without changing their stored kind, name or endpoints. Click a ladder within 10 feet, or its accessible button. Transfers follow the actual connection and look for a clear landing within one cell of its saved endpoint. Missing or unsafe destinations are refused; no alternate deck links are invented. The arrival pauses controls until Enter walkthrough is selected. Existing lift/stair connections retain their data and semantics.

Local browser fixtures cover brush sizes, undo/redo, panning, cancellation, view switches, save/reload, read-only views, wall collisions, ladders and control release. Live CI remains read-only and does not create campaign data.
