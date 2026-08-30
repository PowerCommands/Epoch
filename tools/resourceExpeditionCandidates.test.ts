/**
 * Focused tests for resource-driven overseas expedition candidates: registration,
 * priority, revalidation/pruning, departure inertia, and unit-release-on-cancel.
 * Run with: npx tsx --test tools/resourceExpeditionCandidates.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SETTLER } from '../src/data/units.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import {
  AIOverseasExpansionSystem,
  type ResourceExpeditionCandidate,
} from '../src/systems/AIOverseasExpansionSystem.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import type { MovementSystem } from '../src/systems/MovementSystem.ts';
import type { PathfindingSystem } from '../src/systems/PathfindingSystem.ts';
import type { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import type { WorldMarkerSystem } from '../src/systems/WorldMarkerSystem.ts';
import type { MapData } from '../src/types/map.ts';
import type { OverseasSettlementTarget } from '../src/types/ai/OverseasSettlementTarget.ts';

const NATION = 'france';

function stub<T>(overrides: Partial<T> = {}): T {
  return overrides as unknown as T;
}

function makeSystem(units = new UnitManager(4, 4)) {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'France', color: 0x224466 }));
  const system = new AIOverseasExpansionSystem(
    stub<WorldMarkerSystem>(),
    nations,
    stub<CityManager>({}),
    stub<TurnManager>({ getCurrentRound: () => 5 }),
    stub<MapData>({}),
    stub<ProductionSystem>({}),
    units,
    stub<MovementSystem>({}),
    stub<PathfindingSystem>({}),
    stub<IGridSystem>({}),
    undefined,
    (_nationId: string, message: string) => message,
  );
  return { system, nations, units };
}

function candidate(overrides: Partial<ResourceExpeditionCandidate> = {}): ResourceExpeditionCandidate {
  return { resourceId: 'iron', resourceName: 'Iron', x: 120, y: 40, demandScore: 92, ...overrides };
}

/** Direct access to the nation's internal target array (getKnownIslandTargets returns copies). */
function rawTargets(nations: NationManager): OverseasSettlementTarget[] {
  return nations.getNation(NATION)!.knownIslandTargets ?? [];
}

test('1. A significant neutral-overseas candidate registers an expedition target', () => {
  const { system } = makeSystem();
  system.refreshResourceExpeditionTargets(NATION, [candidate()]);
  const targets = system.getKnownIslandTargets(NATION);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].source, 'resource');
  assert.equal(targets[0].status, 'candidate');
  assert.equal(targets[0].priority, 92);
  assert.deepEqual({ x: targets[0].targetX, y: targets[0].targetY }, { x: 120, y: 40 });
});

test('6. Multiple resource opportunities coexist as candidates (no extra launch)', () => {
  const { system } = makeSystem();
  system.refreshResourceExpeditionTargets(NATION, [
    candidate({ resourceId: 'iron', resourceName: 'Iron', x: 120, y: 40, demandScore: 92 }),
    candidate({ resourceId: 'coal', resourceName: 'Coal', x: 145, y: 62, demandScore: 70 }),
  ]);
  const targets = system.getKnownIslandTargets(NATION);
  assert.equal(targets.length, 2);
  // Selection (one active) is the existing runTurn's job; refresh never selects.
  assert.ok(targets.every((t) => t.selected === false));
});

test('Priority tracks the current demand score on refresh', () => {
  const { system } = makeSystem();
  system.refreshResourceExpeditionTargets(NATION, [candidate({ demandScore: 92 })]);
  system.refreshResourceExpeditionTargets(NATION, [candidate({ demandScore: 61 })]);
  const targets = system.getKnownIslandTargets(NATION);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].priority, 61);
});

test('7/8. A candidate that is no longer valid is removed before departure', () => {
  const { system } = makeSystem();
  system.refreshResourceExpeditionTargets(NATION, [candidate()]);
  assert.equal(system.getKnownIslandTargets(NATION).length, 1);
  system.refreshResourceExpeditionTargets(NATION, []); // demand resolved / no longer neutral-overseas
  assert.equal(system.getKnownIslandTargets(NATION).length, 0);
});

test('9/10. Already-produced Settler is released (not deleted) when preparation is cancelled', () => {
  const units = new UnitManager(4, 4);
  const { system, nations } = makeSystem(units);
  system.refreshResourceExpeditionTargets(NATION, [candidate()]);

  // Simulate the existing pipeline having produced + assigned a Settler while preparing.
  const settler = new Unit({ id: 'settler-1', name: 'Settler', ownerId: NATION, unitType: SETTLER, tileX: 1, tileY: 1 });
  units.addUnit(settler);
  const target = rawTargets(nations)[0];
  target.status = 'expeditionPreparing';
  target.assignedSettlerUnitId = settler.id;

  system.refreshResourceExpeditionTargets(NATION, []); // strategic reason disappears pre-departure

  assert.equal(system.getKnownIslandTargets(NATION).length, 0, 'candidate removed');
  assert.ok(units.getUnit('settler-1') !== undefined, 'produced Settler is NOT deleted');
});

test('10/13. A departed expedition keeps its inertia when demand disappears', () => {
  const { system, nations } = makeSystem();
  system.refreshResourceExpeditionTargets(NATION, [candidate()]);
  const target = rawTargets(nations)[0];
  target.status = 'enRoute'; // Cargo Ship already sailing with Settler embarked

  system.refreshResourceExpeditionTargets(NATION, []); // Iron acquired elsewhere mid-voyage

  const targets = system.getKnownIslandTargets(NATION);
  assert.equal(targets.length, 1, 'underway expedition is not cancelled');
  assert.equal(targets[0].status, 'enRoute');
});

test('19. Non-resource (marker/normal) targets are untouched by resource refresh', () => {
  const { system, nations } = makeSystem();
  nations.getNation(NATION)!.knownIslandTargets = [{
    markerId: 'island-1', name: 'Green Isle', targetX: 5, targetY: 5,
    source: 'marker', priority: 3, discoveredTurn: 1, selected: false, status: 'candidate',
  }];
  system.refreshResourceExpeditionTargets(NATION, [candidate()]);
  system.refreshResourceExpeditionTargets(NATION, []); // resource candidate withdrawn
  const targets = system.getKnownIslandTargets(NATION);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].markerId, 'island-1', 'ordinary expedition target survives');
});
