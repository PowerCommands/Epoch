import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPITULATION_PHRASES, createCapitulationDialogue } from '../src/systems/diplomacy/CapitulationDialogue';
import type { MilitaryVassalizationEvent } from '../src/systems/diplomacy/MilitaryVassalizationSystem';

const event: MilitaryVassalizationEvent = {
  victorNationId: 'nation_sweden', defeatedNationId: 'nation_england',
  reason: 'capitulation', inheritedVassalIds: [],
};
const name = (id: string) => id === 'nation_england' ? 'England' : 'Sweden';

test('every military surrender path gives the human victor a leader acknowledgement', () => {
  for (const reason of ['capitulation', 'capitalCapture', 'subjugation'] as const) {
    const result = createCapitulationDialogue({ ...event, reason }, event.victorNationId, name);
    assert.ok(result?.leaderId);
    assert.match(result.message, /England has been defeated and is now your vassal/);
  }
});

test('AI victories and human defeats do not show a false player victory', () => {
  for (const human of [undefined, event.defeatedNationId, 'nation_france']) {
    assert.equal(createCapitulationDialogue(event, human, name), undefined);
  }
});

test('each surrender occasion samples a fresh phrase and all six variants are reachable', () => {
  let calls = 0;
  const messages = CAPITULATION_PHRASES.map((phrase, index) => {
    const result = createCapitulationDialogue(event, event.victorNationId, name, () => {
      calls++;
      return (index + 0.5) / CAPITULATION_PHRASES.length;
    });
    assert.ok(result?.message.includes(phrase));
    return result.message;
  });
  assert.equal(calls, 6);
  assert.equal(new Set(messages).size, 6);
});
