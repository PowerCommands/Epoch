import assert from 'node:assert/strict';
import test from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { SETTLER } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { AIOverseasExpansionSystem } from '../src/systems/AIOverseasExpansionSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import type { FoundCitySystem } from '../src/systems/FoundCitySystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { OverseasSettlementTarget, OverseasTargetSource } from '../src/types/ai/OverseasSettlementTarget.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { MovementSystem } from '../src/systems/MovementSystem.ts';
import type { PathfindingSystem } from '../src/systems/PathfindingSystem.ts';
import type { WorldMarkerSystem } from '../src/systems/WorldMarkerSystem.ts';

const FRANCE = 'nation_france';
const SETTLER_ITEM = { kind: 'unit' as const, unitType: SETTLER };
const GRANARY = {
  id: 'test_granary', name: 'Granary', productionCost: 20, era: 'ancient' as const,
  requiredTechnologyId: undefined, modifiers: {}, description: '', placement: 'city' as const,
};

function stub<T>(): T {
  return {} as T;
}

function makeMap(): MapData {
  return {
    width: 5,
    height: 3,
    tileSize: 1,
    tiles: Array.from({ length: 3 }, (_, y) => (
      Array.from({ length: 5 }, (_, x): Tile => ({ x, y, type: TileType.Plains }))
    )),
  };
}

function target(source: OverseasTargetSource, founderId: string, handled = false): OverseasSettlementTarget {
  return {
    markerId: `${source}-target`,
    name: 'Madagascar',
    targetX: 3,
    targetY: 1,
    source,
    priority: 1,
    discoveredTurn: 1,
    selected: false,
    status: 'completed',
    localFollowUpSettlerUnitId: founderId,
    localFollowUpSettlerHandled: handled,
  };
}

function harness(source?: OverseasTargetSource, handled = false) {
  const map = makeMap();
  const nations = new NationManager();
  const france = new Nation({ id: FRANCE, name: 'France', color: 0x2244ff });
  nations.addNation(france);
  const cities = new CityManager();
  const paris = new City({ id: 'paris', name: 'Paris', ownerId: FRANCE, tileX: 0, tileY: 1 });
  const colony = new City({ id: 'colony', name: 'Antananarivo', ownerId: FRANCE, tileX: 3, tileY: 1 });
  cities.addCity(paris);
  cities.addCity(colony);
  const turns = new TurnManager(nations, getGameSpeedById('standard'));
  const production = new ProductionSystem(
    cities,
    turns,
    new HappinessSystem(nations, cities),
    getGameSpeedById('standard'),
    undefined,
    nations,
  );
  const units = new UnitManager(map.width, map.height);
  const founder = new Unit({
    id: 'expedition-founder', name: 'Settler', ownerId: FRANCE,
    unitType: SETTLER, tileX: colony.tileX, tileY: colony.tileY,
  });
  const listeners: Array<(city: City, foundingUnit: Unit) => void> = [];
  const foundCityHook = {
    onCityFounded: (listener: (city: City, foundingUnit: Unit) => void) => listeners.push(listener),
  } as unknown as FoundCitySystem;
  const logs: string[] = [];

  if (source) france.knownIslandTargets = [target(source, founder.id, handled)];

  const system = new AIOverseasExpansionSystem(
    stub<WorldMarkerSystem>(), nations, cities, turns, map, production, units,
    stub<MovementSystem>(), stub<PathfindingSystem>(), new HexGridSystem(), undefined,
    (_nationId, message) => message,
    (_nationId, message) => logs.push(message),
    foundCityHook,
  );

  return {
    colony,
    founder,
    logs,
    production,
    system,
    emitFounded: (city = colony, unit = founder) => listeners.forEach((listener) => listener(city, unit)),
  };
}

for (const source of ['marker', 'resource'] as const) {
  test(`${source} Cargo Ship expedition queues its local follow-up Settler in the exact founded city`, () => {
    const h = harness(source);
    h.production.enqueue(h.colony.id, { kind: 'building', buildingType: GRANARY });

    h.emitFounded();

    const queue = h.production.getQueue(h.colony.id);
    assert.deepEqual(queue.map((entry) => entry.item.kind === 'unit' ? entry.item.unitType.id : entry.item.buildingType.id), [
      SETTLER.id,
      GRANARY.id,
    ]);
    assert.equal(h.production.getQueue('paris').length, 0, 'the follow-up is not redirected nationally');
    assert.equal(h.logs.filter((line) => line.includes('EXPEDITION FOLLOW-UP:')).length, 1);
  });
}

test('the local follow-up bypasses another city occupying the nation-wide Settler slot', () => {
  const h = harness('marker');
  h.production.enqueue('paris', SETTLER_ITEM);
  assert.equal(h.production.getItemProductionBlockReason(h.colony.id, SETTLER_ITEM) !== undefined, true);

  h.emitFounded();

  assert.equal(h.production.getQueue('paris')[0]?.item.kind, 'unit');
  assert.equal(h.production.getQueue(h.colony.id)[0]?.item.kind, 'unit');
  assert.equal(h.production.getQueue(h.colony.id)[0]?.item.kind === 'unit'
    ? h.production.getQueue(h.colony.id)[0]?.item.unitType.id
    : undefined, SETTLER.id);
});

test('the persisted one-time guard prevents a second follow-up on later notifications', () => {
  const h = harness('marker');
  h.emitFounded();
  h.emitFounded();

  assert.equal(h.production.getQueue(h.colony.id).filter((entry) => (
    entry.item.kind === 'unit' && entry.item.unitType.id === SETTLER.id
  )).length, 1);
  assert.equal(h.logs.filter((line) => line.includes('EXPEDITION FOLLOW-UP:')).length, 1);
});

test('ordinary city founding receives no expedition follow-up', () => {
  const h = harness();
  h.emitFounded();
  assert.equal(h.production.getQueue(h.colony.id).length, 0);
  assert.equal(h.logs.length, 0);
});

test('resource expedition completed without a Cargo Ship receives no follow-up', () => {
  const h = harness();
  // A land/ordinary-embarkation completion has no Cargo-landing grant marker.
  h.emitFounded();
  assert.equal(h.production.getQueue(h.colony.id).length, 0);
});

test('an already handled saved expedition cannot enqueue another follow-up', () => {
  const h = harness('resource', true);
  h.emitFounded();
  assert.equal(h.production.getQueue(h.colony.id).length, 0);
});
