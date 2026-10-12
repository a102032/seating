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
| Guardians, the class's marker on the trail, map landmarks, the five chests (closed and open), the key | The teacher, in Google Flow (or Gemini), from the prompts here |
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

### What the first try taught (2026-10-12)

Gemini didn't manage the sheet; **Google Flow** made a three-view sheet of the dragon that kept it exactly the same
in every view, which is the skill the pose sheets need. Its face is right: friendly, big eyes, readable as a dragon
even at thumbnail size, on a clean white that cuts out in seconds. What was off:

- **Outlines and line detail** (a dark line round every shape, scale marks, belly stripes, wing ribs). Beside the
  app's flat chest it looked like a different game, and traced it came out with wobbly, broken lines in 315 shapes
  (about 350 KB, where the chest is 2 KB).
- **A realistic body**: a long neck and long legs, standing like a horse. A round, big-headed, short-legged dragon
  is cuter, reads bigger when small, and wobbles and sits down better.
- **All green**, which would vanish into the map's forests.
- The third view was the first one mirrored; the app can flip a picture, so one side view is enough.
- 1376x768: ask Flow for its biggest size.

### Prompt 2: the dragon again, flat (for Flow, with the first sheet attached)

```
Redraw this dragon as a cute flat vector mascot with NO outlines at all: every shape is a solid colour with one darker shade for its shadow side and one lighter shade for its highlight, light from the top left. No line work, no scale marks, no stripes drawn as lines, no texture, no gradients, no 3D. Keep its friendly face and big eyes. Make it round and chubby: a big head, a short round body, short stubby legs, a short curled tail and small wings. Teal body, pale yellow belly, golden horns and claws.

Show the same dragon twice, well apart, not touching: sitting proudly with its chest puffed out and chin up, seen from the front and a little to the side; and standing, seen from the front.

Plain, flat, pure white background. No ground, no shadows, no smoke, no words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```

### What the second try taught (2026-10-12)

**Flat worked**: no outlines, and beside the app's chest it looks like one game. Flattened to nine colours before
tracing, it came out in about 130 shapes and 95 KB, with clean edges. The sitting pose, chest out and chin up, is
right for a guardian. But **Flow kept the first dragon's long body and its green**, though the prompt asked for
chubby and teal: an attached picture pulls hard towards itself.

- **Colour is fixed here, not in Flow.** A traced picture can be recoloured exactly; a quick try made it teal with a
  pale yellow belly in one step (it also caught a wing and the snout, which a careful pass by part puts right).
- **Shape has to come from Flow.** To change a body, say plainly that only the body changes, and if Flow still
  copies it, try again with nothing attached.

### Prompt 3: the same dragon, chubby (for Flow, with the second sheet attached)

```
Keep exactly this flat style with no outlines, and keep this dragon's face. Change only its body: make it a chibi, plush-toy dragon with a big round head almost as big as its body, a short round tummy, short stubby legs, small wings and a short tail. Teal body, pale yellow belly, golden horns and claws.

Show it twice, well apart, not touching: sitting proudly with its chest puffed out and chin up, seen from the front and a little to the side; and standing, seen from the front.

Plain, flat, pure white background. No ground, no shadows, no smoke, no words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```

### The dragon's look, and its poses (2026-10-12)

The teacher kept the second dragon's body and made its poses in Flow: green, a yellow belly, orange spikes, golden
horns. The forests on the map are drawn in another green so it stands out. The poses, in the order of a term:

| Moment | Picture | Notes |
|---|---|---|
| Asleep by the Mega chest, most of the term (a suggestion) | lying down, eyes shut | came out with a green belly and yellow spikes; recoloured here to match |
| On guard, the term's last goal | sitting, holding the key up | the key is part of the picture while it holds it |
| On guard, at the chest | sitting, paw on a chest | Flow's chest is cut away and the app's chest goes under the paw |
| Hit by a star | the guard pose, moved in code | a wobble and a flash: no picture needed |
| Out of puff | sitting, panting, tongue out, pink cheeks, a sweat drop, smiling | the first came out sad; redone tired and happy, so the class never feels it made the dragon sad |
| Hands over the key | sitting, palm up | the key is its own piece on the palm, so it can fly to the chest |

Flow's chests (in the guard pose and the open one) are drawn with outlines and wood grain, unlike the app's flat
chest, so they are never used; the shared chests come from their own prompts, below.

### Prompt 4: out of puff (for Flow, with the palm-up picture attached)

```
The same dragon, same style, same colours. Now it is tired but happy: sitting down heavily, leaning back a little, panting with its tongue out, pink cheeks, a big friendly smile with its eyes half closed, one small sweat drop. Not sad, not hurt.

Plain, flat, pure white background. No ground, no shadows, no smoke, no words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```

### Prompt 5: the five chests, closed (for Flow, with `chest-style-reference.png` attached)

The chests have **no lock or keyhole**: the app draws the locks on them, one for each key the chest needs (1 to 5),
each turning gold as its key goes in.

```
Same flat style as this treasure chest: solid colours, each with one darker shade and one lighter shade, no outlines, no wood grain, no texture, no gradients. Draw five closed treasure chests in a row, facing the front, each a little bigger and grander than the one before: 1. a plain wooden chest; 2. a wooden chest with bronze corners and bands; 3. a silver chest; 4. a gold chest; 5. a big, grand gold chest with purple trim and a few gems. No locks and no keyholes on any of them.

Well apart, not touching. Plain, flat, pure white background. No ground, no shadows, no sparkles, no words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```

**Chosen** (2026-10-12): the flat set, `flow/chests-closed.jpg`. Flow also made one with thin dark outlines and
keyholes, which doesn't match the meter's chest. The flat ones trace to 18 to 70 shapes (10 to 70 KB each) once
the cut-out's pale edge is trimmed by two pixels. Flow drew all five the same size; the app sizes them, the Mega
chest biggest. A mock-up of Our Quest at the board's size, with the trail, locks, glow and shadows drawn in code,
showed them reading as one set.

The pictures kept from Flow are in `flow/`: the chests, and the dragon asleep, on guard at a chest, palm up and out
of puff. The one holding the key up is still to come as a file.

### Prompt 6: the five chests, open (for Flow, with `flow/chests-closed.jpg` attached)

```
The same five chests, same style, now open with no lid at all, full of treasure, more in each one: 1. a few gold coins; 2. gold coins and one big gem; 3. gold coins with a string of pearls hanging over the edge; 4. gold coins, gems and a gold cup; 5. overflowing with gold coins and gems, some spilling onto the floor, a crown on top.

Well apart, not touching. Plain, flat, pure white background. No shadows, no sparkles, no words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```

### The Treasure Quest Preview as the base (2026-10-12, recommended, waiting on the teacher)

The teacher pointed back to the Treasure Quest Preview (a Claude artifact, 2026-10-07): "I liked it a lot". Its
chests (closed and open, each rank richer, with a lock plate on the front whose keyholes fill gold as the keys go
in), key, wheels, prize card, meter and Our Quest map are all drawn in code (`chestSVG`, `keySVG`, `wheelSVG`,
`treasure`), so they are sharp on a 4K board, tiny, and move in parts. Put into the preview itself, the Flow dragon
sat beside its chests and on its map as one set. So the plan recommended back: **build from the preview**, and Flow
makes only what code draws badly. The Flow chests (above) and prompt 6 are then not needed.

What changes from the preview to match the agreed plan (DECISIONS, "The plan, agreed"): the key waits for a tap
rather than a two-second banner; a chest with all its keys opens on a tap; the odds are the agreed table; the wheel's
small prizes keep the preview's bright slices, medium are silver and big gold; the guardian comes in at the Mega chest.
The map's doodles stay faint ink, so the coloured things on it are the chests, the dragon and the knight.

**Knight and Dragon's art is complete** (2026-10-12): the knight (`flow/knight.webp`) and the landmarks
(`flow/landmarks.jpg`) came out right first time. In the preview's Our Quest at the board's size, the landmarks were
made see-through from their ink (the darker the line, the more solid), tinted the map's ink (#8a5a2b) at 55%, and
placed where the zigzag leaves room: the castle over the first chest, the forest under the second, the hills over
the third, the bridge under the fourth and the mountain with its cave just behind the Mega chest, so the chest sits
at the cave's mouth. The knight stands on the trail beside the chest the class is on, about 1.25 times its height;
the dragon sleeps by the Mega chest. The windmill and signpost are spares for wider screens.

### Prompt 7: the knight on the trail (for Flow, with the dragon on guard attached)

The class's marker, walking the trail from chest to chest. The visor is down so it could be anyone in the class.

```
Same flat style as this dragon: solid colours, each with one darker shade and one lighter shade, light from the top left. An original, friendly little knight riding a small round pony, walking to the right, seen from the side. Chunky and cute: a big round helmet with the visor down and a red plume, a small round shield, a short lance with a pennant flag.

Plain, flat, pure white background. No ground, no shadows, no words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```

### Prompt 8: the map's landmarks, as ink doodles (for Flow, nothing attached)

Traced, tinted to the map's ink and faded, like the preview's compass and hills.

```
Doodles for an old hand-drawn treasure map, in one colour only: dark brown ink lines on white, like a map in a storybook. No colour fill, no shading, no texture: simple, clean lines of an even thickness. Draw these seven, well apart, not touching: a castle with two towers and flags; a forest of three round trees; rolling hills; a little stone bridge over a stream; a windmill; a signpost; a rocky mountain with a cave at its foot.

Plain, flat, pure white background. No words, no frame, no checkerboard. Wide picture, 16:9, the biggest size available.
```
