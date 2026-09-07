import assert from 'node:assert/strict';
import test from 'node:test';
import { orderScenarios, saveScenarioOrder } from '../public/shared/scenario-order.js';

const entries = [{ key: 'map_b' }, { key: 'map_a' }, { key: 'custom-c' }];
test('missing and malformed ordering preserve deterministic source order', () => {
  for (const raw of [null, '{broken', '{}', 'null']) {
    assert.deepEqual(orderScenarios(entries, { getItem: () => raw }), entries);
  }
  assert.deepEqual(orderScenarios(entries, { getItem: () => { throw Error('denied'); } }), entries);
});

test('saved order mixes manifest and custom IDs, survives reload and appends new maps', () => {
  let raw = '';
  saveScenarioOrder([entries[2], entries[1], entries[0]], { setItem: (_, value) => { raw = value; } });
  assert.deepEqual(orderScenarios([...entries, { key: 'new' }], { getItem: () => raw }).map(e => e.key), ['custom-c', 'map_a', 'map_b', 'new']);
  assert.deepEqual(entries.map(e => e.key), ['map_b', 'map_a', 'custom-c']);
});

test('removed, duplicate and invalid IDs do not hide or duplicate scenarios', () => {
  const ordered = orderScenarios(entries, { getItem: () => '["deleted", "map_a", "map_a", 12]' });
  assert.deepEqual(ordered.map(e => e.key), ['map_a', 'map_b', 'custom-c']);
});

test('failed persistence is reported to the editor instead of silently succeeding', () => {
  assert.throws(() => saveScenarioOrder(entries, { setItem: () => { throw Error('quota'); } }), /quota/);
});
