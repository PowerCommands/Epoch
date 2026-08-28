import assert from 'node:assert/strict';
import test from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { WARRIOR } from '../src/data/units.ts';
import { BASELINE_AI_STRATEGY } from '../src/data/aiStrategies.ts';
import { ECONOMIC_DEVELOPMENT } from '../src/data/projects.ts';
import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { UnitUpkeepSystem } from '../src/systems/UnitUpkeepSystem.ts';
import {
  ConsolidationSystem,
  POST_WAR_CONSOLIDATION_TURNS,
  ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS,
} from '../src/systems/ConsolidationSystem.ts';
import {
  pickBestAIProductionCandidate,
  type AIProductionCandidate,
} from '../src/systems/ai/AIProductionScoring.ts';
import type { SavedNation } from '../src/types/saveGame.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { BuildingType } from '../src/entities/Building.ts';
import type { Producible } from '../src/types/producible.ts';

const FRANCE = 'france';
const HUMAN = 'human';

function makeConsolidation(overrides: {
  getNetIncome?: (nationId: string) => number;
} = {}) {
  let round = 1;
  const sys = new ConsolidationSystem({
    getCurrentRound: () => round,
    getNetIncome: overrides.getNetIncome ?? (() => -5),
    isHuman: (id) => id === HUMAN,
    getNationName: (id) => id,
    logEvent: () => {},
  });
  return {
    sys,
    setRound: (value: number) => { round = value; },
  };
}

test('AI enters economic-crisis consolidation; humans never do', () => {
  const { sys } = makeConsolidation();
  sys.enterEconomicCrisis(FRANCE);
  assert.equal(sys.isConsolidating(FRANCE), true);
  assert.equal(sys.getReason(FRANCE), 'economicCrisis');

  sys.enterEconomicCrisis(HUMAN);
  assert.equal(sys.isConsolidating(HUMAN), false);
  sys.enterPostWar(HUMAN);
  assert.equal(sys.isConsolidating(HUMAN), false);
});

test('post-war consolidation lasts exactly the configured number of turns', () => {
  const h = makeConsolidation();
  h.setRound(1);
  h.sys.enterPostWar(FRANCE);
  assert.equal(h.sys.getReason(FRANCE), 'postWar');

  h.setRound(POST_WAR_CONSOLIDATION_TURNS); // turn 10 with a start at turn 1
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), true);

  h.setRound(1 + POST_WAR_CONSOLIDATION_TURNS); // turn 11
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), false);
});

test('economic-crisis consolidation lasts at least the minimum and holds while income is negative', () => {
  let net = -12;
  const h = makeConsolidation({ getNetIncome: () => net });
  h.setRound(1);
  h.sys.enterEconomicCrisis(FRANCE);

  // Non-negative income before the minimum period still holds.
  net = 6;
  h.setRound(5);
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), true);

  // At/after minimum but still negative → stays consolidating.
  net = -12;
  h.setRound(1 + ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS);
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), true);

  h.setRound(50);
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), true);
});

test('economic-crisis consolidation ends once minimum passed and income recovers', () => {
  let net = -12;
  const h = makeConsolidation({ getNetIncome: () => net });
  h.setRound(1);
  h.sys.enterEconomicCrisis(FRANCE);

  net = 6;
  h.setRound(1 + ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS);
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), false);
});

test('economic crisis outranks post-war and never shortens the minimum period', () => {
  let net = -12;
  const h = makeConsolidation({ getNetIncome: () => net });
  h.setRound(1);
  h.sys.enterPostWar(FRANCE); // minimum end = turn 11, reason postWar

  // A later crisis upgrades the reason and extends (not shortens) the minimum.
  h.setRound(6);
  h.sys.enterEconomicCrisis(FRANCE); // minimum end = max(11, 16) = 16
  assert.equal(h.sys.getReason(FRANCE), 'economicCrisis');

  // Past the original post-war end but not the extended crisis minimum → stays.
  net = -3;
  h.setRound(12);
  h.sys.evaluate(FRANCE);
  assert.equal(h.sys.isConsolidating(FRANCE), true);
});

test('consolidation state survives save/load without resetting or duplicating', () => {
  let net = -12;
  const h = makeConsolidation({ getNetIncome: () => net });
  h.setRound(3);
  h.sys.enterEconomicCrisis(FRANCE);
  const savedState = h.sys.getSavedState(FRANCE);
  assert.equal(savedState?.reason, 'economicCrisis');
  assert.equal(savedState?.startedTurn, 3);
  assert.equal(savedState?.minimumUntilTurn, 3 + ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS);

  const restored = makeConsolidation({ getNetIncome: () => net });
  const savedNations: SavedNation[] = [
    { id: FRANCE, consolidation: savedState } as unknown as SavedNation,
    { id: HUMAN } as unknown as SavedNation,
  ];
  restored.sys.restore(savedNations);
  assert.equal(restored.sys.isConsolidating(FRANCE), true);
  assert.equal(restored.sys.getSavedState(FRANCE)?.minimumUntilTurn, savedState?.minimumUntilTurn);

  // Loading must not prematurely end it: still negative at the minimum boundary.
  restored.setRound(3 + ECONOMIC_CRISIS_MIN_CONSOLIDATION_TURNS);
  restored.sys.evaluate(FRANCE);
  assert.equal(restored.sys.isConsolidating(FRANCE), true);
});

test('ending a war drives AI participants into post-war consolidation', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: FRANCE, name: 'France', color: 0x0000ff }));
  nations.addNation(new Nation({ id: 'england', name: 'England', color: 0xff0000 }));
  const turns = new TurnManager(nations, getGameSpeedById('marathon'));
  const diplomacy = new DiplomacyManager(turns);

  const { sys } = makeConsolidation();
  diplomacy.onWarEnded((a, b) => {
    sys.enterPostWar(a);
    sys.enterPostWar(b);
  });

  diplomacy.declareWar(FRANCE, 'england');
  assert.equal(sys.isConsolidating(FRANCE), false);
  diplomacy.respondToPeace(FRANCE, 'england', true);

  assert.equal(sys.isConsolidating(FRANCE), true);
  assert.equal(sys.getReason(FRANCE), 'postWar');
  assert.equal(sys.isConsolidating('england'), true);
});

test('a forced upkeep dismissal drives the nation into economic-crisis consolidation', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: FRANCE, name: 'France', color: 0x0000ff }));
  const units = new UnitManager(4, 1);
  for (let i = 0; i < 4; i += 1) {
    units.createUnit({ type: WARRIOR, ownerId: FRANCE, tileX: i, tileY: 0 });
  }
  const tiles: Tile[][] = [[0, 1, 2, 3].map((x): Tile => ({ x, y: 0, type: TileType.Plains }))];
  const mapData: MapData = { width: 4, height: 1, tileSize: 1, tiles };

  const { sys } = makeConsolidation();
  const fakeResources = { addGold: () => null } as unknown as ConstructorParameters<typeof UnitUpkeepSystem>[2];
  const upkeep = new UnitUpkeepSystem(
    nations, units, fakeResources, mapData, undefined, undefined, undefined,
    (nationId) => sys.enterEconomicCrisis(nationId),
  );

  // Nation has no gold but positive upkeep → forced dismissal.
  const result = upkeep.enforceAndApplyUpkeepForNation(FRANCE);
  assert.ok(result.dismissedUnits.length > 0);
  assert.equal(sys.isConsolidating(FRANCE), true);
  assert.equal(sys.getReason(FRANCE), 'economicCrisis');
});

test('Economic Development outranks marginal buildup but yields to genuine needs and defence', () => {
  const dummyBuilding: BuildingType = {
    id: 'marginal', name: 'Marginal', productionCost: 10, era: 'ancient',
    requiredTechnologyId: undefined, modifiers: {}, description: '', placement: 'city',
  };
  const project: Producible = { kind: 'project', projectType: ECONOMIC_DEVELOPMENT };
  const marginalMilitary: Producible = { kind: 'unit', unitType: WARRIOR };
  const marginalBuilding: Producible = { kind: 'building', buildingType: dummyBuilding };

  // Mirrors the score band the AISystem assigns: project (30) > marginal fallbacks
  // (25), but a genuine-need building (55) and an acute defender (100) still win.
  const projectCandidate: AIProductionCandidate = { item: project, baseScore: 30, category: 'project' };
  const fallbackMilitary: AIProductionCandidate = { item: marginalMilitary, baseScore: 25, category: 'military' };
  const fallbackBuilding: AIProductionCandidate = { item: marginalBuilding, baseScore: 25, category: 'goldBuilding' };
  const genuineBuilding: AIProductionCandidate = { item: marginalBuilding, baseScore: 55, category: 'goldBuilding' };
  const acuteDefender: AIProductionCandidate = { item: marginalMilitary, baseScore: 100, category: 'military' };

  // Consolidation fallback: only project + marginal candidates present.
  const overMarginal = pickBestAIProductionCandidate(
    [fallbackMilitary, fallbackBuilding, projectCandidate], BASELINE_AI_STRATEGY,
  );
  assert.equal(overMarginal?.item.kind, 'project');

  // A genuine-need building overrides Economic Development.
  const withGenuineNeed = pickBestAIProductionCandidate(
    [projectCandidate, genuineBuilding], BASELINE_AI_STRATEGY,
  );
  assert.equal(withGenuineNeed?.item.kind, 'building');

  // An acute defender (emergency/capital recapture band) overrides it too.
  const withDefender = pickBestAIProductionCandidate(
    [projectCandidate, acuteDefender], BASELINE_AI_STRATEGY,
  );
  assert.equal(withDefender?.item.kind, 'unit');
});
