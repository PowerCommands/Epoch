import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHER } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import type { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { getCityUnitProductionBlockReason } from '../src/systems/ProductionRules.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

function harness() {
  const city = new City({ id: 'city', name: 'City', ownerId: 'nation', tileX: 0, tileY: 0 });
  const cities = new CityManager();
  cities.addCity(city);
  const production = new ProductionSystem(cities, {
    on: () => {}, getCurrentRound: () => 1,
  } as unknown as TurnManager, { getProductionModifier: () => 1 } as unknown as HappinessSystem);
  production.enqueue(city.id, { kind: 'unit', unitType: ARCHER });
  return { city, production };
}

test('an obsolete Archer reports its actual production rule instead of a placement error', () => {
  const { city, production } = harness();
  const map: MapData = {
    width: 1, height: 1, tileSize: 1,
    tiles: [[{ x: 0, y: 0, type: TileType.Plains, ownerId: city.ownerId }]],
  };
  production.onCompleted((_cityId, item, entry) => {
    if (item.kind !== 'unit') return;
    const reason = getCityUnitProductionBlockReason(city, item.unitType, map, new HexGridSystem(), {
      getNationEra: () => 'medieval',
    });
    if (reason) {
      entry.blockedReason = reason;
      return false;
    }
  });
  const result = production.completeCurrentProduction(city.id);
  assert.equal(result.kind, 'blocked');
  if (result.kind !== 'blocked') return;
  assert.equal(result.reason, 'Archer is obsolete for medieval era production');
  assert.equal(production.getQueue(city.id)[0].blockedReason, result.reason);
  assert.equal(production.getQueue(city.id)[0].progress, 40);
  assert.deepEqual(production.completeQueueEntry(city.id, 0), { ok: false, reason: result.reason });
});

test('retries replace stale reasons and complete the waiting unit once unblocked', () => {
  const { city, production } = harness();
  let blocker: 'gold' | 'space' | undefined = 'gold';
  let completed = 0;
  production.onCompleted((_cityId, _item, entry) => {
    if (blocker === 'gold') entry.blockedReason = 'Not enough gold reserves to support this unit for 10 turns.';
    return blocker === undefined;
  });
  production.onCompletedSuccessfully(() => { completed++; });
  production.completeCurrentProduction(city.id);
  assert.match(production.getQueue(city.id)[0].blockedReason!, /Not enough gold/);
  blocker = 'space';
  production.completeCurrentProduction(city.id);
  assert.equal(production.getQueue(city.id)[0].blockedReason, 'Production blocked: no space for unit');
  assert.equal(completed, 0);
  blocker = undefined;
  assert.equal(production.completeCurrentProduction(city.id).kind, 'completed');
  assert.equal(completed, 1);
  assert.deepEqual(production.getQueue(city.id), []);
});
