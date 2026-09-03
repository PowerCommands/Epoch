import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  DEFAULT_DOMINATION_LAND_PERCENT,
  DEFAULT_DOMINATION_REQUIRED_VASSALS,
  buildDominationRanking,
  getDominationProgress,
  resolveDominationLandPercent,
  resolveDominationRequiredVassals,
  type DominationVictoryConfig,
  type LandControlLookup,
} from '../src/systems/DominationRanking.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { VictorySystem } from '../src/systems/VictorySystem.ts';
import { type MapData, type Tile, TileType } from '../src/types/map.ts';
import {
  MilitaryVassalizationSystem,
  type InheritedVassalDecisionRequest,
} from '../src/systems/diplomacy/MilitaryVassalizationSystem.ts';

const FRANCE = 'france';
const MONGOLIA = 'mongolia';
const ENGLAND = 'england';
const CHINA = 'china';

/** Single-row map with `landCount` land tiles followed by non-land filler. */
function buildMap(landCount: number, filler: TileType[] = []): MapData {
  const row: Tile[] = [];
  for (let x = 0; x < landCount; x++) row.push({ x, y: 0, type: TileType.Plains });
  filler.forEach((type, index) => row.push({ x: landCount + index, y: 0, type }));
  return { width: row.length, height: 1, tileSize: 1, tiles: [row] };
}

/** Claim `count` land tiles for `nationId`, starting at `startX`. */
function claimLand(map: MapData, nationId: string, count: number, startX = 0): void {
  for (let i = 0; i < count; i++) map.tiles[0][startX + i].ownerId = nationId;
}

interface HarnessOptions {
  ids?: string[];
  domination?: Partial<DominationVictoryConfig>;
  mapData?: MapData;
}

function addNation(manager: NationManager, id: string, human = false): void {
  manager.addNation(new Nation({ id, name: id[0]!.toUpperCase() + id.slice(1), color: 0x888888, isHuman: human }));
}

function harness(options: HarnessOptions = {}) {
  const ids = options.ids ?? [FRANCE, MONGOLIA, ENGLAND];
  const nationManager = new NationManager();
  for (const id of ids) addNation(nationManager, id, id === ENGLAND);
  const cityManager = new CityManager();
  ids.forEach((id, index) => cityManager.addCity(new City({
    id: `${id}-capital`,
    name: `${id} capital`,
    ownerId: id,
    originNationId: id,
    tileX: index,
    tileY: 0,
    isCapital: true,
    isOriginalCapital: true,
    isResidenceCapital: true,
  })));
  const diplomacy = new DiplomacyManager();
  const turnManager = new TurnManager(nationManager);
  const logs: string[] = [];
  const victory = new VictorySystem(
    cityManager,
    nationManager,
    turnManager,
    undefined,
    {
      domination: { enabled: true, ...options.domination },
      science: { enabled: false },
      cultural: { enabled: false },
      diplomatic: { enabled: false },
    },
    (_nationId, message) => logs.push(message),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    diplomacy,
    options.mapData,
  );
  return { nationManager, cityManager, diplomacy, turnManager, logs, victory };
}

test('resolvers fall back to the Domination defaults for absent/invalid values', () => {
  assert.equal(resolveDominationRequiredVassals(undefined), DEFAULT_DOMINATION_REQUIRED_VASSALS);
  assert.equal(resolveDominationRequiredVassals(0), DEFAULT_DOMINATION_REQUIRED_VASSALS);
  assert.equal(resolveDominationRequiredVassals(2.5), DEFAULT_DOMINATION_REQUIRED_VASSALS);
  assert.equal(resolveDominationRequiredVassals(5), 5);
  assert.equal(resolveDominationLandPercent(undefined), DEFAULT_DOMINATION_LAND_PERCENT);
  assert.equal(resolveDominationLandPercent(0), DEFAULT_DOMINATION_LAND_PERCENT);
  assert.equal(resolveDominationLandPercent(150), DEFAULT_DOMINATION_LAND_PERCENT);
  assert.equal(resolveDominationLandPercent(35), 35);
});

test('default fallback: a scenario with no Domination settings uses 20% land / 3 vassals', () => {
  const h = harness();
  assert.deepEqual(h.victory.getDominationVictorySettings(), {
    requiredVassals: DEFAULT_DOMINATION_REQUIRED_VASSALS,
    requiredLandPercent: DEFAULT_DOMINATION_LAND_PERCENT,
  });
  const progress = h.victory.getDominationVictoryProgress(FRANCE);
  assert.equal(progress.requiredVassalCount, 3);
  assert.equal(progress.requiredLandControlPercent, 20);
});

test('vassal victory: reaching the configured vassal count wins even with no land', () => {
  const h = harness({ domination: { requiredVassals: 2, requiredLandPercent: 100 } });
  assert.equal(h.victory.checkVictory(), null);
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  const progress = h.victory.getDominationVictoryProgress(FRANCE);
  assert.equal(progress.directVassalCount, 2);
  assert.equal(progress.vassalRequirementMet, true);
  assert.equal(progress.landRequirementMet, false);
  assert.equal(progress.fulfilled, true);
  assert.equal(h.victory.checkVictory(), FRANCE);
});

test('land victory: reaching the configured land percentage wins with zero vassals', () => {
  // 4 of 10 land tiles = 40% for France; requirement is 30%.
  const map = buildMap(10);
  claimLand(map, FRANCE, 4, 0);
  const h = harness({ domination: { requiredVassals: 3, requiredLandPercent: 30 }, mapData: map });
  const progress = h.victory.getDominationVictoryProgress(FRANCE);
  assert.equal(progress.directVassalCount, 0);
  assert.equal(progress.controlledLandTiles, 4);
  assert.equal(progress.totalLandTiles, 10);
  assert.equal(progress.landControlPercent, 40);
  assert.equal(progress.vassalRequirementMet, false);
  assert.equal(progress.landRequirementMet, true);
  assert.equal(progress.fulfilled, true);
  assert.equal(h.victory.checkVictory(), FRANCE);
});

test('OR semantics: each route wins on its own and neither is required together', () => {
  const config: DominationVictoryConfig = { requiredVassals: 2, requiredLandPercent: 25 };
  const nations = [{ id: FRANCE, name: 'France' }];
  const noVassalHost = () => undefined;

  const landOnly = getDominationProgress(nations, FRANCE, noVassalHost, config, {
    totalLandTiles: 100,
    getControlledLandTiles: () => 30,
  });
  assert.equal(landOnly.vassalRequirementMet, false);
  assert.equal(landOnly.landRequirementMet, true);
  assert.equal(landOnly.fulfilled, true, 'land alone wins');

  const noLand: LandControlLookup = { totalLandTiles: 100, getControlledLandTiles: () => 0 };
  const vassalOnly = getDominationProgress(
    [{ id: FRANCE, name: 'France' }, { id: MONGOLIA, name: 'Mongolia' }, { id: ENGLAND, name: 'England' }],
    FRANCE,
    (id) => (id === MONGOLIA || id === ENGLAND ? FRANCE : undefined),
    config,
    noLand,
  );
  assert.equal(vassalOnly.landRequirementMet, false);
  assert.equal(vassalOnly.vassalRequirementMet, true);
  assert.equal(vassalOnly.fulfilled, true, 'vassals alone win');

  const neither = getDominationProgress(nations, FRANCE, noVassalHost, config, {
    totalLandTiles: 100,
    getControlledLandTiles: () => 10,
  });
  assert.equal(neither.fulfilled, false, 'neither route met does not win');
});

test('ranking orders by vassal count first, then land-control percentage, then name', () => {
  const majors = [
    { id: FRANCE, name: 'France' },
    { id: CHINA, name: 'China' },
    { id: ENGLAND, name: 'England' },
    { id: 'usa', name: 'USA' },
  ];
  // France holds 2 vassals, China and England 1 each, USA none.
  const vassals = [
    { id: 'f1', name: 'F1' }, { id: 'f2', name: 'F2' },
    { id: 'c1', name: 'C1' }, { id: 'e1', name: 'E1' },
  ];
  const host = new Map<string, string>([
    ['f1', FRANCE], ['f2', FRANCE], ['c1', CHINA], ['e1', ENGLAND],
  ]);
  // China outranks England on land despite equal vassal counts.
  const controlled = new Map<string, number>([[FRANCE, 12], [CHINA, 31], [ENGLAND, 24], ['usa', 35]]);
  const ranking = buildDominationRanking(
    [...majors, ...vassals],
    (id) => host.get(id),
    { requiredVassals: 3, requiredLandPercent: 20 },
    { totalLandTiles: 100, getControlledLandTiles: (id) => controlled.get(id) ?? 0 },
    () => 999, // military strength is uniform and must not influence order
  );
  const order = ranking.map((entry) => entry.nationId);
  assert.ok(order.indexOf(FRANCE) < order.indexOf(CHINA), 'more vassals ranks higher');
  assert.ok(order.indexOf(CHINA) < order.indexOf(ENGLAND), 'equal vassals: higher land ranks higher');
  assert.ok(order.indexOf(ENGLAND) < order.indexOf('usa'), 'any vassal outranks none');
});

test('territory denominator counts only land tiles; neutral land stays in the total', () => {
  // 6 land tiles + ocean/coast/ice which must be excluded from the denominator.
  const map = buildMap(6, [TileType.Ocean, TileType.Coast, TileType.Ice]);
  claimLand(map, FRANCE, 2, 0); // 2 owned, 4 neutral land, 3 non-land
  const h = harness({ domination: { requiredVassals: 3, requiredLandPercent: 20 }, mapData: map });
  const progress = h.victory.getDominationVictoryProgress(FRANCE);
  assert.equal(progress.totalLandTiles, 6, 'water and ice are excluded from the land total');
  assert.equal(progress.controlledLandTiles, 2);
  assert.equal(progress.landControlPercent, (2 / 6) * 100);
});

test('vassal-owned tiles remain the vassal\'s; they do not become the host\'s controlled land', () => {
  const map = buildMap(10);
  claimLand(map, FRANCE, 2, 0);
  claimLand(map, ENGLAND, 5, 2); // England is France's vassal but keeps its own tiles
  const h = harness({ domination: { requiredVassals: 2, requiredLandPercent: 30 }, mapData: map });
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  const franceProgress = h.victory.getDominationVictoryProgress(FRANCE);
  assert.equal(franceProgress.controlledLandTiles, 2, 'host does not absorb vassal tiles');
  assert.equal(franceProgress.landRequirementMet, false);
  const englandProgress = h.victory.getDominationVictoryProgress(ENGLAND);
  assert.equal(englandProgress.controlledLandTiles, 5, 'vassal tiles stay attributed to the vassal');
});

test('scenario-configured non-default thresholds are respected by the victory check', () => {
  const map = buildMap(10);
  claimLand(map, FRANCE, 5, 0); // 50%
  const h = harness({ domination: { requiredVassals: 4, requiredLandPercent: 50 }, mapData: map });
  assert.deepEqual(h.victory.getDominationVictorySettings(), { requiredVassals: 4, requiredLandPercent: 50 });
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).landRequirementMet, true);
  assert.equal(h.victory.checkVictory(), FRANCE);
});

test('release and independence immediately reduce vassal progress without stale conquest state', () => {
  const h = harness({ domination: { requiredVassals: 2, requiredLandPercent: 100 } });
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).fulfilled, true);
  h.diplomacy.terminateVassalage(FRANCE, ENGLAND);
  const progress = h.victory.getDominationVictoryProgress(FRANCE);
  assert.equal(progress.directVassalCount, 1);
  assert.equal(progress.vassalRequirementMet, false);
  assert.equal(progress.fulfilled, false);
});

test('eliminated nations leave the authoritative vassal tally', () => {
  const h = harness({ domination: { requiredVassals: 2, requiredLandPercent: 100 } });
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.diplomacy.establishVassal(ENGLAND, FRANCE);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).directVassalCount, 2);
  h.nationManager.removeNation(ENGLAND);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).directVassalCount, 1);
});

test('periodic canonical diagnostics rank candidates by vassals then land and log both routes', () => {
  // Below both thresholds so the periodic diagnostic fires without ending the game.
  const map = buildMap(10);
  claimLand(map, FRANCE, 2, 0);
  const h = harness({ domination: { requiredVassals: 3, requiredLandPercent: 30 }, mapData: map });
  h.diplomacy.establishVassal(MONGOLIA, FRANCE);
  h.turnManager.endCurrentTurn();
  h.turnManager.endCurrentTurn();
  h.turnManager.endCurrentTurn();
  const diagnostic = h.logs.find((line) => line.includes('Domination Victory Ranking')) ?? '';
  assert.match(diagnostic, /France: vassals=1\/3 land=20\.0%\/30% vassalsMet=false landMet=false fulfilled=false/);
  assert.match(diagnostic, /Mongolia: vassals=0\/3 land=0\.0%\/30% vassalsMet=false landMet=false fulfilled=false/);
});

test('immediate victory waits until a human inherited-vassal decision is resolved', () => {
  const h = harness({ domination: { requiredVassals: 2, requiredLandPercent: 100 } });
  h.diplomacy.establishVassal(ENGLAND, MONGOLIA);
  const decisions: Array<{
    request: InheritedVassalDecisionRequest;
    resolve: (decision: 'keep' | 'liberate') => void;
  }> = [];
  const militaryDefeat = new MilitaryVassalizationSystem(h.diplomacy, {
    isHumanNation: (id) => id === FRANCE,
    endWar: () => {},
    requestHumanDecision: (request, resolve) => decisions.push({ request, resolve }),
  });
  militaryDefeat.onCompleted(() => h.victory.resolveDominationVictoryNow());

  militaryDefeat.vassalize({ victorNationId: FRANCE, defeatedNationId: MONGOLIA, reason: 'capitulation' });
  assert.equal(h.diplomacy.getVassalHost(MONGOLIA), FRANCE);
  assert.equal(h.victory.getVictoryState(), null, 'the incomplete succession must not trigger victory');
  assert.equal(decisions.length, 1);

  decisions[0]!.resolve('keep');
  assert.deepEqual(h.victory.getVictoryState(), { nationId: FRANCE, type: 'domination', round: 1 });
  assert.match(h.logs.join('\n'), /Domination Victory through vassal control/);
});

test('an AI wins when capital capture reaches the configured vassal threshold, human still alive', () => {
  const h = harness({ ids: [MONGOLIA, ENGLAND], domination: { requiredVassals: 1, requiredLandPercent: 100 } });
  const militaryDefeat = new MilitaryVassalizationSystem(h.diplomacy, {
    isHumanNation: (id) => id === ENGLAND,
    endWar: () => {},
  });
  militaryDefeat.onCompleted(() => h.victory.resolveDominationVictoryNow());

  militaryDefeat.vassalize({
    victorNationId: MONGOLIA,
    defeatedNationId: ENGLAND,
    reason: 'capitalCapture',
  });

  assert.equal(h.nationManager.getNation(ENGLAND)?.isHuman, true);
  assert.equal(h.diplomacy.getVassalHost(ENGLAND), MONGOLIA);
  assert.deepEqual(h.victory.getVictoryState(), { nationId: MONGOLIA, type: 'domination', round: 1 });
});

test('liberating an inherited vassal completes succession without granting Domination Victory', () => {
  const h = harness({ domination: { requiredVassals: 2, requiredLandPercent: 100 } });
  h.diplomacy.establishVassal(ENGLAND, MONGOLIA);
  let resolveDecision: ((decision: 'keep' | 'liberate') => void) | undefined;
  const militaryDefeat = new MilitaryVassalizationSystem(h.diplomacy, {
    isHumanNation: (id) => id === FRANCE,
    endWar: () => {},
    requestHumanDecision: (_request, resolve) => { resolveDecision = resolve; },
  });
  militaryDefeat.onCompleted(() => h.victory.resolveDominationVictoryNow());
  militaryDefeat.vassalize({ victorNationId: FRANCE, defeatedNationId: MONGOLIA, reason: 'capitalCapture' });
  resolveDecision?.('liberate');
  assert.equal(h.victory.getVictoryState(), null);
  assert.equal(h.victory.getDominationVictoryProgress(FRANCE).directVassalCount, 1);
});

test('victory route log states territorial control when only the land threshold is met', () => {
  const map = buildMap(10);
  claimLand(map, FRANCE, 3, 0); // 30%
  const h = harness({ domination: { requiredVassals: 3, requiredLandPercent: 20 }, mapData: map });
  h.victory.resolveDominationVictoryNow(7);
  assert.match(
    h.logs.join('\n'),
    /France achieved Domination Victory through territorial control: land=30\.0%\/20%\./,
  );
});

test('UI and help text describe both Domination routes', () => {
  const sidebar = readFileSync('src/ui/phaser/RightSidebarPanelDataProvider.ts', 'utf8');
  const tutorial = readFileSync('src/data/tutorialContent.ts', 'utf8');
  const menu = readFileSync('src/scenes/MainMenuScene.ts', 'utf8');
  assert.match(sidebar, /of all land tiles/);
  assert.match(sidebar, /OR have \$\{config\.requiredVassals\} vassal/);
  assert.match(sidebar, /Land: \$\{ranked\.landControlPercent/);
  assert.match(tutorial, /direct vassal states/);
  assert.match(menu, /Control enough land or vassalize enough rivals/);
});
