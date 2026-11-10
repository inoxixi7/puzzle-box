# Redesign: the box actually opens

Goal: stop treating the box as six independent panel mini-games. The box
itself is the puzzle: faces affect each other, the lid really opens, and the
ending happens inside.

## Flow

### Act 1 — Shell (exterior)

No words anywhere on the box: every message is a pictogram, so players of
any language can play. (The HUD around the scene is separate.)

Style: modern puzzle box. Walnut body, brushed aluminium base and hardware,
smoked glass windows, graphite details, one amber accent light. No printed
UI on the box; every mechanism is a physical or electronic part.

Progression: the box starts **dead**. The first ring is purely mechanical and
closes a circuit; each later ring is more electronic. Four amber status
lights on the base count the rings. Clues are never handed over as answers:
each one needs a small translation (dial drawings → knob, the puck's arrow
→ key order).

| # | Where | Mechanism | Solving it |
|---|-------|-----------|------------|
| 1 | Front | 7×7 tilt maze behind round glass. Drag to turn the disk; the steel ball rolls with real gravity (also when the whole box is turned). A trap hole looks like the real one and drops the ball back to the start. Eleven quarter turns at the least; one way only never works | Ball drops into the lit hole and closes the contacts: the box powers up, status light 1 |
| 2 | Back | 3×3 backlit touch matrix (lights-out): a press flips the key and its neighbours; clear all lights (4 presses at the least). The goal is on the left e-ink screen, which wakes with the power: [live copy of the matrix] → [all dark] → [card, open lock], the copy following every press | The front dispenser pushes out the **access card**, the NFC pad starts breathing, status light 2 |
| 3 | Left | Smoked glass over an e-ink screen and a hidden NFC pad | Card on the pad (the screen shows card → pad): e-ink refresh draws an open lock and three dials pointing ↗ ↓ ←, with 1, 2, 3 dots under them for the order; the knob unlocks, status light 3 |
| 4 | Right | Knob with detents set into the face, drawn the same way as the dials on the screen; turn it to ↗ ↓ ← (judged on each snap). Its gear sits inside the box (seen again in Act 3) | A drawer beside it pops out the **magnetic puck**: one key tab, four engraved symbols, and an arrow that starts at the tab and runs clockwise through them. Status light 4 |
| 5 | Lid | Looks like plain wood. Dock the puck, then turn it until its tab meets the engraved mark: the hall sensor wakes capacitive keys lit through the veneer. Order = the symbols along the puck's arrow (○ △ ◇ □); they stand upright only when the puck is aligned. Keys light on press but only a full four-key entry is judged, so guessing key by key gives nothing away | Lock releases, the lid lifts a crack → Act 2 |

- After each ring the camera turns the box to show what just changed.
- No confirm buttons anywhere. Wrong input resets; starting again on the
  first correct input counts as step one.

### Act 2 — Lid (top)

No puzzle here — the top face was the last lock. Act 2 is the release beat.

1. **Lift.** The lid springs open a crack, then swings to ~105° on its own
   and bounces once, so nobody gets stuck here. It can also be dragged open
   sooner: it follows the drag with resistance, and released below ~30° it
   drops back with a thud.
2. **Light.** A light inside the box ramps up as the lid opens, spilling
   through the gap before the interior is visible.
3. **Reveal.** Camera moves on its own over the box and looks in (~60° down),
   then control returns.
4. **Clue.** The underside of the open lid holds the gear rack; the clue
   plaque stands against the back wall.

After that: 「観察に戻る」 returns to the overview with the lid open; the box
can still be rotated; tapping the opening re-enters the inside view.

### Act 3 — Inside

Everything is already in the box; no items are picked up.

Layout (seen from above, on a false floor above the drawer):

- **Driver** (D): aluminium gear against the right wall, with a pawl so it
  only turns clockwise (engraved arrow). Drag it round to turn it.
- **Inner case**: left, holds the gem, bolted by a rod from each latch.
- **Two latch gears**, graphite, each with an amber arrow the way it opens:
  L1 (back) counter-clockwise, L2 (front) clockwise. Both must turn open in
  the same drag; on release springs turn them back shut. A latch turned the
  wrong way gives a little, clunks, and stops the whole train.
- **Peg board**: ten pegs on the floor. **Rack** on the underside of the
  open lid with six loose gears: one large, two medium, three small; two are spares. Tap a gear to take it
  (it glows), tap a free peg to fit it; tap a fitted gear to put it back. A
  gear too big for the gap will not go in.

Two gears mesh only when the pegs are exactly r1 + r2 apart, so which size
goes where has to be worked out. Each mesh reverses the turn; an odd ring
jams. The layout comes from a search that tries every way to fit the gears:
exactly one opens both latches (S on pegs 7 and 5, M on 3 and 4:
D–S–S–M, and that M drives L2 directly and L1 through the other M). The
answer branches, so one gear is shared by both latches, and the large gear
is a decoy. Of the other fits, 279 turn a latch the wrong way, 417 jam,
82 open only one latch.

Clue (white inlay on a plaque against the back wall, tipped up to face the player): two meshing gears with opposite arrows; three
gears in a ring, crossed out. Pictures only.

Then: both bolts retract, the case lid springs up, and out of the case rises
a **key token** (a machined hex coin with a glowing blue ring) that hovers
over the box; light in the box turns blue. Tap it to take it (inventory);
the camera pulls back to the whole box.

### Finale — the token is a key

No new slot anywhere: a visible empty socket would be noticed from the start
and give the ending away. Instead the token goes back to the left-face NFC
pad, which the player thinks was used up by the card. The only clue is
colour: as soon as the token is taken, the pad (dark since the card) starts
breathing in the token's blue.

Token on the pad → it settles there, its ring turning, the e-ink screen
prints the token under an open lock → camera turns to the front → the four
status lights turn blue one by one → from the empty case rises the real
prize, a clear brilliant-cut stone with coloured fire and glints → ending
card with only that stone and a replay icon.

## Technical changes

1. Body: solid `BoxGeometry` → hollow shell (4 walls + bottom + false floor)
   and a separate lid group pivoting on the back-top edge. The top anchor and
   top trim move into the lid group.
2. Focus: `BoxFaceFocusController` only knows six faces; add an `inside`
   focus target with its own camera pose.
3. Linkages L1/L2 wired in `PuzzleBox3D` between puzzle classes.
4. Delete `TopPuzzleTwo`, `BackPuzzleThree`; fold the overlay into the right
   face; move the medal + symbol dial from bottom to top; add the corner gear.
5. New: `BoxLid` (drag + hinge + stay + reveal camera), `InteriorPuzzle` (gear train + ending).
6. Ending modal moves to after the interior sequence.

## Phases

1. Hollow body + hinged lid + interior camera (debug trigger to open). Done.
2. Act 1 rework: plinth, body, turret, lid; three rings with auto-judged
   dials and a "look here" camera. Done (first in yosegi style).
2b. Modern restyle: maze → NFC → knob → touch keys, walnut/aluminium/glass.
3. Interior gear train + gem + ending. (done)
4. Mechanism backs visible inside, blank faces, sound, polish.
