# Surface paint and hull sections

Rooms still use five-foot layout cells. Select a room in 2D or 3D, then choose a
surface in its inspector. Customized 3D faces also select that room and surface.
The flat surface grid measures actual feet along the face, including the physical
slant length of a side. Partial squares are clipped at boundaries and doors.

Brush, eraser, rectangle selection, Shift-add selection and fill operate only on
the current face. Completed strokes enter the editor's shared map undo/redo
history; cancelled captures and Escape do not change the plan. Keyboard users can
address a square by its x/y coordinates and add it to selection or paint it.
Pan and zoom affect the flat viewport only. Save/reload uses the normal ship or
private-design revision workflow; approved designs still require resubmission.

Each override has an independent ID plus stable deck/room/face references. Moving
a room carries its surfaces; resizing/shaping clips rather than deletes outlying
paint. Removing rooms/decks/components removes their dependent customization;
template copies regenerate IDs and references. Clear surface customization restores
the face defaults. Component color changes do not change quality or condition.

Hull controls apply to one room's exposed side. Extension is 0–10 feet outward,
slope is the fraction of extension removed at the top (0 upright, 1 flush with
the room boundary), taper shortens the outer edge by 0–80%, and bevel creates a
top closing band. Bevel is limited visually to half the deck height. The room
footprint and usable interior never change. Sections have closed caps; main faces
support tiled patterns, while closing caps inherit the section color. This is not
arbitrary vertex editing or a collision/combat simulation.

Storage is optional schema-v1 `surface_design`, with surfaces, sections and
component-color arrays. Paint uses a six-digit-color palette (maximum 64 per face)
and sorted nonoverlapping [start, length, paletteIndex] runs. Addresses use a fixed
1024-square row stride so resizing does not shift patterns. Whole-ship limits are
50,000 painted squares, 10,000 runs, and the existing 2 MB plan limit. Each array
allows at most 2,000 entries. The server validates references and global IDs.

Rendering uses surface-segment meshes, never tile meshes. Painted surfaces use
two texture pixels per foot, with a 16-million-pixel (64 MB raw RGBA) budget and
2,000 surface meshes per view. A visible warning recommends a single-deck view
when detail reaches the budget. Textures/geometries are disposed on rebuild.
Undo retains at most 50 prior plans within an approximately 8 MB serialized budget.

Apply `sql/20261002182938_ship_surface_design.sql` only after independent review
and the approved design-review migration. It adds a pure validation helper and
replaces the existing validator, ship trigger and workflow RPC while preserving
their ACLs. No table, policy or live row is changed. Clients that omit the optional
field retain customization; deleted referenced rooms/parts are pruned. Explicit
malformed references remain errors. An old client forwarding stale customization
after structural edits may need a reload to use the new editor.

Tests: `node scripts/test-ship-surfaces.mjs` (model/geometry),
`node scripts/test-ship-surface-db.mjs` (isolated PostgreSQL, permissions and workflow
compatibility), and `npm run test:ships:ui` (mocked browser interactions). Never use
live campaign writes to generate test fixtures.
