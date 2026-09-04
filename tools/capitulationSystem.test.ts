import assert from 'node:assert/strict';
import test from 'node:test';
import { CapitulationSystem } from '../src/systems/CapitulationSystem.ts';
import { PeaceTreatySystem } from '../src/systems/PeaceTreatySystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { getUnitTypeById } from '../src/data/units.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import type { UnitManager } from '../src/systems/UnitManager.ts';
import type { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { AIMilitaryThreatEvaluationSystem } from '../src/systems/ai/AIMilitaryThreatEvaluationSystem.ts';
import type { MapData } from '../src/types/map.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import type { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import type { Producible } from '../src/types/producible.ts';

interface CityStub {
  id: string; name: string; ownerId: string; isCapital: boolean; population: number;
  production: number; originNationId: string; tileX: number; tileY: number;
  ownedTileCoords: Array<{ x: number; y: number }>; occupiedOriginalNationId?: string;
}
interface UnitStub { id: string; unitTypeId: string; ownerId: string; }

function city(id: string, ownerId: string, over: Partial<CityStub> = {}): CityStub {
  return {
    id, name: id, ownerId, isCapital: false, population: 4, production: 4,
    originNationId: ownerId, tileX: 0, tileY: 0, ownedTileCoords: [], ...over,
  };
}

function harness(config: {
  cities?: CityStub[];
  units?: UnitStub[];
  gold?: Record<string, number>;
  strength?: Record<string, number>;
  fear?: Record<string, number>;
  exhaustion?: Record<string, { unitsLost: number; citiesLost: number; startStrength: number }>;
  threat?: Record<string, 'none' | 'low' | 'medium' | 'high'>;
  warring?: Record<string, string[]>;
  warDuration?: number;
  activeNations?: string[];
  currentTurn?: number;
  cooldownTurns?: number;
  acceptanceThreshold?: number;
} = {}) {
  const cities = new Map((config.cities ?? []).map((c) => [c.id, c]));
  const units = new Map<string, UnitStub[]>();
  for (const u of config.units ?? []) {
    if (!units.has(u.ownerId)) units.set(u.ownerId, []);
    units.get(u.ownerId)!.push(u);
  }
  const gold = new Map(Object.entries(config.gold ?? {}));
  const active = new Set(config.activeNations ?? []);
  let currentTurn = config.currentTurn ?? 100;
  const respondCalls: Array<[string, string, boolean]> = [];
  const removedFromQueues: string[][] = [];
  const vassalHosts = new Map<string, string>();
  const logs: string[] = [];

  const cityManager = {
    getCitiesByOwner: (owner: string) => [...cities.values()].filter((c) => c.ownerId === owner),
    getCity: (id: string) => cities.get(id),
    getResources: (id: string) => ({ productionPerTurn: cities.get(id)?.production ?? 0 }),
    transferOwnership: (id: string, to: string) => { const c = cities.get(id); if (c) c.ownerId = to; },
  } as unknown as CityManager;
  const nationManager = {
    getNation: (id: string) => (active.has(id) ? { id } : undefined),
    getResources: (id: string) => ({ gold: gold.get(id) ?? 0 }),
  } as unknown as NationManager;
  const resourceSystem = {
    addGold: (id: string, amount: number) => gold.set(id, (gold.get(id) ?? 0) + amount),
  } as unknown as ResourceSystem;
  const unitManager = {
    getUnitsByOwner: (owner: string) => [...(units.get(owner) ?? [])].map((u) => ({ id: u.id, unitType: getUnitTypeById(u.unitTypeId) })),
    removeUnit: (id: string) => {
      for (const list of units.values()) {
        const i = list.findIndex((u) => u.id === id);
        if (i >= 0) { list.splice(i, 1); return; }
      }
    },
  } as unknown as UnitManager;
  const diplomacyManager = {
    getState: (a: string, b: string) =>
      (config.warring?.[a]?.includes(b) || config.warring?.[b]?.includes(a)) ? 'WAR' : 'PEACE',
    getWarringNationIds: (n: string) => config.warring?.[n] ?? [],
    getWarDuration: () => config.warDuration ?? 20,
    getWarExhaustion: (a: string, b: string) => config.exhaustion?.[`${a}|${b}`] ?? { unitsLost: 0, citiesLost: 0, startStrength: 0 },
    getRelation: (a: string, b: string) => ({ fear: config.fear?.[`${a}|${b}`] ?? 0 }),
    respondToPeace: (f: string, t: string, accept: boolean) => { respondCalls.push([f, t, accept]); },
    canEstablishVassal: () => true,
    establishVassal: (vassalId: string, hostId: string) => { vassalHosts.set(vassalId, hostId); return true; },
    getNationDisplayName: (id: string) => id,
  } as unknown as DiplomacyManager;
  const mil = {
    getMilitaryStrength: (id: string) => ({ totalStrength: config.strength?.[id] ?? 0, unitStrength: 0, cityStrength: 0 }),
  } as unknown as AIMilitaryEvaluationSystem;
  const threatEval = {
    getThreatLevel: (t: string, d: string) => config.threat?.[`${t}|${d}`] ?? 'none',
  } as unknown as AIMilitaryThreatEvaluationSystem;
  const mapData = { tiles: [] } as unknown as MapData;
  const gridSystem = { getTilesInRange: () => [] } as unknown as IGridSystem;
  const productionSystem = {
    removeMilitaryUnitsFromQueues: (cityIds: readonly string[]) => { removedFromQueues.push([...cityIds]); },
  } as unknown as ProductionSystem;

  const peaceTreatySystem = new PeaceTreatySystem(
    cityManager, nationManager, resourceSystem, diplomacyManager,
    mapData, gridSystem, productionSystem, mil, threatEval,
  );
  const system = new CapitulationSystem({
    diplomacyManager, cityManager, nationManager, unitManager, resourceSystem, productionSystem,
    peaceTreatySystem, militaryEvaluationSystem: mil,
    getCurrentTurn: () => currentTurn,
    getDemilitarizationTurns: () => config.cooldownTurns ?? 10,
    acceptanceThreshold: config.acceptanceThreshold,
    log: (message) => logs.push(message),
  });
  return {
    system, cities, units, gold, respondCalls, removedFromQueues, vassalHosts, logs,
    setTurn: (t: number) => { currentTurn = t; },
  };
}

// Scenarios (perspective: 'target' decides, demander = 'atk').
const balanced = { strength: { target: 500, atk: 500 }, warring: { target: ['atk'], atk: ['target'] } };
const collapse = {
  strength: { target: 20, atk: 2000 },
  fear: { 'target|atk': 90 },
  exhaustion: { 'target|atk': { unitsLost: 12, citiesLost: 5, startStrength: 600 } },
  threat: { 'target|atk': 'high' as const },
  warring: { target: ['atk'], atk: ['target'] },
};

// --- Eligibility / acceptance (items 1-3, 20) -------------------------------

test('a balanced war is neither eligible for nor accepts capitulation', () => {
  const h = harness({ ...balanced, cities: [city('t1', 'target')] });
  const evaluation = h.system.evaluateCapitulationDemand('atk', 'target');
  assert.equal(h.system.canDemandCapitulation('atk', 'target'), false);
  assert.equal(evaluation.accepted, false);
  assert.ok(evaluation.pressure < 0.42);
});

test('severe military and territorial collapse makes capitulation acceptable', () => {
  const h = harness({ ...collapse, cities: [city('t1', 'target')] });
  const evaluation = h.system.evaluateCapitulationDemand('atk', 'target');
  assert.equal(h.system.canDemandCapitulation('atk', 'target'), true);
  assert.equal(evaluation.accepted, true);
  assert.ok(evaluation.pressure >= 0.7);
});

test('acceptance uses the configured scenario threshold without changing pressure', () => {
  const permissive = harness({
    ...collapse,
    cities: [city('t1', 'target')],
    acceptanceThreshold: 0.01,
  }).system.evaluateCapitulationDemand('atk', 'target');
  const resistant = harness({
    ...collapse,
    cities: [city('t1', 'target')],
    acceptanceThreshold: 1,
  }).system.evaluateCapitulationDemand('atk', 'target');

  assert.equal(permissive.pressure, resistant.pressure);
  assert.equal(permissive.accepted, true);
  assert.equal(resistant.accepted, resistant.pressure >= 1);
});

test('runtime acceptance-threshold changes affect subsequent evaluations immediately', () => {
  const h = harness({ ...collapse, cities: [city('t1', 'target')], acceptanceThreshold: 1 });
  const before = h.system.evaluateCapitulationDemand('atk', 'target');
  h.system.setAcceptanceThreshold(0.01);
  const after = h.system.evaluateCapitulationDemand('atk', 'target');
  assert.equal(before.pressure, after.pressure);
  assert.equal(before.accepted, before.pressure >= 1);
  assert.equal(after.accepted, true);
});

test('runtime 0.20 accepts pressure 0.32 and the normal apply path creates the human vassal', () => {
  const h = harness({
    cities: [city('t1', 'target')],
    warring: { target: ['human'], human: ['target'] },
    activeNations: ['target', 'human'],
    acceptanceThreshold: 0.2,
  });
  h.system.computeCapitulationPressure = () => ({
    pressure: 0.32,
    factors: { warPressure: 0.12, militaryCollapse: 0.08, attrition: 0.05, territorialCollapse: 0.07 },
  });

  assert.equal(h.system.evaluateCapitulationDemand('human', 'target').accepted, true);
  const result = h.system.applyCapitulation('human', 'target', 0);
  assert.equal(result.accepted, true);
  assert.equal(h.vassalHosts.get('target'), 'human');
  assert.deepEqual(h.respondCalls, [['target', 'human', true]]);
});

test('fear alone does not cause capitulation without military evidence', () => {
  const h = harness({
    strength: { target: 500, atk: 500 }, // even fight
    fear: { 'target|atk': 100 }, // terrified, but no losses
    warring: { target: ['atk'], atk: ['target'] },
    cities: [city('t1', 'target')],
  });
  const evaluation = h.system.evaluateCapitulationDemand('atk', 'target');
  assert.equal(evaluation.accepted, false);
});

test('capitulation evaluation is deterministic for identical state', () => {
  const a = harness({ ...collapse, cities: [city('t1', 'target')] }).system.evaluateCapitulationDemand('atk', 'target');
  const b = harness({ ...collapse, cities: [city('t1', 'target')] }).system.evaluateCapitulationDemand('atk', 'target');
  assert.deepEqual(a, b);
});

// --- Application: units, production, reparations, cities, wars (items 4-18) --

test('accepted capitulation disbands military units but keeps civilians', () => {
  const h = harness({
    ...collapse,
    cities: [city('t1', 'target')],
    units: [
      { id: 'w1', unitTypeId: 'warrior', ownerId: 'target' },
      { id: 'a1', unitTypeId: 'archer', ownerId: 'target' },
      { id: 's1', unitTypeId: 'settler', ownerId: 'target' },
      { id: 'k1', unitTypeId: 'worker', ownerId: 'target' },
      { id: 'atkW', unitTypeId: 'warrior', ownerId: 'atk' },
    ],
    gold: { target: 500 },
  });
  const result = h.system.applyCapitulation('atk', 'target', 200);
  assert.equal(result.accepted, true);
  assert.equal(result.removedUnitCount, 2);
  const remaining = h.units.get('target')!.map((u) => u.id).sort();
  assert.deepEqual(remaining, ['k1', 's1']); // civilians remain
  assert.equal(h.units.get('atk')!.length, 1); // enemy units untouched
  assert.deepEqual(h.removedFromQueues, [['t1']]); // in-progress military production cancelled
});

test('reparations divide evenly with deterministic remainder and conserve money', () => {
  const h = harness({
    ...collapse,
    warring: { target: ['atk', 'brb', 'crd'], atk: ['target'], brb: ['target'], crd: ['target'] },
    cities: [city('t1', 'target')],
    gold: { target: 1000, atk: 0, brb: 0, crd: 0 },
  });
  const result = h.system.applyCapitulation('atk', 'target', 901);
  assert.equal(result.reparationsPaid, 901);
  // Sorted enemies: atk, brb, crd → 301, 300, 300.
  assert.deepEqual(result.reparationShares, [
    { nationId: 'atk', amount: 301 }, { nationId: 'brb', amount: 300 }, { nationId: 'crd', amount: 300 },
  ]);
  assert.equal(h.gold.get('target'), 1000 - 901);
  const distributed = (h.gold.get('atk') ?? 0) + (h.gold.get('brb') ?? 0) + (h.gold.get('crd') ?? 0);
  assert.equal(distributed, 901); // nothing created or lost
});

test('reparations cannot exceed the surrendered treasury', () => {
  const h = harness({ ...collapse, cities: [city('t1', 'target')], gold: { target: 150, atk: 0 } });
  const result = h.system.applyCapitulation('atk', 'target', 5000);
  assert.equal(result.reparationsPaid, 150);
  assert.equal(h.gold.get('target'), 0);
  assert.equal(h.gold.get('atk'), 150);
});

test('capitulation restores conquered cities toward their founders', () => {
  const h = harness({
    ...collapse,
    activeNations: ['target', 'atk', 'founderX'],
    cities: [
      city('own', 'target', { originNationId: 'target' }),         // stays with target
      city('conquered', 'target', { originNationId: 'founderX' }), // target holds a city it took from founderX → returns
      city('lost', 'atk', { originNationId: 'target' }),           // enemy holds a city target founded → returns to target
    ],
    gold: { target: 100 },
  });
  const result = h.system.applyCapitulation('atk', 'target', 0);
  assert.ok(result.restoredCityIds.includes('conquered'));
  assert.ok(result.restoredCityIds.includes('lost'));
  assert.ok(!result.restoredCityIds.includes('own'));
  assert.equal(h.cities.get('conquered')!.ownerId, 'founderX');
  assert.equal(h.cities.get('lost')!.ownerId, 'target');
  assert.equal(h.cities.get('own')!.ownerId, 'target');
});

test('capitulation ends all of the surrendered nation\'s wars and starts peace treaties', () => {
  const h = harness({
    ...collapse,
    warring: { target: ['atk', 'brb'], atk: ['target'], brb: ['target'] },
    cities: [city('t1', 'target')],
    gold: { target: 100 },
  });
  const result = h.system.applyCapitulation('atk', 'target', 0);
  assert.deepEqual(result.formerEnemyIds, ['atk', 'brb']);
  // respondToPeace(target, enemy, true) both ends the war and begins the Peace Treaty.
  assert.deepEqual(h.respondCalls.sort(), [['target', 'atk', true], ['target', 'brb', true]].sort());
});

test('accepted capitulation creates a lasting vassal relationship and canonical log', () => {
  const h = harness({ ...collapse, cities: [city('t1', 'target')], gold: { target: 100 } });
  const result = h.system.applyCapitulation('atk', 'target', 0);
  assert.equal(result.accepted, true);
  assert.equal(h.vassalHosts.get('target'), 'atk');
  assert.match(h.logs.join('\n'), /target capitulated to atk and became a vassal state\./);
});

// --- Demilitarization production block (items 6-11) --------------------------

test('demilitarization blocks only military production, and lifts after the cooldown', () => {
  const h = harness({ ...collapse, cities: [city('t1', 'target')], gold: { target: 100 }, cooldownTurns: 10, currentTurn: 100 });
  h.system.applyCapitulation('atk', 'target', 0); // demilitarized until turn 110

  assert.ok(h.system.isDemilitarized('target'));
  assert.equal(h.system.getMilitaryProductionBlockReason('target', 'warrior') !== undefined, true);
  assert.equal(h.system.getMilitaryProductionBlockReason('target', 'settler'), undefined); // civilians allowed
  assert.equal(h.system.getMilitaryProductionBlockReason('atk', 'warrior'), undefined); // other nations unaffected

  h.setTurn(110); // cooldown expired
  assert.equal(h.system.isDemilitarized('target'), false);
  assert.equal(h.system.getMilitaryProductionBlockReason('target', 'warrior'), undefined);
});

test('demilitarization state survives serialize/restore', () => {
  const h = harness({ ...collapse, cities: [city('t1', 'target')], gold: { target: 100 }, cooldownTurns: 10, currentTurn: 100 });
  h.system.applyCapitulation('atk', 'target', 0);
  const saved = h.system.serialize();

  const reloaded = harness({ currentTurn: 105 });
  reloaded.system.restore(saved);
  assert.ok(reloaded.system.isDemilitarized('target'));
  assert.equal(reloaded.system.getDemilitarizationRemaining('target'), 5);
});

// --- Rejected demand changes nothing (item 19) ------------------------------

test('a refused capitulation demand changes no game state', () => {
  const h = harness({
    ...balanced,
    cities: [city('t1', 'target', { originNationId: 'atk' })], // would-restore if it applied
    units: [{ id: 'w1', unitTypeId: 'warrior', ownerId: 'target' }],
    gold: { target: 500, atk: 0 },
    activeNations: ['target', 'atk'],
  });
  const result = h.system.applyCapitulation('atk', 'target', 300);
  assert.equal(result.accepted, false);
  assert.match(result.failureReason ?? '', /below the current acceptance threshold/);
  assert.equal(h.units.get('target')!.length, 1); // no units removed
  assert.equal(h.gold.get('target'), 500); // no money moved
  assert.equal(h.gold.get('atk') ?? 0, 0);
  assert.equal(h.cities.get('t1')!.ownerId, 'target'); // no city change
  assert.deepEqual(h.respondCalls, []); // no wars ended
  assert.equal(h.system.isDemilitarized('target'), false); // no demilitarization
});

// --- ProductionSystem enqueue guard (items 7-9) -----------------------------

test('the production system refuses to queue military units for a blocked nation', () => {
  const cities = new Map<string, { ownerId: string }>([['c1', { ownerId: 'blocked' }], ['c2', { ownerId: 'free' }]]);
  const cityManager = {
    getCity: (id: string) => cities.get(id),
    getResources: () => ({ productionPerTurn: 1 }),
  } as unknown as CityManager;
  const turnManager = { on: () => {}, getCurrentRound: () => 1 } as unknown as TurnManager;
  const happiness = { getProductionModifier: () => 1 } as unknown as HappinessSystem;
  const ps = new ProductionSystem(cityManager, turnManager, happiness);
  ps.setMilitaryUnitBlockReasonProvider((nationId, unitTypeId) =>
    (nationId === 'blocked' && getUnitTypeById(unitTypeId)?.baseStrength ? 'blocked' : undefined) as string | undefined);

  const warrior: Producible = { kind: 'unit', unitType: getUnitTypeById('warrior')! };
  const settler: Producible = { kind: 'unit', unitType: getUnitTypeById('settler')! };

  ps.setProduction('c1', settler); // civilian allowed
  ps.enqueue('c1', warrior); // military refused
  assert.equal(ps.getProduction('c1')?.item.kind === 'unit'
    && (ps.getProduction('c1')?.item as { unitType: { id: string } }).unitType.id, 'settler');
  assert.equal(ps.getQueue('c1').length, 1); // warrior never entered the queue

  ps.setProduction('c1', warrior); // must not wipe the queue to insert a blocked unit
  assert.equal(ps.getQueue('c1').length, 1);

  ps.setProduction('c2', warrior); // a free nation still builds military
  assert.equal((ps.getProduction('c2')?.item as { unitType: { id: string } }).unitType.id, 'warrior');
});

// --- Forced capitulation (Fix 2B: original-capital collapse) ----------------

test('force bypasses the willingness gate and vassalizes the target to the demander', () => {
  // A balanced war never accepts a normal capitulation demand (pressure < 0.42)...
  const h = harness({ ...balanced, cities: [city('t1', 'target')], activeNations: ['target', 'atk'] });
  assert.equal(h.system.evaluateCapitulationDemand('atk', 'target').accepted, false);

  // ...but a forced capitulation (the original capital crossing below its collapse
  // threshold) still applies, making the target a vassal of the demander.
  const forced = h.system.applyCapitulation('atk', 'target', 0, false, true);
  assert.equal(forced.accepted, true);
  assert.equal(h.vassalHosts.get('target'), 'atk');
});

test('force still refuses when the demander is not at war with the target', () => {
  // No war declared: the war/hierarchy integrity checks are not bypassed by force.
  const h = harness({ cities: [city('t1', 'target')], activeNations: ['target', 'atk'] });
  const forced = h.system.applyCapitulation('atk', 'target', 0, false, true);
  assert.equal(forced.accepted, false);
  assert.equal(h.vassalHosts.get('target'), undefined);
});
