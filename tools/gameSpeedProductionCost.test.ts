import assert from 'node:assert/strict';
import test from 'node:test';

import { FACTORY } from '../src/data/buildings.ts';
import { CORPORATIONS } from '../src/data/corporations.ts';
import { getGameSpeedById, scaleGameSpeedCost } from '../src/data/gameSpeeds.ts';
import { ECONOMIC_DEVELOPMENT } from '../src/data/projects.ts';
import { AEROSPACE_PART_PRODUCTION } from '../src/data/scienceVictory.ts';
import { WARRIOR } from '../src/data/units.ts';
import { PYRAMIDS } from '../src/data/wonders.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import type { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

test('Standard game speed preserves declared production costs', () => {
  const standard = getGameSpeedById('standard');

  assert.equal(standard.costMultiplier, 1);
  assert.equal(scaleGameSpeedCost(FACTORY.productionCost, standard), 360);
  assert.equal(scaleGameSpeedCost(1, standard), 1);
  assert.equal(scaleGameSpeedCost(1_900, standard), 1_900);
});

test('Standard preserves costs across the shared production pipeline', () => {
  const production = new ProductionSystem(
    new CityManager(),
    { on: () => {} } as unknown as TurnManager,
    {} as HappinessSystem,
    getGameSpeedById('standard'),
  );

  assert.equal(production.getCost({ kind: 'unit', unitType: WARRIOR }), WARRIOR.productionCost);
  assert.equal(production.getCost({ kind: 'building', buildingType: FACTORY }), FACTORY.productionCost);
  assert.equal(production.getCost({ kind: 'wonder', wonderType: PYRAMIDS }), PYRAMIDS.productionCost);
  assert.equal(
    production.getCost({ kind: 'corporation', corporationType: CORPORATIONS[0] }),
    CORPORATIONS[0].productionCost,
  );
  assert.equal(
    production.getCost({ kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION }),
    AEROSPACE_PART_PRODUCTION.productionCost,
  );
  assert.equal(production.getCost({
    kind: 'tradeRoute',
    connectionId: 'test-connection',
    fromCityId: 'from',
    toCityId: 'to',
    targetNationId: 'target',
    displayName: 'Test Route',
    productionCost: 75,
  }), 75);
  // Repeatable projects do not complete or accumulate a declared production cost.
  assert.equal(production.getCost({ kind: 'project', projectType: ECONOMIC_DEVELOPMENT }), 1);
});

test('other game-speed configuration remains unchanged', () => {
  assert.equal(getGameSpeedById('quick').costMultiplier, 0.50);
  assert.equal(getGameSpeedById('epic').costMultiplier, 0.67);
  assert.equal(getGameSpeedById('marathon').costMultiplier, 1.00);
});
