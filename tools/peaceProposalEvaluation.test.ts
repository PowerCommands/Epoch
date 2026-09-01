import assert from 'node:assert/strict';
import test from 'node:test';
import { PeaceTreatySystem } from '../src/systems/PeaceTreatySystem.ts';
import type { PeaceProposal } from '../src/systems/DiplomacyManager.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import type { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AIMilitaryThreatEvaluationSystem } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem.ts';
import type { MapData } from '../src/types/map.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import type { ProductionSystem } from '../src/systems/ProductionSystem.ts';

interface CityStub {
  id: string;
  name: string;
  ownerId: string;
  isCapital: boolean;
  population: number;
  production: number;
  originNationId: string;
  tileX: number;
  tileY: number;
  ownedTileCoords: Array<{ x: number; y: number }>;
  occupiedOriginalNationId?: string;
}

function city(id: string, ownerId: string, over: Partial<CityStub> = {}): CityStub {
  return {
    id, name: id, ownerId, isCapital: false, population: 4, production: 4,
    originNationId: ownerId, tileX: 0, tileY: 0, ownedTileCoords: [], ...over,
  };
}

function harness(config: {
  cities?: CityStub[];
  gold?: Record<string, number>;
  strength?: Record<string, number>;
  fear?: Record<string, number>; // key `${recipient}|${opponent}`
  exhaustion?: Record<string, { unitsLost: number; citiesLost: number; startStrength: number }>;
  threat?: Record<string, 'none' | 'low' | 'medium' | 'high'>;
  warring?: Record<string, string[]>;
  atWar?: boolean;
} = {}) {
  const cities = new Map((config.cities ?? []).map((c) => [c.id, c]));
  const gold = new Map(Object.entries(config.gold ?? {}));
  const respondCalls: Array<[string, string, boolean]> = [];

  const cityManager = {
    getCitiesByOwner: (id: string) => [...cities.values()].filter((c) => c.ownerId === id),
    getCity: (id: string) => cities.get(id),
    getResources: (id: string) => ({ productionPerTurn: cities.get(id)?.production ?? 0 }),
    transferOwnership: (id: string, to: string) => { const c = cities.get(id); if (c) c.ownerId = to; },
  } as unknown as CityManager;
  const nationManager = {
    getResources: (id: string) => ({ gold: gold.get(id) ?? 0 }),
  } as unknown as NationManager;
  const resourceSystem = {
    addGold: (id: string, amount: number) => gold.set(id, (gold.get(id) ?? 0) + amount),
  } as unknown as ResourceSystem;
  const diplomacyManager = {
    getState: () => config.atWar === false ? 'PEACE' : 'WAR',
    getWarExhaustion: (r: string, o: string) => config.exhaustion?.[`${r}|${o}`] ?? { unitsLost: 0, citiesLost: 0, startStrength: 0 },
    getRelation: (r: string, o: string) => ({ fear: config.fear?.[`${r}|${o}`] ?? 0 }),
    getWarringNationIds: (r: string) => config.warring?.[r] ?? [],
    getAggressorNationId: () => undefined,
    respondToPeace: (f: string, t: string, accept: boolean) => { respondCalls.push([f, t, accept]); },
  } as unknown as DiplomacyManager;
  const mil = {
    getMilitaryStrength: (id: string) => ({ totalStrength: config.strength?.[id] ?? 0, unitStrength: 0, cityStrength: 0 }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threatEval = {
    getThreatLevel: (r: string, o: string) => config.threat?.[`${r}|${o}`] ?? 'none',
  } as unknown as AIMilitaryThreatEvaluationSystem;
  const mapData = { tiles: [] } as unknown as MapData;
  const gridSystem = { getTilesInRange: () => [] } as unknown as IGridSystem;
  const productionSystem = {} as unknown as ProductionSystem;

  const system = new PeaceTreatySystem(
    cityManager, nationManager, resourceSystem, diplomacyManager,
    mapData, gridSystem, productionSystem, mil, threatEval,
  );
  return { system, cities, gold, respondCalls };
}

function proposal(over: Partial<PeaceProposal> = {}): PeaceProposal {
  return { fromNationId: 'human', toNationId: 'ai', warDuration: 15, ...over };
}

// A dominant recipient with no losses — wants nothing to do with peace.
const winning = { strength: { ai: 1000, human: 200 }, warring: { ai: ['human'] } };
// An outmatched, fearful, battered recipient in mortal danger.
const desperate = {
  strength: { ai: 50, human: 2000 },
  fear: { 'ai|human': 100 },
  exhaustion: { 'ai|human': { unitsLost: 12, citiesLost: 3, startStrength: 500 } },
  threat: { 'ai|human': 'high' as const },
  warring: { ai: ['human', 'x', 'y'] },
};

// --- Proposal composition (verification items 1-4) --------------------------

test('the capital can never be offered', () => {
  const h = harness({ cities: [city('cap', 'human', { isCapital: true }), city('c1', 'human')] });
  assert.deepEqual(h.system.resolveOfferedCityIds(proposal({ offeredCityIds: ['cap', 'c1'] })), ['c1']);
  assert.deepEqual(h.system.getOfferableCities('human').map((c) => c.id), ['c1']);
});

test('non-owned and duplicate cities are dropped from an offer', () => {
  const h = harness({ cities: [city('c1', 'human'), city('enemyCity', 'ai')] });
  assert.deepEqual(
    h.system.resolveOfferedCityIds(proposal({ offeredCityIds: ['c1', 'c1', 'enemyCity', 'ghost'] })),
    ['c1'],
  );
});

// --- Acceptance behavior (verification items 7-9, 13) ------------------------

test('a nation in severe danger accepts peace with little or no compensation', () => {
  const h = harness(desperate);
  const evaluation = h.system.evaluatePeaceProposal(proposal());
  assert.ok(evaluation.warPressure > 0.9, `expected high pressure, got ${evaluation.warPressure}`);
  assert.equal(evaluation.acceptanceThreshold, 0);
  assert.equal(evaluation.accepted, true); // accepts even an empty offer
});

test('fear increases willingness but does not decide acceptance alone', () => {
  // Same dominant military position; only fear differs. Fear nudges pressure up
  // but a winning nation still rejects an empty offer.
  const calm = harness(winning).system.evaluatePeaceProposal(proposal());
  const afraid = harness({ ...winning, fear: { 'ai|human': 100 } }).system.evaluatePeaceProposal(proposal());
  assert.ok(afraid.warPressure > calm.warPressure);
  assert.equal(afraid.accepted, false);
});
