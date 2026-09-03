import assert from 'node:assert/strict';
import test from 'node:test';

import { CheatSystem, type GameContext } from '../src/systems/CheatSystem.ts';
import { clampMemoryValue, RELATION_MEMORY_FIELDS } from '../src/ui/RelationsCheatDialog.ts';

function makeCheats(openRelationsDialog: () => void): CheatSystem {
  return new CheatSystem({ openRelationsDialog } as unknown as GameContext);
}

test('relations opens the relationship editor and accepts no arguments', () => {
  let opened = 0;
  const cheats = makeCheats(() => { opened += 1; });

  assert.equal(cheats.execute('relations'), 'Relations editor opened.');
  assert.equal(opened, 1);
  assert.equal(cheats.execute('relations england'), 'Usage: relations');
  assert.equal(opened, 1);
});

test('relations is included in cheat help and completion', () => {
  const cheats = makeCheats(() => {});
  assert.match(cheats.execute('help'), /^relations - Open the nation relationship memory editor\.$/m);
  assert.ok(cheats.getCompletions('rel').some((suggestion) => suggestion.value === 'relations'));
});

test('relationship editor exposes the same five 0-100 memory fields as the map editor', () => {
  assert.deepEqual(
    RELATION_MEMORY_FIELDS.map((field) => field.key),
    ['trust', 'fear', 'hostility', 'suspicion', 'affinity'],
  );
  assert.equal(clampMemoryValue(-12), 0);
  assert.equal(clampMemoryValue('42'), 42);
  assert.equal(clampMemoryValue(140), 100);
});
