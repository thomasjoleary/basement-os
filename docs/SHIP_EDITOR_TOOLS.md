# Ship editor conveniences

These tools use the existing ship-plan schema. No migration, access change or live data backfill is required. Existing ships and starter templates are unchanged until an authorized editor saves a change.

## Layout tools

Open **Layout tools** above the canvas. Enable a vertical and/or horizontal symmetry line and set its coordinate in grid cells, measured from the deck's top-left. Half-cell positions are supported. Each deck retains its guides during the editor session; guides are not saved into campaign data.

Select a room, fixture, wall, door or label. **Copy selection**, destination **Paste X/Y**, and **Paste selection** create an independent copy. Ctrl/Cmd+C and Ctrl/Cmd+V use this editor clipboard outside text fields; normal text selection and export dialogs retain browser behavior. The clipboard survives deck changes, but not leaving/reloading the editor. Rooms include their contained fixtures, marks, room-local paint and hull settings. Fixture colors and named material regions retain their values. Every copied ID is regenerated. Each operation is one shared Undo/Redo step.

**Mirror selection across X/Y** creates a reflected copy using that line. It reflects grid positions and swaps port/starboard wing types when reflecting across X. Fixture orientations otherwise follow their existing type; this does not add a rotation system. Copy failures are atomic: out-of-bounds placement, overlapping rooms, unsupported connections, or an invalid resulting plan leave the draft unchanged.

Connections and linked ladders require explicit placement on two decks and cannot be copied implicitly. Mirroring a room with hidden paint or shaped-hull cap paint is rejected with an explanation; ordinary paste preserves that paint. This avoids guessing the independent UV coordinates of those faces. Room-local floor/roof/ceiling and ordinary wall paint can be reflected. Copying does not duplicate global appearance windows.

Warnings flag overlapping components, footprints crossing their assigned room, rooms without a marked boundary door and decks without a connection. They are geometric suggestions, not navigation, damage, power or crew simulation. Intentional exterior overlaps are permitted. Warnings never block saving.

## Painting

The flat painter's **eyedropper** samples the selected square or its base surface color without painting. **Mirror painting** duplicates brush, eraser and fill edits into visible squares, clipping gaps and openings. All-deck floors use Layout tools' deck guides; individual unfolded faces provide their own guides measured in feet. Choose Paint view for mirrored painting. Exterior direct painting has **Sample exterior color**, while the existing Alt-to-end-stroke/orbit behavior is unchanged.

**Save color to palette** stores up to 24 colors in this browser. Both flat and exterior painters share the palette. Swatches select colors; the adjacent remove button deletes a swatch. Palette preferences do not modify a ship or enter map undo history. Browser storage restrictions produce a message rather than affecting paint.

## Deck-plan export

**Export deck plan** previews the current deck as a clean, labeled top-down diagram. **Download SVG** saves a self-contained scalable vector file that can be opened or printed in a browser. The plan includes rooms, exterior component footprints, walls/doors, marked openings, dimensions, orientation, scale and a numbered legend. Unsaved edits are labeled as a draft. Change the current deck to export another deck.

Assigned readers can export the plan they can already view. Export contains no GM notes, public notes, account identifiers, ownership or crew assignments. Labels are XML-escaped; the file contains no script or external resources. Export does not save or mutate the campaign.

## Verification

- `node scripts/test-ship-edit-tools.mjs`: atomic copies, identities, material colors, reflection/clipping, advisory warnings and safe export.
- `node scripts/test-ship-surfaces.mjs`: existing geometry, paint, opening, Alt-stroke and fixture regressions.
- `npm run test:ships:ui`: synthetic editor, permissions, interruption, reload, responsive layout and export tests.
- Deployed CI uses the existing authorized identity with intercepted synthetic ship responses and intercepted saves for convenience checks. It never creates or edits campaign records.
