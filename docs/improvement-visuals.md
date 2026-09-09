# Improvement artwork

All completed improvement artwork is resolved through `ALL_IMPROVEMENTS` and `spriteKey`. BootScene loads `public/assets/sprites/improvements/{id}.png`. Add a definition and its transparent PNG to extend coverage. Maintenance/cleanup jobs intentionally have no completed map sprite. IDs, yields, construction and saved-state formats remain unchanged.

Eight new assets were generated with the built-in imagegen tool and reduced to 256×256 PNGs, preserving alpha. The two existing archaeology assets were retained. The full ten-asset set is about 832 KiB.

Completed sprites sit at depth 5.75; resources become small corner badges above them. Construction has a translucent sprite and progress bar. Foreign economic ownership uses a pennant. Units, buildings, cities and selections remain above improvements; current visibility gates all sprites and effects.

Current gameplay destroys improvements immediately. Persistent damage and repair exist only for buildings/wonders. To preserve that distinction, improvement destruction briefly tints/fades the old sprite with smoke, scorch/debris and small land flames. It expires after 1.8 seconds, with at most 32 concurrent effects, one shared graphics surface and one update listener only while effects exist. Nuclear waste suppresses the old artwork immediately. No damaged improvement state or repair rules were introduced.

The standalone editor consumes the same definitions and images, preserves imported improvement IDs/ownership on export and retains them on workspace resizing.

Validation: `npm run typecheck`; `node node_modules/vite/bin/vite.js build`; start Vite, then `EPOCH_URL=http://127.0.0.1:5174 node tools/improvementVisuals.browser.mjs`. The browser runner covers all textures, construction, visibility, repeated rebuilds, 50 destruction/reconstruction cycles, expiration/shutdown, editor round trips, and the existing `input/latest-save.json`. The latter contains 664 improvements; 20 rebuilds averaged about 0.48 ms in the local headless browser (environment dependent). The sprite gallery screenshot goes to `/tmp/epoch-improvements.png`.

`tools/workerImprovementDiagnostics.test.ts` passes. Existing archaeology save/restore checks pass; two other `tools/archaeologyDig.test.ts` assertions expect unlimited Archaeologist charges despite the unchanged canonical unit having `maxImprovementCharges: 1`.

## Generation prompts

Shared prompt (substitute the subject below):

Use case: stylized-concept. Create a single transparent PNG map improvement sprite for Epoch hex strategy game: {subject}. Detailed painterly isometric miniature with realistic materials, warm muted natural colors, soft upper-left sunlight, camera looking down at 45 degrees. Match classic Civilization style map structures, not a UI icon. Compact broad composition centered in a square canvas with 10% transparent margin, all elements fully within frame. Actual transparent background, no tile base, no hex border, no backdrop, no text, no badge. Sparse ground only immediately below land structures; terrain must show through around objects. Readable strong silhouette at 60 pixels. Save generated output.

- `farm.png`: cultivated golden crop rows, small rustic barn and haystacks
- `lumber_mill.png`: small timber sawmill shed, saw equipment, cut logs and neatly stacked planks, a few evergreen trees
- `plantation.png`: organized rows of lush cultivated shrubs and small plantation storehouse
- `mine.png`: dark mine entrance in a compact rocky outcrop with timber supports, minecart tracks and ore piles
- `pasture.png`: open fenced grazing enclosure with three small cows, grass and rustic shelter
- `oil_well.png`: recognizable steel oil pumpjack, small storage tanks and pipes on compact gravel working area
- `fishing_boats.png`: two small wooden fishing vessels with nets, fishing floats and tiny translucent wakes, no solid ground
- `offshore_platform.png`: compact steel offshore oil drilling platform on four legs, derrick, pipes and small deck crane, no ground or sea background

Ordinary Improvements resolve from the resource's `improvementId` / `improvementIdByTileType`, then (only without a resource) the centralized terrain defaults. Workers and Work Boats display one named Build action. Archaeology and nuclear maintenance/cleanup retain their specialized mechanics. Renewable installation artwork belongs to the Building sprite pipeline.
