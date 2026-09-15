# Surveyors and Territorial Claims

Early Empire unlocks the civilian Surveyor. Balance values live in
`src/data/territorialClaims.ts`: 100 Production, 200 Gold per claim, and at most
10 hexes from an owned city center. A successful action consumes the unit.

`Tile.territorialClaimNationId` is independent of `Tile.ownerId`. Economic
systems continue to use ordinary ownership and city tile assignments. Movement,
pathfinding, founding, and peaceful troop withdrawal use political ownership.
Claims are translucent, lightened primary-color fills; only ordinary ownership
contributes territorial border segments.

The existing city acquisition path removes claims upon actual acquisition.
A map-scoped callback connects absorption to DiplomaticMemorySystem and the
historical timeline. The existing diplomatic memory model stores bilateral
relations; this incident uses that model and its normal 0–100 clamping.
Foreign purchase confirmation checks its target, owner, price, funds, and turn
again before applying the purchase. Organic expansion needs no confirmation.

Territorial Claims are a human-player strategic tool. AI never selects Surveyor
production or uses the claim action. Shared production/purchase validation also
blocks AI-owned Surveyor queues, including inherited or loaded queues. Existing
AI-owned Surveyors are preserved but cannot establish claims. AI still respects
human claims for movement and founding, and can absorb them through normal city
expansion or tile purchase, triggering the existing incident.

## Validation

- `npm run test:territorial-claims`
- `node tools/territorialClaims.browser.mjs` against Vite; set `EPOCH_URL` and
  `CHROME_PATH` if necessary. Starts a fresh Maritime Expansion game (or loads `EPOCH_SAVE`)
  and writes a screenshot to `/tmp/epoch-territorial-claim.png`.
- `npm run build`

The browser test also runs two autorun rounds and verifies that AI does not consume a
Surveyor or create claims. The focused suite contains 14 passing tests.
The broader `multilateralAggressionMemory.test.ts` suite has one pre-existing
failure (`event deltas are unchanged by the decay recalibration`): its expected
capital-capture values differ from the current balance data. The same failure
was reproduced on unmodified HEAD.

## Art provenance

Asset: `public/assets/sprites/units/surveyor.png` (256 × 256, transparent PNG).
Generated using the built-in imagegen tool, then resized for the existing unit
asset pipeline. Final prompt:

> Use case: stylized-concept. Asset type: Epoch historical strategy game unit sprite. Generate one ancient-era civilian Surveyor, full-body isolated on genuine transparent background. Match existing Epoch style: softly painted realistic game miniature viewed slightly from above, warm muted brown leather and cream linen clothing, sturdy boots, no modern equipment. A distinctive surveyor holding a tall wooden measuring rod and a rolled parchment map at his belt. Single centered standing person, three-quarter view, all extremities visible with padding, clear silhouette legible at 64 pixels, square image. No writing, flags, circular base, border, scenery or watermark. Project output will be public/assets/sprites/units/surveyor.png.

## Scenario Editor

Use **Paint Territorial Claims**, directly below **Paint coastline**. The nation
selector uses the scenario's nation list and keeps the current owner visible.
Drag to paint with the existing brush size; choose **None — erase claims** to
remove claims. Select a nation again to resume painting. Ctrl+Z / Ctrl+Shift+Z
(or the Undo/Redo buttons) reverse each complete brush stroke.

Editor painting authors `map.tiles[].territorialClaimNationId` directly. No
Surveyor, Gold, culture unlock, or city proximity is required. City-owned tiles,
water, ice, and existing structures are excluded. City territory takes precedence
when importing or authoring overlapping data. Ordinary scenario and runtime
save/load preserve claims; old scenarios simply omit the optional field.

The preview calls the shared runtime tint helper and draws a fill without a
territorial outline. Startup preserves claims through initial nation-area
seeding, filters inactive nations, and resolves actual city ownership before
play. All subsequent movement, founding, economics, absorption, and diplomatic
incidents use the existing game systems, including claims authored for AI nations.

Validation: `npm run test:editor-claims` and
`EPOCH_URL=http://127.0.0.1:5173 node tools/editorTerritorialClaims.browser.mjs`.
The browser test writes `/tmp/epoch-editor-territorial-claims.png`.
