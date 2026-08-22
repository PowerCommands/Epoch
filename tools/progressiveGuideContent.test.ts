import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgressiveGuideTips } from '../src/data/progressiveGuide';

const allEnabled = {
  domination: true,
  science: true,
  cultural: true,
  diplomatic: true,
};

test('guide contains exactly 50 unique ordered topics with readable pages', () => {
  const tips = buildProgressiveGuideTips({
    enabledVictories: allEnabled,
    requiredAerospaceParts: 10,
  });
  assert.equal(tips.length, 50);
  assert.equal(new Set(tips.map((tip) => tip.id)).size, 50);
  for (const tip of tips) {
    assert.ok(tip.title.trim().length > 0);
    assert.ok(tip.pages.length > 0);
    assert.ok(tip.pages.every((page) => page.body.trim().length > 0));
  }
  assert.ok(tips.some((tip) => tip.pages.length > 1));
});

test('victory tip describes only victory paths enabled for the scenario', () => {
  const tips = buildProgressiveGuideTips({
    enabledVictories: {
      domination: false,
      science: true,
      cultural: false,
      diplomatic: true,
    },
    requiredAerospaceParts: 7,
  });
  const victory = tips.find((tip) => tip.id === 'victory-conditions');
  assert.ok(victory);
  assert.deepEqual(victory.pages.map((page) => page.title), [
    'Current scenario',
    'Science',
    'Diplomatic',
  ]);
  assert.match(victory.pages[1].body, /7 Aerospace Parts/);
});
