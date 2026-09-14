# Container Port

Container Port extends **Harbor → Seaport → Container Port**. Combustion unlocks it in the Industrial era. It costs **400 production** with **3 Gold maintenance**, chosen to match nearby Industrial infrastructure.

Its total modifiers are +2 Production per turn, +2 Gold per turn, +10% Production, +2 Happiness and +5 Trade Capacity. The existing upgrade completion replaces Seaport on its tile and removes earlier levels. Construction requires a city-local Seaport, follows existing permanent Town infrastructure restrictions, and prevents rebuilding older levels. Dock remains independent.

The canonical building registry supplies production, research, AI, map and City View assets, editor catalogues, economy and save restoration. No save schema changes are needed. Existing Seaports remain Seaports; queued Container Ports, finished ports and damaged ports restore normally. Corporation requirements/output and City View/AI development requirements accept upgrade descendants, so the replacement retains Seaport and Harbor infrastructure credit while counting each city once. Damaged ports provide no yields or corporation output.

The sprites were generated with the **built-in imagegen tool**, then mechanically exported to 512×512 PNGs preserving their alpha:

- `public/assets/sprites/buildings/container_port.png`
- `public/assets/sprites/buildings/container_port-broken.png`

The renderer adds two trolley/spreader/cable assemblies aligned with the painted crane booms. Each hoists, traverses, lowers, releases its load on the ship, and returns empty on an 18-second loop. The cranes have independent phases. Two freight trucks arrive, pause and depart in separate terminal lanes on a 20-second loop. Narrow wavelets follow the outer hull. Small solid isometric shapes match the sprite's container colors and remain visible at gameplay size. Structure, ship and static container stacks stay rigid.

This activity uses the existing `AmbientSprites` Graphics layers and clock, including WebGL/Canvas rendering, fog/offscreen culling, damage, reduced motion, overview zoom, pause and scene shutdown. It adds no saved data or simulation timers.

Validation:

- `npm run test:container-port`: replacement, technology, production, AI, yields, trade, damage, corporations, development, real save serialization/restoration and motion choreography.
- Existing coastal development, settlement progress, three-stage evolution, corporation production and building activity regressions.
- `npm run typecheck` and `node_modules/.bin/vite build`.
- With Vite at localhost:5174, `npm run test:container-port:browser`; repeat with `EPOCH_CANVAS=1 EPOCH_TEST_OUTPUT=/tmp/epoch-container-port-canvas`. Captures actual TileBuildingRenderer sprites, detailed motion phases and the real City View. Checks visible pixel changes at gameplay size and at 40px, operation gating, unchanged map state, clock progression and cleanup.
- The broader ambient inventory has a pre-existing missing `dock` profile in `AmbientProfiles.ts`; Container Port has an explicit profile and artwork audit entry.

## Final generation prompts

Normal sprite:

```text
Use case: stylized-concept
Asset type: transparent square building sprite for an isometric civilization strategy game, 1024x1024.
Primary request: Container Port, a modern industrial container terminal, clearly distinct from a small historical harbor.
Style: clean detailed low-poly isometric game illustration, faceted solid geometry, crisp cream bevel highlights, dark blue-gray shaded sides, muted sand concrete, teal water, restrained mustard-yellow cranes, rust red / navy / teal shipping containers. Orthographic 3/4 overhead view matching classic strategy building sprites. Light from upper left. No outlines.
Composition: one compact diamond-shaped concrete dock and water diorama centered with generous transparent margin, all artwork within x=0.08..0.92 y=0.06..0.94. Two large tall yellow ship-to-shore gantry cranes tower over the quay. Yard and stacked rectangular shipping containers at upper left/back. Large dark-blue container ship along the lower-right/front quay, bow pointing lower right; visible white bridge and many stacked red and blue containers on deck. Broad open concrete terminal road along the left-front side connecting the yard to the edge, kept clear for animated trucks.
Animation-ready cranes: rigid yellow gantry supports and horizontal/slanted isometric overhead booms only, NO hanging cables, hooks, spreaders or suspended containers painted in (the game will animate those). Both booms extend from the yard toward the ship. Clearly exposed open spaces beneath crane booms for animated cable and loads. Place ship and dock to make crane movements easy to read at 100px sprite size.
Include docks, mooring bollards, container stacks and subtle painted water at the hull. Building occupies most of image, no distant scenery or people. Genuinely transparent background, preserve alpha, no labels, logos, text or watermark.
```

Damaged sprite:

```text
Use case: stylized-concept
Asset type: transparent square building sprite for an isometric civilization strategy game, 1024x1024.
Primary request: Container Port, a modern industrial container terminal, clearly distinct from a small historical harbor.
Style: clean detailed low-poly isometric game illustration, faceted solid geometry, crisp cream bevel highlights, dark blue-gray shaded sides, muted sand concrete, teal water, restrained mustard-yellow cranes, rust red / navy / teal shipping containers. Orthographic 3/4 overhead view matching classic strategy building sprites. Light from upper left. No outlines.
Composition: one compact diamond-shaped concrete dock and water diorama centered with generous transparent margin, all artwork within x=0.08..0.92 y=0.06..0.94. Two large tall yellow ship-to-shore gantry cranes tower over the quay. Yard and stacked rectangular shipping containers at upper left/back. Large dark-blue container ship along the lower-right/front quay, bow pointing lower right; visible white bridge and many stacked red and blue containers on deck. Broad open concrete terminal road along the left-front side connecting the yard to the edge, kept clear for animated trucks.
Animation-ready cranes: rigid yellow gantry supports and horizontal/slanted isometric overhead booms only, NO hanging cables, hooks, spreaders or suspended containers painted in (the game will animate those). Both booms extend from the yard toward the ship. Clearly exposed open spaces beneath crane booms for animated cable and loads. Place ship and dock to make crane movements easy to read at 100px sprite size.
Include docks, mooring bollards, container stacks and subtle painted water at the hull. Building occupies most of image, no distant scenery or people. Genuinely transparent background, preserve alpha, no labels, logos, text or watermark.
DAMAGE STATE: This is the damaged, non-operational variant. Depict bent/buckled yellow crane booms, dark soot on supports, cracked concrete and a few crushed stacks and dock rubble. The large ship remains moored but darkened. No lights, people, fires, smoke, hooks, suspended loads or vehicles. The backdrop must be empty transparent alpha. This is a cutout sprite, absolutely no white background and no gray checkerboard pattern.
```
