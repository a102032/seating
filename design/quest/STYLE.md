# The Quest's art: style guide

How every picture in the Quest is made, so that the pieces from many separate Gemini prompts look like one game.
The plan itself (keys, chests, wheel, odds, guardian) is in DECISIONS.md, "Treasure Quest".

## The look

- **Flat, like the app's own Flaticon art** (the rail icons, the avatars, the taiko drum, the meter's chest): solid
  colour shapes, each colour with one darker shade on its shadow side and one lighter shade for a highlight. No
  outlines, no gradients, no texture, no 3D, no glow. This is also what traces cleanly to SVG, which stays sharp on a
  4K board and loads quickly.
- **Light from the top left**, always.
- **Rounded, chunky, friendly shapes** that read from the back of the room. Test: shrunk to a thumbnail, a piece
  still reads as what it is.
- **Original characters only.** Nothing that looks like a famous dragon, robot or pirate.
- **Shadows, glows, sparkles and paper texture are added in code**, never painted into a picture, so every piece
  sits on the map the same way.
- **Anything that moves is made in parts**: the guardian's head, body and the arm holding the key; the key on its own.
  The board moves them with CSS (the "Smooth on the board" rule).
- **Words are never in a picture.** They are Andika, on a ribbon drawn in code.

## Each adventure is a map of its world

The map is a parchment drawn in code (the splash screen's chalk dust is the same trick), with the landmarks as
separate pictures that the app places along its edges and corners, the way the splash places its doodles. The
middle stays open for the trail and the five chests, also drawn by the app. A map in one piece couldn't fit every
screen shape from 1024x500 to 1920x1080; separate pieces can.

## Who makes what

| What | Made by |
|---|---|
| Guardians, the class's marker on the trail, map landmarks, the five chests (closed and open), the key | The teacher, in Gemini, from the prompts here |
| Prize pictures on the wheel (crayons, a book, a film, balloons...) | Flaticon, the app's own style |
| Parchment, trail, wheel, ribbons, shadows, glows, sparkles | Code |
| Cutting pictures out, tracing them to SVG, splitting them into moving parts | Claude, here |

## Making a picture in Gemini

- **Always ask for a plain, flat, pure white background**, never "transparent". Gemini can't make see-through
  pictures, and asked to, it paints a grey-and-white checkerboard into the picture. A piece that is mostly white
  goes on bright green instead.
- **No ground, no shadow, no scenery** behind a piece.
- **Once a style test is approved, attach it to every later prompt** with "Same style as this picture."
- **A character's poses go in one picture together** (a pose sheet), so they match. They are cut apart here.
- **Make three or four of each** and keep the favourites.
- **Save with Gemini's download button**, not a screenshot: the download is full size.

## Getting the pictures here

Show the favourites in the chat first. Then upload the full-size files to GitHub: open the repo, go into the
`design` folder, choose **Add file → Upload files**, drop them in and press **Commit changes**. That goes on main
and runs the deploy, which rebuilds the same app; nothing in the app changes.

## Before a piece goes in

- It follows every line of "The look".
- It reads at thumbnail size.
- It cuts out cleanly from the white, with nothing touching the edge of the picture.
- It traces to SVG without losing what matters (a face, the key's teeth). If tracing hurts it, it stays a PNG.

## The pieces

**Shared by every adventure**: the five chests closed and open (Wood, Bronze, Silver, Gold, Mega; an open chest has
no lid, and each rank holds more treasure: coins, a gem, pearls, a goblet, and the Mega chest overflowing with a
crown on top), and the key. The meter's chest today (`public/treasure/chest-closed.svg`) is the colour reference
for wood and gold.

**Each adventure**: its landmarks (five to eight), its guardian (one pose sheet: standing guard, hit, out of puff,
handing over the key, friend) and the class's marker on the trail.

## Knight and Dragon (the first adventure)

- **The guardian**: a round, chubby teal dragon with a pale yellow belly, small wings, two little horns, big kind
  eyes and a puff of smoke from its nose. Proud and a little grumpy, never scary. Teal so it stands out on the
  parchment and the green forests.
- **The class's marker**: a small knight on a pony, or a knight's banner (chosen after the style test).
- **Landmarks**: a storybook castle, round trees, hills, a bridge, a windmill, a signpost, and the dragon's
  mountain cave at the end of the trail.
- **Colours** (for checking, Gemini only roughly follows them): parchment `#F3E3C3`, ink `#6B4A2B`, forest
  `#5E9E4A` and `#3F7A3A`, castle stone `#A9B4C2`, roofs `#C8553D`, dragon `#2BA59B` with belly `#F6D77A`, chest wood
  `#9B6649`, gold `#FFC83C` and `#E6A22D` (the meter's chest).

### Prompt 1: the style test

One picture with a piece of each kind (character, object, landmark), to settle the look before anything else.
Once it is approved, it is attached to every prompt after it.

```
Create a sheet of game art for a children's classroom app. Flat vector illustration style, like premium flat icons: solid colour shapes, each colour with one darker shade for its shadow side and one lighter shade for its highlight, light coming from the top left. No outlines, no gradients, no textures, no 3D, no glow. Rounded, chunky, friendly shapes that read clearly from far away.

Draw these five things spread out across the sheet, well apart, none touching or overlapping:
- An original, friendly dragon guardian, sitting, seen from the front and a little to the side. Round and chubby, teal with a pale yellow belly, small wings, two little horns, big kind eyes, a small puff of smoke from its nose. Proud and a little grumpy, but not scary. Not like any famous cartoon dragon.
- A small closed wooden treasure chest with golden corners and a golden lock.
- A big golden key with a round handle.
- A small storybook castle with two towers and little flags.
- A clump of three round trees.

Plain, flat, pure white background. No ground, no shadows under them, no scenery behind them, no words, no labels, no numbers, no frame, no checkerboard. Wide picture, 16:9.
```

The prompts after it (the dragon's pose sheet, the chests, the landmarks, the marker) are written once the style
test is chosen.
