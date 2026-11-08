# Redesign: the box actually opens

Goal: stop treating the box as six independent panel mini-games. The box
itself is the puzzle: faces affect each other, the lid really opens, and the
ending happens inside.

## Flow

### Act 1 — Shell (exterior)

Three stages. The gear is not an item: it is a **corner gear** built into the
right-top edge of the box, half visible on the right face and half on the top.
It is there from the start, jammed.

| Stage | Face  | Puzzle                                                        | Gives / causes                         |
|-------|-------|---------------------------------------------------------------|----------------------------------------|
| 1     | Front | Sigil counts → code 3142 → drawer (existing)                  | Overlay sheet; drawer frees the gear (L1) |
| 2     | Right | Lay the sheet on the right face → clue 1-4-6; turn the corner gear to stops 1 → 4 → 6 (replaces the direction dial) | Compartment opens: seal medal |
| 3     | Top   | Medal into the top socket + symbol dial ○△◇□ (moved from bottom) | Lid latch releases (L2) → Act 2   |

Removed: top three rings, back slider maze + brass key, the separate left
overlay face, the right-face direction dial. Back, left and bottom become
plain (decorated) faces.

Linkages:

- **L1** Pulling the drawer out knocks a pin loose inside; the corner gear,
  which wiggled but would not turn, now turns.
- **L1b** Turning the corner gear on the right face also turns the symbol
  dial on top — the player sees one part drive another face before stage 3.
- **L2** Solving the top: a heavy clunk, the lid rises a few mm and a seam of
  light appears along its edge.

### Act 2 — Lid (top)

No puzzle here — the top face was the last lock. Act 2 is the release beat.

1. **Lift.** Focus the top: hint 「蓋を持ち上げる」. The lid follows the drag
   with resistance; released below ~30° it drops back with a thud. Past
   30° it swings to ~105° on its own, bounces once, and a brass lid stay
   unfolds to hold it.
2. **Light.** A light inside the box ramps up as the lid opens, spilling
   through the gap before the interior is visible.
3. **Reveal.** Camera moves on its own over the box and looks in (~60° down),
   then a slow ~2 s pan along the walls: the back of the corner gear and its
   shaft, the pin the drawer knocked loose, the push rod from the drawer.
   "It was all one machine." Then control returns.
4. **Clue.** The underside of the open lid faces the camera and carries the
   engraving for Act 3.

After that: 「観察に戻る」 returns to the overview with the lid open; the box
can still be rotated; tapping the opening re-enters the inside view.

### Act 3 — Inside

Everything is already in the box; no items are picked up.

Layout (seen from above, on a false floor above the drawer):

- **Driver**: the back of the corner gear, right-back corner. Dragging it
  turns it (same part as Act 1, now seen from inside).
- **Inner case**: centre, holds the gem. A latch disc on its side, with an
  arrow showing which way opens it.
- **Three idler gears on swing arms** between them. Tap an arm to swing its
  gear into or out of mesh.

Turning the driver shows what the current setup does:

| Setup                                   | Result                                     |
|-----------------------------------------|--------------------------------------------|
| Chain does not reach the latch          | Gears spin, latch idle                     |
| Three gears meshing in a loop           | Jams: driver will not turn, creak          |
| Chain reaches latch, wrong direction    | Latch turns the wrong way, clunks, stops   |
| Chain reaches latch, right direction    | Latch opens                                |

Clue (lid underside): an arrow on the driver and an arrow on the latch, both
the same way. Players learn from the wrong-direction clunk that the number
of gears in between decides direction. Exactly one arm setup is correct;
positions are tuned during implementation so both a short wrong path and a
longer right path exist.

Ending: latch spins open → the inner case lid springs up → the gem rises on a
small lift, blue light fills the box and spills out of the opening → camera
pulls back to the whole box glowing → ending card (title + 「もう一度遊ぶ」).

## Technical changes

1. Body: solid `BoxGeometry` → hollow shell (4 walls + bottom + false floor)
   and a separate lid group pivoting on the back-top edge. The top anchor and
   top brass trim move into the lid group.
2. Focus: `BoxFaceFocusController` only knows six faces; add an `inside`
   focus target with its own camera pose.
3. Linkages L1/L2 wired in `PuzzleBox3D` between puzzle classes.
4. Delete `TopPuzzleTwo`, `BackPuzzleThree`; fold the overlay into the right
   face; move the medal + symbol dial from bottom to top; add the corner gear.
5. New: `BoxLid` (drag + hinge + stay + reveal camera), `InteriorPuzzle` (gear train + ending).
6. Ending modal moves to after the interior sequence.

## Phases

1. Hollow body + hinged lid + interior camera (debug trigger to open). Most
   risk; check visually on desktop and phone.
2. Act 1 rework: three stages, corner gear, L1/L1b/L2.
3. Interior gear train + gem + ending.
4. L1 left cover + mechanism backs visible inside + polish.
