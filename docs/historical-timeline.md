# Historical Timeline / Timelapse

Open **▶** in the existing History panel, enter **history** in the cheat console (Ctrl+Shift+C), or choose **History / Timelapse** on the victory screen. The viewer pauses the Phaser scene and any running autoplay; closing restores their previous presentation state. It does not advance turns or write to the recording.

## Recording and persistence

`HistoricalMapRecorder` observes the live political `tile.ownerId`, never cultural/resource claims. It records the initial available world, then at the end of rounds 1, 6, 11, … and on important chronicle transitions: settlement, conquest, liberation, razing, elimination, capitulation, war/peace, world wars, nuclear attacks, global milestones, and major council resolutions. Victory records a final snapshot. Saves and viewer reads include an up-to-date endpoint without mutating accumulated recordings.

`historicalMap` is an optional version-1 payload inside the existing version-4 save:

- Map dimensions and a shared palette of nation IDs, frozen names, and existing colors.
- Each snapshot has round, signed year, frozen date label, chronicle event cursor, and alternating `[ownerIndex, runLength, …]` pairs in row-major tile order. Zero means neutral.
- Terrain and tile geometry come from the existing game map. No units, yields, buildings, resources, fog, screenshots, or simulation state are recorded.

Palette entries remain after a nation disappears. Repeated identical captures at the same event cursor are suppressed. Distinct changes within a round remain navigable. There is no per-frame gameplay recorder.

GameScene initializes the observer after the existing save restoration and scenario setup finish, before starting turn processing. Invalid dimensions, malformed palettes, invalid runs, inconsistent tile counts, and out-of-order or future snapshots reset only the optional recording. Old saves begin at the loaded round. Existing recorded chronicle events remain stored, but the replay does not fabricate maps for rounds before its first snapshot.

## News and milestones

The viewer consumes `HistoricalTimelineService` and `NewspaperSystem`. `articleForHistory` returns archived newspaper copy when present and otherwise uses the same newspaper definitions to format an existing chronicle event. Unsupported article types retain their existing chronicle text. No second news store or publication cursor is introduced. Playback merges event stops with map snapshots using the event cursor, so it never pulls a later conquest backward into an earlier headline. Quiet map stops can retain a recent report, dated explicitly. Reading pace allows roughly 280 ms per word, with a 3.5-second minimum; optional 2×/4×/10×/20× speeds and pause/scrub controls are available.

`WORLD_FIRSTS` in `src/data/worldHistory.ts` defines predicates, copy, and images for the first ship, aircraft, Hospital, Atomic Bomb, and Nuclear Missile. `WorldHistoryMilestones` listens to successful production completion only. Stable global keys persist in `worldHistoryMilestones` and in the existing chronicle metadata. Scenario/legacy assets already present establish a silent baseline; their construction dates are not invented.

New national technology-era arrivals also generate one global `worldEra` event per newly reached era. Existing national era news remains. Atmospheric copy includes examples selected from the actual technology and culture trees. Starting/already reached eras establish a baseline without retroactive announcements. Extend `WORLD_FIRSTS` for new inventions and `WORLD_ERAS` for era copy.

The new artwork is `public/assets/sprites/news/world-eras.png`, a shared generated sepia civilization panorama. Milestones reuse existing ship/flight, Hospital, atomic research, and rocketry images. The minimap and replay share terrain color definitions.

Presentation events do not consume the chronicle's simulation sequence. The leader statement system uses `simulationEventId` (falling back to legacy `id`) for its existing event-seeded reaction roll. This prevents additional newspaper facts from changing AI reactions.

## Validation

- `npm run test:history`: recorder, compact encoding, invalid/legacy saves, event synchronization, all world-firsts, era articles, archived copy reuse, simulation sequence, newspaper regressions, and showman regressions.
- `npm run typecheck` and `node node_modules/vite/bin/vite.js build`.
- With Vite running: `EPOCH_URL=http://127.0.0.1:5173 node tools/historyTimeline.browser.mjs`. Set `CHROME_PATH` if Chrome is elsewhere. Covers real-game controls, unchanged saved gameplay state while viewing, autoplay pause/resume, persisted snapshots, and corrupt optional data.

## Deliberate limits

This is a political replay, not full simulation rewind. Ordinary border changes between samples use the last known map; major transitions receive extra samples. Terrain is reused rather than historically recorded (original terrain is preferred where the game retains it). Legacy saves cannot identify inventions that were created and destroyed before recording existed. All eras currently share one panorama. Video export, map zoom, event filters, and unique art per era are possible follow-ups.
