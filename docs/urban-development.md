# Village → City

`UrbanDevelopment.ts` defines the six permanent slots in the pointy-top axial
hex grid: Forge (0,-1), Aqueduct (1,-1), Monument (1,0), Water Mill (0,1),
Market (-1,1), Sewers (-1,0). Coordinates are relative to the settlement.

New settlements require a complete, non-overlapping seven-hex cluster. The six
outer tiles store `urbanSlot: { cityId, buildingId }` and belong to the normal
initial territory. Other buildings, wonders and worker improvements cannot use
these reserved positions. Terrain and resources stay intact, including coast. A Mountain in any surrounding position, or at least four
water positions, prevents City development permanently. These settlements have
no reserved urban slots; buildings, improvements and wonders use their normal
placement rules throughout their territory. Ordinary buildings still use existing placement
on unreserved territory, including later territorial expansion.

The six required buildings use normal production and completion effects, but
resolve their destination automatically. Human City View and sidebar requests
skip the placement cursor; AI uses the same placement resolver. AI adds modest candidates for its actual geography-specific requirements.
Dock also has independent naval value; impossible island Cities receive no
completion-specific candidates. Existing production priorities remain in place.

`getSettlementStage` derives Village/City from physical building entries. All six
must exist; damage does not undo construction. Existing successor buildings
count for their predecessors, so upgrading Harbor to Seaport retains City
status while preserving normal replacement/effect rules. Demolishing a required
building returns the settlement to Village until rebuilt. Ownership changes do
not alter the slots' city identity.

`UrbanCityVisual` bakes one reusable texture per map scale and water mask. Exact hex outlines
form the seven-tile footprint; connected streets, housing, a guild workshop,
water arcade, civic hall, bell tower and market compose one environment. The
world renderer absorbs individual slot sprites and fades in the City on the
sixth completion. Streets render below units. City View switches to individual
structures for inspection and identifies the derived settlement stage.

One scene update listener draws twelve deterministic street walkers and two
smoke plumes per visible City in a single Graphics object. Offscreen and hidden
cities skip animation work. Destroying a container unregisters its effects.
There is no NPC simulation and no later development stage.

Save format 7 stores explicit `{ buildingId, broken }` records, tile urban
reservations and the founding layout (`requirements[6]`, `waterMask`). Loading restores those records directly and derives the visual
stage; it does not generate or infer slots. Earlier save versions are rejected.
The former renewable and airfield save migration paths have been removed.

Verification:

- `node --import tsx tools/urbanDevelopment.test.ts`
- Run Vite on port 5179, then `node tools/urbanDevelopment.browser.mjs`.
  The browser test starts a new game, founds a settlement, uses the human City
  View callback and actual production completion, inspects individual and
  integrated rendering, saves/reloads partial and complete development, and
  measures 32-city ambient CPU update cost. It writes review images and new
  saves under `/tmp/epoch-urban-*`. The benchmark measures ambient updates,
  not total large-map frame time.

Coastal development freezes geography at founding. In canonical clockwise order,
Coast positions replace their land requirements with Dock, Lighthouse and Harbor.
Four or more water positions permanently prevent City completion; all six
requirements become null and none of the positions are reserved. Deep Ocean cannot receive a
Dock and has no development substitute. Replaced land buildings can still be
built normally on unreserved territory. Harbor upgrades continue to count as
Harbor development, independently of Dock.

Dock is an Ancient building unlocked by Sailing (60 production, 1 maintenance),
restricted to owned Coast. `NavalProduction.ts` locates an active, physically
present Dock per city. Production rules, queues and completion all use this
requirement. Damaging a Dock pauses naval production until repair. Completed
ships use the Dock tile first, then the nearest tile accepted by the existing
spawn validator, with axial distance followed by row/column tie-breaking.

The original transparent Dock sprite is generated with
`npx tsx scripts/generateDockSprite.ts` from `DockArtwork.ts`. Village waterfront
buildings receive a shore connection. Completed City textures clip urban ground
and housing to land and connect wooden piers, boats, a lighthouse and harbor
works to the waterfront. Ambient walkers and smoke skip water.

Coastal verification: `node --import tsx --test tools/coastalUrbanDevelopment.test.ts`
covers all 64 Coast arrangements for human and AI, standalone Dock placement,
naval gates and deterministic spawning, upgrades and new-format save/load.
`COAST_MASK=7 node tools/urbanDevelopment.browser.mjs` exercises three Coast
positions through real production, naval spawning, City View and application
save/load. Masks 0, 1 and 3 exercise inland, one-Coast and two-Coast settlements.

The blueprint is local to each settlement, including placement behavior.
For Coast at positions 2 and 5, the exact requirements are Forge, Dock,
Monument, Water Mill, Lighthouse, Sewers. Dock must occupy position 2 and
Lighthouse position 5 automatically. An unavailable assigned slot blocks
construction; it never redirects the building to another water tile.
Aqueduct and Market remain ordinary buildings with their normal effects and
placement elsewhere in that city's territory. Maritime buildings absent from
its blueprint likewise retain normal placement. These rules are covered by
explicit inland, one-, two- and three-Coast placement regression tests.

Completed waterfront composition is shared through `UrbanWaterfront.ts`.
It draws continuous quays along shared land/water hex edges and uses the actual
projected slot directions for street-to-pier connections. Dock provides a small
working pier, Lighthouse a narrow approach and beacon, and Harbor wider commercial
quays, warehouses, moored vessels and a timber crane. Water is transparent beneath
these structures; the renderer never changes terrain or other map state.
Two lightweight pier workers per sector, lighthouse glow and vessel ripples use
the existing per-City Graphics batch and offscreen culling. The browser test checks
all 42 valid 0–3-water permutations for open-water transparency and no map-state
mutation, and exports six representative views to `/tmp/epoch-coastal-city-variants.png`.

City status contributes an additive +5 population capacity through the same
`PowerPlantSystem.getCityPopulationCapacity` provider used by growth, UI and AI.
It stacks with all existing building, renewable and power-plant bonuses, without
adding population or storing a repeatedly awarded bonus. A Village with capacity
8 becomes 13; capacity 10 becomes 15. Save/load and capture recompute the same
bonus from the saved blueprint and completed buildings. Workshop is an ordinary
building everywhere and has no role in City completion.

On the first Village→City completion for each settlement, the shared building
completion path records a `cityDeveloped` History event through
`WorldHistoryMilestones`. It becomes a normal newspaper candidate (priority 60).
The world's first City instead receives priority 100 and a special headline.
Existing milestone save state and History metadata retain both the global first
and per-city identity, preventing duplicate news after reload, capture or rebuild.
Scenario Cities seed those facts without inventing historical announcements.

Completed City artwork is composed in `OrganicCityArtwork.ts` across the whole
footprint: two crooked main streets, branching lanes, closely packed timber and
plaster buildings, an offset market court, civic hall, chapel and workshops.
Building footprints and orientations are independent of urban slots; roofs are
depth sorted and can cross internal tile boundaries. Ground follows an uneven
urban envelope clipped to land, with occasional peripheral trees. The completed
City omits the old central hex fortification overlay; no defensive buildings are
invented, and fortification gameplay and Village visuals remain unchanged.

`UrbanCityVisual.ts` caches the canvas per size/coast mask and animates walkers
on the artwork's actual street polylines, fountain jets and ripples, and smoke
only from rendered workshop and residential chimneys. Three decorative horse
and wagon teams follow the main streets at a steady pace, with moving legs and
wheels; the full team is checked against land before drawing near a coast.
The urban ground uses a muted green palette; the stone market square retains
its lighter paving, with the fountain placed farther up inside the square. Waterfront approaches bend into offset piers, with
workers and harbor effects using the same coordinates. This changes only the
completed City's presentation, not its blueprint, progression or save state.
