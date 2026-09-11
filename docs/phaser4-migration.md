# Phaser 4 migration

Epoch now pins Phaser **4.2.1** in both package files, replacing the previously locked **3.90.0**. TypeScript strict mode, Vite, the scene architecture, simulation systems, and save format remain in place.

## Rendering decisions

### Geometry clipping

Phaser 4's WebGL renderer does not use the Phaser 3 GeometryMask rendering path. `src/systems/rendering/GeometryClip.ts` centralizes the replacement for the 13 mask-owning components: world hex masks, unit/city banners, portraits, HUD panels, the sidebar, and dialogs.

The adapter uses public `RenderSteps`, `Stencil`, and `StencilReference` APIs. It brackets each target draw with stencil geometry and its matching restoration step. It preserves the existing display list, depth order, Container ownership, and independent mask coordinates. The source uses the current camera; it deliberately does not inherit the clipped object's parent transform. Hidden source Graphics still clip their targets.

A shared clip has explicit attach/detach/destroy behavior. Destroying a target releases that binding; destroying the source detaches all targets. The original owner retains ownership of the source Graphics. An inert render hook remains on detached objects until those objects are garbage collected; repeated attachment does not add more hooks. No Phaser prototypes, private render-step arrays, raw WebGL state, or custom shaders are patched.

Supported sources are the opaque, non-overlapping filled shapes Epoch actually uses: rectangles, circles, ellipses, and hex polygons. This is not a general replacement for alpha masks, arbitrary overlapping Graphics, or filter composition. Such new use cases should explicitly choose and test the appropriate Phaser 4 feature.

**Why not a Mask filter per object?** A prototype with 200 clipped Images produced 200 filter cameras with the filter approach and zero with the stencil adapter. CPU render-submission medians were 3.7 ms and 4.1 ms respectively (p95 5.9/6.1 ms) in one local headless sample. That does not establish a speed advantage for stencil. The decision avoids per-object offscreen filter surfaces while preserving existing camera/ownership behavior. GPU memory and representative hardware frame times matter more than that small CPU difference.

**Canvas:** Phaser still provides native GeometryMask for Canvas. The adapter scopes it around each target's instance renderer because ContainerCanvasRenderer bypasses the ordinary mask path for child Shapes/Graphics. Simply setting `GameObject.mask` is insufficient for those children. The wrapper handles both top-level objects and Container children without applying the mask twice.

### Baked terrain

`TerrainBaker` retains its existing chunked RenderTexture architecture. Phaser 4 queues texture draws, so the bake now calls `.render()` before destroying its temporary Graphics. Integer chunk extents round up, and the RenderTexture constructor disables automatic even-dimension expansion to preserve chunk positioning at odd-sized edges.

A WebGL context restoration listener rebuilds live chunk contents from their drawing recipe. Original bake offsets are retained separately because river rendering subsequently moves its chunks. Destroying the last chunk removes the listener. A full-world Graphics command buffer is not retained between restorations.

This migration does not reduce the existing memory cost of full-world texture layers or introduce viewport streaming. GPU sprite layers, atlas changes, and terrain chunk residency remain separate optimizations that should be driven by profiling.

### Renderer selection

Phaser 4 requires WebGL instancing and vertex-array extensions (`ANGLE_instanced_arrays`, `OES_vertex_array_object`). Before boot, Epoch probes a disposable WebGL context for those extensions and a stencil buffer. It explicitly selects Canvas if the probe fails. Phaser's AUTO presence check alone does not reliably cover missing required extensions. The probe context is released after inspection.

Canvas preserves compatibility, but is not a performance equivalent to WebGL on large maps. No Steam runtime, GPU drivers, or browser minimum versions were changed by this repository migration.

## Other changes

- City outline points now use `Phaser.Math.Vector2` to match the updated Graphics typing.
- Two pre-existing wheel handlers in DependencyTreeDialog and DiscoveryPopup accessed a sixth scene-wheel argument that neither Phaser version emits. They now use the existing `consumePointerEvent(pointer)` path and the actual five-argument event contract.
- The structure browser fixture locates its city Image by type rather than assuming it is the first Container child. The original first-child assertion also failed on Phaser 3 because damage/threat Graphics precede the Image.
- The audience browser harness accepts `EPOCH_URL` instead of a hard-coded unrelated development port.

## Validation and reproduction

Start Vite on the test port, then run:

```sh
npm run dev -- --host 127.0.0.1 --port 5174
npm run typecheck
npm run test:phaser-migration
npm run test:phaser-migration:game
node --import tsx --test tools/rendererSupport.test.ts
EPOCH_BASE_URL=http://127.0.0.1:5174 node tools/sidebarPanels.browser.mjs
node tools/audienceCategories.browser.mjs
node tools/structureVisuals.browser.mjs
node tools/improvementVisuals.browser.mjs
node tools/airBaseRenderer.browser.mjs http://127.0.0.1:5174
node tools/airOperations.browser.mjs http://127.0.0.1:5174
npm run build
```

The new browser harnesses accept `EPOCH_URL`, `CHROME_PATH`, and `EPOCH_TEST_OUTPUT`. The game harness requires a populated save: it defaults to `autorun-output/latest-save.json`, with `EPOCH_SAVE` to override. The renderer harness also accepts `EPOCH_BROWSER=firefox|webkit`, `EPOCH_RENDERER=canvas|webgl`, and `EPOCH_BENCHMARK=1`. Install corresponding Playwright browser runtimes separately if using them. Screenshots and logs from this migration were written under `/tmp/epoch-phaser-migration`, not committed as game assets.

Validation performed:

- Strict TypeScript compilation and complete production build, including manifest prerequisites.
- The final production bundle boots, loads assets, and restores the populated save with matching unit/city counts and no page errors. The build retains Vite's large-chunk warning (about 4.45 MB uncompressed / 1.11 MB gzip for the main bundle).
- Chromium pixel assertions for WebGL and Canvas: independent/moved/shared clips, transparent Container children, multiple cameras, sibling isolation, source/target destruction, repeated attach/detach, exact terrain edge dimensions, and listener cleanup. Forced WebGL context loss/restoration verifies baked pixels and clipping recover.
- Firefox Canvas passes the same applicable pixel assertions. Firefox WebGL could not start on this host (`FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`); WebKit could not launch because required host libraries are absent. These are unverified platform paths, not passing cross-browser claims. Real Safari and the eventual Steam runtime still need hardware/runtime testing.
- Existing browser suites cover sidebar modes/tabs/resize/input, audience navigation and gossip, structure construction/damage/async loading/cleanup, improvement rendering/editor/save round-trips, air-base rendering, and aircraft animations/save-load/rebase/turn progression.
- Broad existing Node suite: **2,345 tests; 2,311 pass, 34 fail**. An isolated checkout using the original Phaser 3 package produced the **same 34 failing test names**. These include existing fixture/content/balance expectations; the broad suite is not entirely green. The new capability test passes separately.

The saved-game browser harness passes in Chromium WebGL and Canvas. It exercises policy, technology, culture, and discovery panels, scrolling without zooming the world behind a modal, viewport resize, Canvas fallback triggered by a missing instancing extension, and a same-scene save reload. Units, cities, turn state, and human identity remain equal through UI interaction and reload. Camera counts stay at seven; restoration listener counts remain three in WebGL and zero in Canvas after restart.

The same populated save and initial HUD panels were captured on an isolated original Phaser 3 checkout for comparison. Layout, clipping boundaries, artwork, and displayed game state match in inspected images, with small renderer rasterization differences. The pre-existing History overlay's overlap with some modals also appears on the original engine.

Render timing samples measure CPU submission around Phaser render events; they are not GPU timings or representative hardware FPS claims. An isolated alternating-order comparison (3, 4, 4, 3) loaded the same round-101 save at 1440×900, with 744 scene objects and identical camera zoom. Each run discarded ten render samples and measured the next fifty:

| Engine | Median render submission | p95 render submission |
| --- | --- | --- |
| Phaser 3.90.0, first run | 29.2 ms | 33.2 ms |
| Phaser 4.2.1, first run | 15.4 ms | 19.7 ms |
| Phaser 4.2.1, second run | 15.4 ms | 19.1 ms |
| Phaser 3.90.0, second run | 35.8 ms | 52.8 ms |

Chromium used ANGLE/SwiftShader software rendering. The results favor Phaser 4 for this workload, but neither the absolute numbers nor the apparent improvement should be extrapolated to hardware GPU FPS, larger maps, or simulation/AI time. The slower second Phaser 3 run also illustrates measurement variability.

Reproduce with `node tools/phaserBenchmark.browser.mjs`. It samples the current server twice. Set `EPOCH_BASELINE_URL` to a separately served original checkout to alternate engines in the order above. It also accepts `EPOCH_URL`, `EPOCH_SAVE`, and `CHROME_PATH`. Use an isolated dependency installation for the baseline and keep other browser tests closed while benchmarking.

## Further optimization

The baseline migration intentionally keeps ordinary Phaser objects and the existing game simulation. Phaser 4-specific batching or SpriteGPULayer work can now be evaluated independently, starting with dense noninteractive repeated world imagery. Profile CPU submission, GPU time, texture residency, and object update costs separately. AI, diplomacy, pathfinding, turn processing, and save serialization are not accelerated merely by changing Phaser versions.
