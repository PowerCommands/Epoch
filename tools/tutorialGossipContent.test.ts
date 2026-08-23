/** Content-level checks for the Gossip documentation in the in-game Tutorial. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TUTORIAL_SECTIONS } from '../src/data/tutorialContent.ts';

function diplomacyText(): string {
  const section = TUTORIAL_SECTIONS.find((candidate) => candidate.id === 'diplomacy');
  assert.ok(section, 'Diplomacy Tutorial section must remain available');
  return section.blocks.map((block) => {
    if (block.kind === 'list') return block.items.join('\n');
    if ('text' in block) return block.text;
    return '';
  }).join('\n');
}

test('Gossip is documented inside the existing Diplomacy Tutorial chapter', () => {
  assert.equal(TUTORIAL_SECTIONS.filter((section) => section.id === 'diplomacy').length, 1);
  const text = diplomacyText();
  assert.match(text, /Leader Details/);
  assert.match(text, /Dialog section/);
  assert.match(text, /Arrange an audience with \{leader\}/);
  assert.match(text, /Gossip with \{leader\}/);
  assert.match(text, /Audience is for formal diplomacy/);
  assert.match(text, /Gossip is for informal conversation/);
});

test('all three Gossip categories are accurately summarized', () => {
  const text = diplomacyText();
  assert.match(text, /Gossip: Information/);
  assert.match(text, /Questions cost no Influence and never change diplomatic relations/);
  assert.match(text, /Gossip: Manipulation/);
  assert.match(text, /third nation/);
  assert.match(text, /Trust, Suspicion, Hostility, Affinity or Fear/);
  assert.match(text, /does not force an action/);
  assert.match(text, /cooldown against the same recipient/);
  assert.match(text, /Gossip: Insults/);
  assert.match(text, /Insults cost no Influence/);
  assert.match(text, /never target a third nation/);
  assert.match(text, /only when your armed forces make the threat credible/);
});

test('Culture progression and History flavor are explained without internal formulas', () => {
  const text = diplomacyText();
  assert.match(text, /Culture, rather than Technology/);
  assert.match(text, /requirement in the Gossip interface/);
  assert.match(text, /Leader Remarks in History/);
  assert.match(text, /severe hostility/);
  assert.match(text, /do not change diplomatic relations themselves/);
  assert.doesNotMatch(text, /GossipSystem|item weight|military ratio|backend|effect profile/i);
});

test('new Tutorial copy remains composed of existing scroll-safe block types', () => {
  const section = TUTORIAL_SECTIONS.find((candidate) => candidate.id === 'diplomacy')!;
  const supportedKinds = new Set(['paragraph', 'heading', 'list', 'note', 'image', 'cheat-commands']);
  assert.ok(section.blocks.every((block) => supportedKinds.has(block.kind)));
  for (const block of section.blocks) {
    if ('text' in block) assert.ok(block.text.length < 500, `${block.kind} block is too long to scan`);
    if (block.kind === 'list') assert.ok(block.items.every((item) => item.length < 180));
  }
});
