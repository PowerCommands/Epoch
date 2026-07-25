import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { DiscoverySystem } from '../src/systems/DiscoverySystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';

test('discovery detects unmet pairs, then skips all unit work once every pair has met', () => {
  const nations = new NationManager();
  for (const id of ['a', 'b', 'c']) {
    nations.addNation(new Nation({ id, name: id, color: 0 }));
  }
  let unitReads = 0;
  const units = {
    getAllUnits: () => {
      unitReads++;
      return [
        { ownerId: 'a', tileX: 0, tileY: 0 },
        { ownerId: 'b', tileX: 1, tileY: 0 },
        { ownerId: 'c', tileX: 30, tileY: 30 },
      ];
    },
  } as unknown as UnitManager;
  const cities = { getAllCities: () => [] } as unknown as CityManager;
  const discovery = new DiscoverySystem(nations, cities, units, new HexGridSystem());

  discovery.scan();
  assert.equal(discovery.hasMet('a', 'b'), true);
  assert.equal(discovery.hasMet('a', 'c'), false);
  assert.ok(unitReads > 0);

  discovery.revealNation('a', 'c');
  discovery.revealNation('b', 'c');
  unitReads = 0;
  discovery.scan();
  assert.equal(unitReads, 0);
});

test('restored met pairs also enable the all-met short circuit', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'a', name: 'a', color: 0 }));
  nations.addNation(new Nation({ id: 'b', name: 'b', color: 0 }));
  let unitReads = 0;
  const units = {
    getAllUnits: () => {
      unitReads++;
      return [];
    },
  } as unknown as UnitManager;
  const cities = { getAllCities: () => [] } as unknown as CityManager;
  const discovery = new DiscoverySystem(nations, cities, units, new HexGridSystem());

  discovery.restoreMet('a', 'b');
  discovery.restoreMet('a', 'b');
  discovery.scan();
  assert.equal(unitReads, 0);
});
