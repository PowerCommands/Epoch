/**
 * Verifies manufactured-resource producer integrity after removing the
 * orphaned `finance` resource, plus the inverse producer validation.
 * Run with: npx tsx --test tools/manufacturedResourceProducers.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CORPORATIONS,
  validateCorporationDefinitions,
  type CorporationDefinition,
} from '../src/data/corporations.ts';
import {
  MANUFACTURED_RESOURCES,
  getManufacturedResourceById,
} from '../src/data/manufacturedResources.ts';

test('finance manufactured resource is removed', () => {
  assert.equal(getManufacturedResourceById('finance'), undefined);
  assert.ok(!MANUFACTURED_RESOURCES.some((resource) => resource.id === 'finance'));
});

test('finance is not produced or referenced by any corporation', () => {
  assert.ok(!CORPORATIONS.some((corporation) => corporation.manufacturedResourceId === 'finance'));
});

test('banking_services remains unchanged', () => {
  const banking = getManufacturedResourceById('banking_services');
  assert.deepEqual(banking, {
    id: 'banking_services',
    name: 'Banking Services',
    category: 'manufactured',
    tradeGoldPerTurn: 5,
  });
});

test('all shipped corporations and manufactured resources validate', () => {
  assert.deepEqual(validateCorporationDefinitions(), []);
});

test('inverse validation catches an orphaned manufactured resource', () => {
  // `finance` is no longer defined; simulate an orphan by keeping the shipped
  // corporations but adding a manufactured resource with no producer.
  const orphanId = 'orphaned_test_product';
  const original = [...MANUFACTURED_RESOURCES];
  MANUFACTURED_RESOURCES.push({
    id: orphanId,
    name: 'Orphaned Test Product',
    category: 'manufactured',
    tradeGoldPerTurn: 1,
  });
  try {
    const errors = validateCorporationDefinitions(CORPORATIONS);
    assert.ok(
      errors.some((error) => error === `Manufactured resource has no producer: ${orphanId}`),
      `expected a no-producer error for ${orphanId}, got: ${errors.join(', ')}`,
    );
  } finally {
    MANUFACTURED_RESOURCES.length = 0;
    MANUFACTURED_RESOURCES.push(...original);
  }
});

test('a corporation referencing a missing manufactured resource still fails', () => {
  const brokenCorporation: CorporationDefinition = {
    ...CORPORATIONS[0],
    id: 'broken_corp',
    manufacturedResourceId: 'finance',
  };
  const errors = validateCorporationDefinitions([...CORPORATIONS, brokenCorporation]);
  assert.ok(
    errors.some((error) => error.includes('unknown manufactured resource: finance')),
    `expected unknown-manufactured-resource error, got: ${errors.join(', ')}`,
  );
});
