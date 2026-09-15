# Strategic weapons: implementation and playtest guide

## Technology and production

| Technology | New capability | Production | Maintenance |
| --- | --- | ---: | ---: |
| Rocketry | Missile Launch Pad | 450 | 8 Gold/turn |
| Satellites | ICBM, initially conventional | 450 | 15 Gold/turn |
| Nuclear Fission | Nuclear Warhead component | 1,800 | None |
| Advanced Ballistics | Patriot Missile Battery | 900 | 4 Gold/turn |

The existing Atomic Bomb, Guided Missile, Nuclear Missile, bomber and submarine technology gates remain in place. The player-facing Nuclear Silo has become **Missile Launch Pad**. The internal `nuclear_silo` id and `NUCLEAR_SILO` export remain compatibility aliases.

Nuclear Warheads use the existing production queue as finite `strategicComponent` items. A completed warhead increases the owner's `Nation.nuclearWarheads` stockpile; it is never a map unit. Production requires Nuclear Fission and Uranium. A stored conventional ICBM can mount one available warhead through **Mount Nuclear Warhead**. Mounting consumes the component and persists `Unit.nuclearArmed`.

The UN Non-Proliferation Treaty follows its existing member-production semantics: it blocks new Atomic Bombs, Nuclear Missiles and Nuclear Warheads. Conventional ICBM production and use remain legal. Existing nuclear weapons and already-produced warheads retain their capability; the treaty does not disarm them or prohibit launch.

## Launch Pads and delivery

New Launch Pads are repeatable military buildings placed on empty owned land outside the city center. Each holds **four missiles**, with any mixture of Nuclear Missiles, conventional ICBMs and nuclear-armed ICBMs. An installed warhead consumes no additional slot. Production rechecks working capacity at selection and completion.

`MissileStorageSystem` derives facility state from existing tile/city buildings and stores the assignment on each real missile as `missileLaunchPad: {x, y}`. There is no duplicate inventory. Owners can inspect exact stored missile types, arming state, occupancy and operational state. Enemy inspection reveals the installation without exposing its exact magazine contents.

To manage a pad, select its tile and open **Details** using the minimap control. The inventory lists each missile, with **Mount Nuclear Warhead** beside conventional ICBMs. Choose **Select ICBM** to access its launch action. The **I** tile inspector also shows capacity, payloads and facility status.

Ordinary military building attacks break the installation while stored missiles survive. Broken pads cannot launch; repair restores them. A Guided Missile, Nuclear Missile or ICBM blast that includes a pad destroys **every stored missile**, regardless of the stored missiles' remaining HP. Destruction of stored nuclear materiel never triggers secondary nuclear explosions.

ICBMs have a dedicated global-targeting rule, separate from ordinary unit range. They must launch from a working pad. Nuclear Missiles retain range **12**, and may also launch from Nuclear Submarine cargo. Guided Missiles retain range **8** and their existing land/submarine delivery. Nuclear Submarines carry three Guided/Nuclear Missiles. Bomber and Stealth Bomber each carry one Atomic Bomb, using bomber ranges **10** and **20** respectively. Atomic Bombs cannot move independently.

Launching consumes the missile. Cargo launches also consume the carrier's remaining action. Strategic attacks preserve turn, ownership, valid-target and neutral-collateral restrictions. Human strategic targeting can select coordinates in fog without revealing their occupants; AI targets only known positions.

## Damage and environmental effects

`src/data/strategicWeapons.ts` is the canonical balance source. `getStrategicWeaponProfile(unit)` returns the existing Nuclear Missile profile for an armed ICBM. Global delivery remains a property of the original ICBM definition.

| Weapon | Radius | Unit HP damage | City HP damage | Population loss | Buildings broken | Nuclear Waste |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Guided Missile | 1 | 60 | 70 | 0% | 15% | No |
| Conventional ICBM | 2 | 120 | 180 | 50% | 60% | No |
| Atomic Bomb | 3 | 120 | 180 | 50% | 60% | Yes |
| Nuclear Missile / nuclear-armed ICBM | 4 | 160 | 240 | 65% | 80% | Yes |

The conventional ICBM shares Atomic Bomb direct damage values and has no nuclear classification, mushroom cloud, waste or nuclear-specific diplomatic consequences. Radii include the center and all axial hexes within the radius; there is no damage falloff. Population and city-building counts round down. Cities retain at least one HP and one population; strategic weapons do not capture cities. Physical installations hit by a blast become broken, while existing Wonder protection remains authoritative.

A working Bomb Shelter halves nuclear damage to city HP, population, city-center building damage and units on the city tile. It does not reduce conventional ICBM/Guided Missile damage or protect surrounding terrain.

Nuclear strikes contaminate land except Mountain, Coast and Ocean. Nuclear Waste has zero yields and resource quantity. Worker cleanup takes five turns before existing speed modifiers, consumes a charge, restores the original terrain and leaves destroyed improvements absent. Cleanup progress and original terrain use existing save fields.

## Patriot interception

Operational Patriot Missile Batteries cover targets within **five hexes** and intercept Guided Missiles, Nuclear Missiles and either ICBM payload. They do not attack ordinary land units or Atomic Bombs delivered by aircraft.

Each actual attempt costs **10,000 Gold** and succeeds with **80%** probability. The defender must afford the full attempt; the treasury never becomes negative. Eligible overlapping batteries resolve sequentially, ordered by distance to the target and then coordinates. Processing stops after the first success; batteries that do not fire are not charged. Broken or unaffordable batteries do not attempt interception.

Rolls use the existing deterministic combat helper with the round, missile identity, defending nation and battery coordinates. Resolution completes before presentation begins. A successful interception consumes the incoming missile and causes no target damage, nuclear waste or nuclear-use consequences.

## Globe presentation

`ICBMStrikeRenderer` uses the existing `CameraController` and globe projection, and shares effect textures with `NuclearStrikeRenderer`. It presents ignition and vertical ascent, a pullback into Globe Mode, a high ballistic arc, re-entry, any resolved Patriot interceptions, and an impact while viewing the globe. Conventional impact uses a compact dust/explosion treatment. Nuclear impact develops a much larger rising mushroom cloud before the camera returns toward the target. Own launches show their impact over fog without revealing hidden units or changing visibility. Escape or the Skip button ends playback immediately.

Animation reads the already-resolved strike event, including origin and interception attempts. It never controls damage, interception payment or turn progression. Off-screen strikes, disabled animations and autorun resolve through the same gameplay path. Transient graphics and camera state are cleaned up when playback completes or the renderer is destroyed. This feature adds no sound effects.

## Diplomacy and AI

Successful nuclear strikes reuse nuclear history/newspaper events, relation consequences and Council/UN emergency intervention. Guided Missiles and conventional ICBMs do not create nuclear-use events. Nuclear accidents retain their existing treatment.

AI uses existing production scoring, doctrine budgets, economy and personality. Stronger economies with military interest or nuclear rivals can build a small number of pads and missiles. Pending missile production reserves capacity in AI planning; Nuclear Warhead production has a higher economic threshold and a small desired stockpile. Wealthy capitals and major production centers consider Patriots only when strategic threats justify them and their treasuries can fund multiple attempts.

Global targeting evaluates known enemy cities, visible units and missile installations. Launch Pads receive a fixed strategic score without inspecting hidden stored missiles. AI avoids domestic blast damage. Nuclear use retains the conservative severe-pressure checks, retaliation and intervention costs; mounting a warhead does not make AI casually launch it.

Nuclear deterrence derives from live delivery readiness: 350 defensive strength per ready weapon, capped at four, plus 175 per submarine weapon, capped at two. Broken Launch Pads contribute stockpile possession but no ready deterrence. Mutual nuclear capability multiplies the defender's deterrence contribution by 1.5.

## Save compatibility

Unit saves retain cargo and now include optional pad assignment and ICBM arming fields. Nation saves add the available warhead count; absent fields default to an empty stockpile and conventional payload. Pad and Patriot damage use normal/broken building state.

Legacy city-only Nuclear Silos retain their original city-center launch location, including when a new pad is subsequently placed elsewhere. Reconciliation adopts unassigned missiles at the original facility, including legacy inventories above four. These over-capacity inventories can launch but cannot accept additional missiles until a slot becomes free. New construction always uses tile placement. Nuclear capability and AI readiness are derived from canonical saved units and facilities.

In-progress legacy silo queues retain accumulated production and their locked cost. On load they preserve a valid reserved site or reserve the first valid owned land tile. If no site is free, the queue retains its paid work and a placement-block explanation; completion retries when land becomes available.

## Validation

Run `npm run test:strategic` for the seven focused gameplay suites, including legacy queue migration. They cover existing nuclear delivery and damage, storage, global conventional strikes, warheads, treaty production, interception, save compatibility, AI visibility/retention and flight geometry. With Vite running, `EPOCH_URL=http://127.0.0.1:5174 npm run test:strategic:browser` checks the cinematic and the real GameScene production/UI flow.

Run the focused suites with `node --import tsx --test <test files>`, plus `npm run typecheck` and the production build. Run a test file directly with `node --import tsx <file>` if the environment's test-runner wrapper hides individual failures. Asset validation uses `tools/structureDamageAssets.test.ts` and `tools/ambientProfiles.test.ts`.

Manual playtesting should exercise mixed inventories, multiple overlapping Patriots, broken-pad repairs, launch from tactical and Globe Mode, both ICBM payloads, repeated cinematics, and save/reload at late-game scale. Continue campaign/autorun balance checks for the timing of first arsenals, production cost, interception treasury pressure and nuclear-use frequency.
