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

test('a peace offer can carry nothing, gold only, a city only, or both', () => {
  const h = harness({ cities: [city('c1', 'human', { population: 5, production: 6 })], gold: { human: 500 } });
  assert.equal(h.system.computeSettlementValue(proposal()).value, 0); // nothing
  assert.equal(h.system.computeSettlementValue(proposal({ goldReparations: 120 })).value, 120); // gold only
  const cityOnly = h.system.computeSettlementValue(proposal({ offeredCityIds: ['c1'] }));
  assert.equal(cityOnly.gold, 0);
  assert.ok(cityOnly.cityValue > 500, 'a city dwarfs a small gold gift'); // 250 + 5*55 + 6*20 = 645
  const both = h.system.computeSettlementValue(proposal({ goldReparations: 100, offeredCityIds: ['c1'] }));
  assert.equal(both.value, 100 + cityOnly.cityValue);
});

test('the capital can never be offered', () => {
  const h = harness({ cities: [city('cap', 'human', { isCapital: true }), city('c1', 'human')] });
  assert.deepEqual(h.system.resolveOfferedCityIds(proposal({ offeredCityIds: ['cap', 'c1'] })), ['c1']);
  assert.deepEqual(h.system.getOfferableCities('human').map((c) => c.id), ['c1']);
});

test('offered gold is capped at the proposer treasury', () => {
  const h = harness({ gold: { human: 80 } });
  assert.equal(h.system.resolveOfferedGold(proposal({ goldReparations: 1000 })), 80);
  assert.equal(h.system.resolveOfferedGold(proposal({ goldReparations: -5 })), 0);
  assert.equal(h.system.computeSettlementValue(proposal({ goldReparations: 1000 })).gold, 80);
});

test('non-owned and duplicate cities are dropped from an offer', () => {
  const h = harness({ cities: [city('c1', 'human'), city('enemyCity', 'ai')] });
  assert.deepEqual(
    h.system.resolveOfferedCityIds(proposal({ offeredCityIds: ['c1', 'c1', 'enemyCity', 'ghost'] })),
    ['c1'],
  );
});

// --- Acceptance behavior (verification items 7-9, 13) ------------------------

test('a clearly winning nation rejects an empty offer and demands strong terms', () => {
  const h = harness(winning);
  const empty = h.system.evaluatePeaceProposal(proposal());
  assert.equal(empty.accepted, false);
  assert.ok(empty.warPressure < 0.15);
  assert.ok(empty.acceptanceThreshold > 500);

  // A modest gold gift is still not enough.
  assert.equal(h.system.evaluatePeaceProposal(proposal({ goldReparations: 100 })).accepted, false);

  // A substantial city concession clears the bar.
  const big = harness({ ...winning, cities: [city('metropolis', 'human', { population: 8, production: 10 })] });
  assert.equal(big.system.evaluatePeaceProposal(proposal({ offeredCityIds: ['metropolis'] })).accepted, true);
});

test('a nation in severe danger accepts peace with little or no compensation', () => {
  const h = harness(desperate);
  const evaluation = h.system.evaluatePeaceProposal(proposal());
  assert.ok(evaluation.warPressure > 0.9, `expected high pressure, got ${evaluation.warPressure}`);
  assert.equal(evaluation.acceptanceThreshold, 0);
  assert.equal(evaluation.accepted, true); // accepts even an empty offer
});

test('acceptance rises monotonically as the offer improves', () => {
  // A losing-but-not-desperate recipient: modest terms needed.
  const cfg = {
    strength: { ai: 300, human: 900 },
    fear: { 'ai|human': 55 },
    exhaustion: { 'ai|human': { unitsLost: 4, citiesLost: 1, startStrength: 400 } },
    warring: { ai: ['human'] },
    gold: { human: 100000 },
  };
  const h = harness(cfg);
  const low = h.system.evaluatePeaceProposal(proposal({ goldReparations: 20 }));
  const high = h.system.evaluatePeaceProposal(proposal({ goldReparations: low.acceptanceThreshold + 50 }));
  assert.equal(low.accepted, false);
  assert.equal(high.accepted, true);
});

test('fear increases willingness but does not decide acceptance alone', () => {
  // Same dominant military position; only fear differs. Fear nudges pressure up
  // but a winning nation still rejects an empty offer.
  const calm = harness(winning).system.evaluatePeaceProposal(proposal());
  const afraid = harness({ ...winning, fear: { 'ai|human': 100 } }).system.evaluatePeaceProposal(proposal());
  assert.ok(afraid.warPressure > calm.warPressure);
  assert.equal(afraid.accepted, false);
});

test('identical state and offer produce identical evaluations (deterministic)', () => {
  const offer = proposal({ goldReparations: 150, offeredCityIds: ['c1'] });
  const a = harness({ ...desperate, cities: [city('c1', 'human', { population: 3 })], gold: { human: 400 } })
    .system.evaluatePeaceProposal(offer);
  const b = harness({ ...desperate, cities: [city('c1', 'human', { population: 3 })], gold: { human: 400 } })
    .system.evaluatePeaceProposal(offer);
  assert.deepEqual(a, b);
});

// --- Settlement application (verification items 11-12) -----------------------

test('settling an accepted peace transfers gold and cities and ends the war', () => {
  const h = harness({
    cities: [city('c1', 'human', { population: 5 }), city('cap', 'human', { isCapital: true })],
    gold: { human: 500, ai: 0 },
  });
  const offer = proposal({ goldReparations: 200, offeredCityIds: ['c1', 'cap'] });
  const result = h.system.settleAcceptedPeace(offer);

  assert.deepEqual(result.cityIdsTransferred, ['c1']); // capital never transfers
  assert.equal(result.goldTransferred, 200);
  assert.equal(h.cities.get('c1')!.ownerId, 'ai');
  assert.equal(h.cities.get('cap')!.ownerId, 'human'); // capital retained
  assert.equal(h.gold.get('human'), 300);
  assert.equal(h.gold.get('ai'), 200);
  assert.deepEqual(h.respondCalls, [['human', 'ai', true]]); // authoritative war-ending path
});

test('settlement never transfers more gold than the proposer holds', () => {
  const h = harness({ gold: { human: 120, ai: 0 } });
  const result = h.system.settleAcceptedPeace(proposal({ goldReparations: 5000 }));
  assert.equal(result.goldTransferred, 120);
  assert.equal(h.gold.get('human'), 0);
  assert.equal(h.gold.get('ai'), 120);
});

test('a stale accepted proposal cannot transfer assets after the war has already ended', () => {
  const h = harness({ gold: { human: 120, ai: 0 }, atWar: false });
  // This harness has no active WAR state, so the authoritative settlement guard
  // rejects the stale proposal before touching either treasury.
  const result = h.system.settleAcceptedPeace(proposal({ goldReparations: 100 }));
  assert.deepEqual(result, { goldTransferred: 0, cityIdsTransferred: [], exploitationRightsGranted: false });
  assert.equal(h.gold.get('human'), 120);
  assert.equal(h.gold.get('ai'), 0);
});
