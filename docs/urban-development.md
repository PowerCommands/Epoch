# Village → Town → City

`UrbanDevelopment.ts` owns the founding blueprint and stage rules. `City.settlementStage`
records the highest achieved stage. Normal building completion and restoration advance
it through `CityManager` / `CityBuildings`; damage, removal and ownership transfer
never lower it. Human and AI cities use the same rules.

## Village → Town

The existing six spatial requirements are unchanged: Forge (0,-1), Aqueduct (1,-1),
Monument (1,0), Water Mill (0,1), Market (-1,1), Sewers (-1,0). Coordinates are axial
and relative to the center. Coast substitutes Dock, Lighthouse and Harbor in founding
order. Existing successor buildings retain their predecessor's development investment.
Mountain, Ocean or four or more water positions can prevent Town development under
the existing founding rules. The frozen `requirements` and `waterMask` remain authoritative.

These six positions use the existing automatic placement pipeline. Other buildings,
wonders and improvements cannot consume reserved positions. Completing all six
physically present buildings grants Town status and the existing +5 population-capacity
bonus. Damage before completion still counts as construction, preserving prior behavior.
Already damaged buildings remain repairable.

Once Town is achieved, the six assigned buildings (or successors already representing
them) are permanent. `CityBuildings.isProtected`, `remove` and `setBroken` enforce this
at the shared state boundary. Worker demolition and military/covert targeting reject
protected buildings before spending movement, logging incidents or requesting war.
Strategic blast damage respects the same state guard. Tile-clear cheats also reject
protected infrastructure. Upgrades that would replace a protected building are blocked;
for example, an assigned Harbor may become a Seaport before Town, and that Seaport
then becomes protected. Unassigned Harbor/Seaport infrastructure keeps normal rules.

Protection follows the city's frozen blueprint, not its current owner or a global list
of building IDs. Capturing or liberating the city preserves it. Removing an entire
settlement through the existing razing system still removes its record and releases
its territory; protection concerns infrastructure within a surviving settlement.

## Town → City

The six requirements are Railway Station OR Seaport, University, Bank, Factory,
Hospital and Opera House. Railway Station and Seaport share one transport slot;
building both still counts only once. The other five requirements have no alternatives. All use ordinary technology, production, upgrade, resource and placement rules.
Any normally valid tile in the settlement's territory works. There are no new reserved
tiles, directions or construction-order rules. Buildings completed before Town count.

Completing all six grants permanent City status. These six remain ordinary buildings:
they can be damaged, demolished, replaced and repaired without losing City status.
City adds no extra population-capacity or yield bonus; normal infrastructure modifiers
still apply. AI development candidates include missing, currently buildable requirements
through its existing production scoring and eligibility checks.

City View retains the spatial six-slot diagram for Village → Town. Town → City uses
six named filled/empty indicators, with accessible completion/damage descriptions and
missing technology information. A completed City explains that its status is permanent,
while the indicators continue to reflect the current infrastructure.

## Visuals

The former evolved City artwork is now the Town shell, unchanged. `UrbanCityVisual`
uses the same seven-tile footprint, waterfront geometry and reusable Canvas texture
pipeline for both stages. Texture keys include stage, map scale and water mask.

The City variant of `drawOrganicCity` adds taller masonry housing, brick courses,
larger civic buildings and factories, tall smoking chimneys, a foreground horizontal
railway and a covered station platform. The continuous land corridor is computed from
the same footprint used by the artwork, including coastal layouts. It is cached when
the visual attaches. No new city tiles or simulation entities are created.

Both stages retain batched street and waterfront activity. City reuses the Railway
Station's `drawSteamLocomotive` artwork and distance-driven wheels: six seconds arriving,
four seconds stopped, six seconds departing and eight seconds empty. Smoke follows
chimneys and train emission positions. The shell stays still. Ambient motion honors
map animation settings and reduced motion, and hidden/offscreen shells skip work.

## Saves and history

The current save format gains an optional per-city `settlementStage`; no version bump
is required. Existing saves without it infer Town/City from their restored building
entries and existing frozen blueprint. Slots and terrain are never regenerated during
load. New saves preserve City status even after requirements are removed.

Town keeps the legacy `city-developed` and `first:city` milestone keys to avoid replaying
old announcements. City has separate `city-evolved` and `first:industrial-city` keys.
Stage metadata drives new history and newspaper wording; old stage-less development
articles render as Town news. Each stage is announced once per settlement.

## Validation

- `npm run typecheck`
- `npm run test:evolution` (or Node's `--test-isolation=none` in restricted sandboxes)
- `EPOCH_URL=http://127.0.0.1:5174 node tools/urbanDevelopment.browser.mjs`
- `node tools/settlementProgress.browser.mjs`

The browser integration test completes actual production, checks both shell stages,
City View requirements, save/load, 42 coastal footprints, and batched animation. It
writes Town/City artwork and progression screenshots under `/tmp/epoch-*`.
Metropolis is not implemented.

## Persistent city damage

All four settlement stages use `City.isVisuallyDamaged`: health strictly below
51% of `CITY_BASE_HEALTH` (below 102 of 200 HP). At exactly 51% the healthy artwork
and normal activity return. The rule derives from live health, so melee, siege,
air strikes, strategic damage, capture, healing, cheats and restored saves use
the same appearance without saving a separate damage flag.

Village and the detailed city view use the existing era-specific broken sprites.
Town, City and Metropolis have separately cached damaged streetscapes, including
collapsed upper floors, missing roofs, blackened interiors and rubble. Damage
preserves the settlement's stage and founding coast layout. Roof locations from
the damaged artwork anchor persistent fire and smoke; normal traffic and
industrial activity pause while the city is damaged.

`CityDamageEffects` uses one graphics surface above the streetscape and badges,
with at most 32 visible cities and 7 fire sites per city (10 for Metropolis).
Hidden/offscreen sites do not draw. Reduced motion and disabled map animation
freeze the fires while retaining the damaged appearance. Repair, city removal
and scene shutdown remove the effects.

Air impact smoke and fire render above these city layers using
`WorldEffectDepths`. The affected city's badge is hidden shortly before impact
and restored when the effect ends. Overlapping attacks retain the suppression
until all their effects end; autorun, fog, refreshes and scene cleanup preserve
normal badge visibility rules. Interception and rebase do not hide badges.

Validation:

- `npm run test:city-damage`: threshold/repair behavior for all four stages plus
  deterministic damaged streetscapes and fire anchors for inland/coastal cities.
- `npm run test:city-damage:browser -- <vite-url>`: real CityRenderer and masked
  CityBannerRenderer in WebGL and Canvas; checks rendered explosion pixels,
  damaged/repaired artwork, flames, detail view, fog, motion settings, overlapping
  strikes and cleanup. Captures are in `/tmp/epoch-city-damage`.
- `npm run test:city-damage:game -- <vite-url>`: actual bomber map click, melee and
  artillery attacks, health notifications, turn healing and save/load.
