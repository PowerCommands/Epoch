/**
 * Focused tests for the Workshop→Iron / Factory→Coal construction bottlenecks
 * and the Strategic Resource Demand model.
 * Run with: npx tsx --test tools/strategicResourceDemand.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CityManager } from '../src/systems/CityManager.ts';
import type { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { BuildingResourceRequirementSystem } from '../src/systems/BuildingResourceRequirementSystem.ts';
import {
  StrategicResourceDemandSystem,
  type StrategicResourceDemandContext,
} from '../src/systems/StrategicResourceDemandSystem.ts';

// --- BuildingResourceRequirementSystem ------------------------------------

function makeRequirementSystem(ownedResources: Set<string>): BuildingResourceRequirementSystem {
  const cityManager = {
    getCity: () => ({ ownerId: 'france' }),
  } as unknown as CityManager;
  const resourceAccessSystem = {
    hasResource: (_nationId: string, resourceId: string) => ownedResources.has(resourceId),
  } as unknown as ResourceAccessSystem;
  return new BuildingResourceRequirementSystem(cityManager, resourceAccessSystem);
}

test('Workshop is blocked without Iron and allowed with Iron access', () => {
  const withoutIron = makeRequirementSystem(new Set());
  assert.equal(withoutIron.getConstructionBlockReason('c1', 'workshop'), 'Requires Iron');
  assert.equal(withoutIron.hasRequiredResourceAccess('france', 'workshop'), false);

  const withIron = makeRequirementSystem(new Set(['iron']));
  assert.equal(withIron.getConstructionBlockReason('c1', 'workshop'), undefined);
  assert.equal(withIron.hasRequiredResourceAccess('france', 'workshop'), true);
});

test('Factory is blocked without Coal and allowed with Coal access', () => {
  const withoutCoal = makeRequirementSystem(new Set(['iron']));
  assert.equal(withoutCoal.getConstructionBlockReason('c1', 'factory'), 'Requires Coal');

  const withCoal = makeRequirementSystem(new Set(['coal']));
  assert.equal(withCoal.getConstructionBlockReason('c1', 'factory'), undefined);
});

test('Imported/exploitation access satisfies the requirement (canonical hasResource)', () => {
  // The system defers entirely to hasResource, so any canonical source (import,
  // Foreign Resource Exploitation, domestic) that makes hasResource true unblocks.
  const importedIron = makeRequirementSystem(new Set(['iron']));
  assert.equal(importedIron.getConstructionBlockReason('c1', 'workshop'), undefined);
});

test('Non-gated buildings never carry a resource block reason', () => {
  const system = makeRequirementSystem(new Set());
  assert.equal(system.getConstructionBlockReason('c1', 'library'), undefined);
  assert.equal(system.getConstructionBlockReason('c1', 'granary'), undefined);
});

// --- StrategicResourceDemandSystem ----------------------------------------

interface FakeState {
  cityIds: string[];
  cityBuildings: Map<string, Set<string>>;
  access: Set<string>;
  unlockedBuildings: Set<string>;
  unlockedUnits: Set<string>;
  researchedTechs: Set<string>;
  foundedCorporations: Set<string>;
}

function makeContext(state: FakeState): StrategicResourceDemandContext {
  return {
    getCityIds: () => state.cityIds,
    cityHasBuilding: (cityId, buildingId) => state.cityBuildings.get(cityId)?.has(buildingId) ?? false,
    hasResourceAccess: (_nationId, resourceId) => state.access.has(resourceId),
    isBuildingUnlocked: (_nationId, buildingId) => state.unlockedBuildings.has(buildingId),
    isUnitUnlocked: (_nationId, unitId) => state.unlockedUnits.has(unitId),
    isTechResearched: (_nationId, techId) => state.researchedTechs.has(techId),
    isCorporationFounded: (corporationId) => state.foundedCorporations.has(corporationId),
  };
}

function baseState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    cityIds: ['a', 'b', 'c'],
    cityBuildings: new Map(),
    access: new Set(),
    unlockedBuildings: new Set(),
    unlockedUnits: new Set(),
    researchedTechs: new Set(),
    foundedCorporations: new Set(),
    ...overrides,
  };
}

function ironDemand(system: StrategicResourceDemandSystem) {
  return system.getDemand('france', 'iron');
}

test('1. Workshop blocked solely by missing Iron creates Iron demand', () => {
  const state = baseState({ cityIds: ['a'], unlockedBuildings: new Set(['workshop']) });
  const system = new StrategicResourceDemandSystem(makeContext(state));
  const demand = ironDemand(system);
  assert.ok(demand, 'expected Iron demand');
  assert.equal(demand?.score, 20);
  assert.match(demand!.reasons[0].description, /Workshop blocked in 1 city/);
});

test('2. Multiple cities aggregate/increase Iron demand', () => {
  const oneCity = new StrategicResourceDemandSystem(
    makeContext(baseState({ cityIds: ['a'], unlockedBuildings: new Set(['workshop']) })),
  );
  const threeCities = new StrategicResourceDemandSystem(
    makeContext(baseState({ cityIds: ['a', 'b', 'c'], unlockedBuildings: new Set(['workshop']) })),
  );
  assert.equal(ironDemand(oneCity)?.score, 20);
  assert.equal(ironDemand(threeCities)?.score, 60);
  assert.match(ironDemand(threeCities)!.reasons[0].description, /blocked in 3 cities/);
});

test('3. Factory blocked solely by Coal creates Coal demand', () => {
  const system = new StrategicResourceDemandSystem(
    makeContext(baseState({ unlockedBuildings: new Set(['factory']) })),
  );
  const coal = system.getDemand('france', 'coal');
  assert.ok(coal);
  assert.match(coal!.reasons[0].description, /Factory blocked in 3 cities/);
});

test('4. Iron and Coal demand can coexist', () => {
  const system = new StrategicResourceDemandSystem(
    makeContext(baseState({ unlockedBuildings: new Set(['workshop', 'factory']) })),
  );
  const demands = system.getDemands('france');
  assert.ok(demands.some((d) => d.resourceId === 'iron'));
  assert.ok(demands.some((d) => d.resourceId === 'coal'));
});

test('5. Military + building reasons aggregate into one Iron entry', () => {
  const state = baseState({
    cityIds: ['a'],
    unlockedBuildings: new Set(['workshop']),
    unlockedUnits: new Set(['swordsman', 'longswordsman']), // both require Iron
  });
  const system = new StrategicResourceDemandSystem(makeContext(state));
  const demand = ironDemand(system);
  assert.ok(demand);
  // Exactly one Iron entry, with both a production-building and a military reason.
  assert.equal(system.getDemands('france').filter((d) => d.resourceId === 'iron').length, 1);
  assert.ok(demand!.reasons.some((r) => r.source === 'production-building'));
  assert.ok(demand!.reasons.some((r) => r.source === 'military-unit'));
  // 1 city (20) + 2 unit types (16) = 36.
  assert.equal(demand!.score, 36);
});

test('6. Obtaining Iron removes Workshop-related Iron demand', () => {
  const withIron = new StrategicResourceDemandSystem(
    makeContext(baseState({ unlockedBuildings: new Set(['workshop']), access: new Set(['iron']) })),
  );
  assert.equal(ironDemand(withIron), undefined);
});

test('7. Obtaining Coal removes Factory-related Coal demand', () => {
  const withCoal = new StrategicResourceDemandSystem(
    makeContext(baseState({ unlockedBuildings: new Set(['factory']), access: new Set(['coal']) })),
  );
  assert.equal(withCoal.getDemand('france', 'coal'), undefined);
});

test('8. Losing access recreates demand', () => {
  const state = baseState({ unlockedBuildings: new Set(['workshop']), access: new Set(['iron']) });
  const system = new StrategicResourceDemandSystem(makeContext(state));
  assert.equal(ironDemand(system), undefined);
  state.access.delete('iron'); // embargo cuts the import
  assert.ok(ironDemand(system), 'demand returns after access lost');
});

test('9. Corporation opportunity (Steel Goods) aggregates into Iron and Coal', () => {
  // Krupp Industries requires coal + iron and produces Steel Goods.
  const state = baseState({
    unlockedBuildings: new Set(['workshop', 'factory']),
    researchedTechs: new Set(['industrialization', 'engineering']),
  });
  const system = new StrategicResourceDemandSystem(makeContext(state));
  const iron = system.getDemand('france', 'iron');
  const coal = system.getDemand('france', 'coal');
  assert.ok(iron!.reasons.some((r) => r.description.includes('Steel Goods')));
  assert.ok(coal!.reasons.some((r) => r.description.includes('Steel Goods')));
  // Roman Engineering Guild (Tools) also needs Iron once engineering is researched.
  assert.ok(iron!.reasons.some((r) => r.description.includes('Tools')));
});

test('10. A nation that has not unlocked Workshop does not demand Iron for it', () => {
  const system = new StrategicResourceDemandSystem(
    makeContext(baseState({ unlockedBuildings: new Set() })),
  );
  assert.equal(ironDemand(system), undefined);
});

test('11. A nation that has not unlocked Factory does not demand Coal for it', () => {
  const system = new StrategicResourceDemandSystem(
    makeContext(baseState({ unlockedBuildings: new Set() })),
  );
  assert.equal(system.getDemand('france', 'coal'), undefined);
});

test('Production bottleneck outranks a single optional military unit', () => {
  const workshopState = baseState({ cityIds: ['a', 'b'], unlockedBuildings: new Set(['workshop']) });
  const workshop = new StrategicResourceDemandSystem(makeContext(workshopState));
  const militaryOnly = new StrategicResourceDemandSystem(
    makeContext(baseState({ cityIds: [], unlockedUnits: new Set(['horseman']) })),
  );
  assert.ok(
    ironDemand(workshop)!.score > (militaryOnly.getDemand('france', 'horses')?.score ?? 0),
  );
});

test('Demands are returned ranked by score (highest first)', () => {
  const state = baseState({
    cityIds: ['a', 'b', 'c'],
    unlockedBuildings: new Set(['workshop']), // Iron: 60
    unlockedUnits: new Set(['horseman']), // Horses: 8
  });
  const demands = new StrategicResourceDemandSystem(makeContext(state)).getDemands('france');
  assert.equal(demands[0].resourceId, 'iron');
  assert.ok(demands[0].score >= demands[demands.length - 1].score);
});

test('Diagnostics: compact summary and transition logging', () => {
  const state = baseState({ cityIds: ['a'], unlockedBuildings: new Set(['workshop']) });
  const logs: string[] = [];
  const system = new StrategicResourceDemandSystem(makeContext(state), (m) => logs.push(m));

  assert.equal(system.getDemandSummaryText('france'), 'Iron=20');

  system.logTransitions('france', 'France');
  assert.ok(logs.some((l) => /created: Iron=20/.test(l)));

  logs.length = 0;
  state.access.add('iron'); // obtained
  system.logTransitions('france', 'France');
  assert.ok(logs.some((l) => /resolved: Iron/.test(l)));
});
