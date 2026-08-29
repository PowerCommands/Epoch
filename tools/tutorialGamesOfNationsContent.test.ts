/** Content-level checks for Games of Nations documentation in the in-game Tutorial. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { TUTORIAL_SECTIONS } from '../src/data/tutorialContent.ts';

function sectionText(id: string): string {
  const section = TUTORIAL_SECTIONS.find((candidate) => candidate.id === id);
  assert.ok(section, `${id} Tutorial section must remain available`);
  return section.blocks.map((block) => {
    if (block.kind === 'list') return block.items.join('\n');
    if ('text' in block) return block.text;
    return '';
  }).join('\n');
}

test('Games of Nations is a dedicated, scroll-safe major Tutorial topic', () => {
  assert.equal(TUTORIAL_SECTIONS.filter((section) => section.id === 'games-of-nations').length, 1);
  assert.equal(TUTORIAL_SECTIONS.find((section) => section.id === 'games-of-nations')?.title, 'Games of Nations');
  assert.ok(
    TUTORIAL_SECTIONS.findIndex((section) => section.id === 'games-of-nations')
      > TUTORIAL_SECTIONS.findIndex((section) => section.id === 'culture'),
  );
  const supportedKinds = new Set(['paragraph', 'heading', 'list', 'note', 'image', 'cheat-commands']);
  const section = TUTORIAL_SECTIONS.find((candidate) => candidate.id === 'games-of-nations')!;
  assert.ok(section.blocks.every((block) => supportedKinds.has(block.kind)));
  assert.equal(new Set(TUTORIAL_SECTIONS.map((candidate) => candidate.id)).size, TUTORIAL_SECTIONS.length);
  const view = readFileSync(new URL('../src/ui/TutorialView.ts', import.meta.url), 'utf8');
  assert.match(view, /for \(const section of TUTORIAL_SECTIONS\)/, 'the topic must use existing navigation');
  assert.match(view, /overflow-y: auto/, 'long Tutorial topics must remain scrollable');
});

test('founding, cycle, participation and Games Point rules are documented', () => {
  const text = sectionText('games-of-nations');
  assert.match(text, /Games Of Nations culture, formerly called Games and Recreation/);
  assert.match(text, /first opportunity to host/);
  assert.match(text, /10-turn Preparation/);
  assert.match(text, /one sport resolved per turn/);
  assert.match(text, /10-turn Cooldown/);
  assert.match(text, /choose whether your nation will participate/);
  assert.match(text, /1 successfully invested Culture generates 10 Games Points/);
  assert.match(text, /1 successfully invested base Production generates 10 GP/);
  assert.match(text, /all-or-nothing basis/);
  assert.match(text, /not spent from accumulated progress/);
  assert.match(text, /before percentage bonuses/);
  assert.match(text, /cannot be withdrawn, moved to another sport or returned/);
  assert.match(text, /Distribute Remaining Evenly/);
  assert.match(text, /automatically distributed evenly/);
});

test('sports, weighted medals, scoring and history are documented accurately', () => {
  const text = sectionText('games-of-nations');
  for (const sport of ['Wrestling', 'Marathon', 'Swimming', 'Javelin', 'Long Jump', 'Horse Racing', 'Boxing', '100 Metres', 'Pole Vault', 'Fencing']) {
    assert.match(text, new RegExp(sport));
  }
  assert.match(text, /largest investment is favored but does not guarantee victory/);
  assert.match(text, /Gold at 5 points, Silver at 3 and Bronze at 1/);
  assert.match(text, /points, Gold medals, Silver medals and then nation name/);
  assert.match(text, /Games of Nations Medal League/);
  assert.match(text, /Rank, Gold, Silver, Bronze and total Medals/);
  assert.match(text, /Games of Nations Tournament History/);
  assert.match(text, /Year, Host Nation, Host City and Winner/);
});

test('hosting, stadium reuse and the fixed host advantage are documented', () => {
  const text = sectionText('games-of-nations');
  assert.match(text, /accept or decline/);
  assert.match(text, /completed Grand Stadium before Competition begins/);
  assert.match(text, /Games are cancelled and no sports or medals are awarded/);
  assert.match(text, /reuse a completed Grand Stadium/);
  assert.match(text, /equals a normal Stadium/);
  assert.match(text, /both buildings are present their normal Happiness benefits stack/);
  assert.match(text, /10% of the other participants’ combined initial GP commitment/);
  assert.match(text, /choice is fixed/);
});

test('sport expansion, preferences, Gossip and Chronicle coverage are documented', () => {
  const text = sectionText('games-of-nations');
  for (const era of ['Renaissance', 'Industrial', 'Modern', 'Atomic', 'Information', 'Future']) {
    assert.match(text, new RegExp(era));
  }
  assert.match(text, /Gold auction/);
  assert.match(text, /Only the winning nation pays/);
  assert.match(text, /AI nations submit their proposals first/);
  assert.match(text, /abstain, nominate an available sport or submit a bid above/);
  assert.match(text, /one traditional sport and one additional sport/);
  assert.match(text, /Which sports do you prefer/);
  assert.match(text, /remembered as Known Information/);
  assert.match(text, /before that sport has joined the Games/);
  assert.match(text, /Epoch Chronicle/);
  assert.match(text, /historical record/);
});

test('both World Council resolutions and their Competition restriction are documented', () => {
  const text = sectionText('games-of-nations');
  assert.match(text, /Games of Nations Hosting Resolution/);
  assert.match(text, /Previous Games investments.*are not refunded/);
  assert.match(text, /permanent infrastructure.*is not destroyed/);
  assert.match(text, /Games of Nations Participation Resolution/);
  assert.match(text, /Even the host can be excluded/);
  assert.match(text, /exclusion lasts for that Games only/);
  assert.match(text, /After Competition begins, neither host replacement nor participant exclusion is available/);
});

test('Cultural Victory states the normal gates, timing exceptions and overwhelming route', () => {
  const victory = sectionText('victory');
  const games = sectionText('games-of-nations');
  assert.match(victory, /normally achieves Cultural Victory while it is the reigning winner of the most recently completed Games of Nations/);
  assert.match(victory, /Winning the Games does not grant Cultural Victory by itself/);
  assert.match(victory, /Accumulate at least 75,000 Culture/);
  assert.match(victory, /at least 8 completed, unbroken World Wonders/);
  assert.match(victory, /currency ranked Dominant/);
  assert.match(victory, /overwhelming cultural dominance upon reaching 250,000 Culture/);
  assert.match(victory, /regardless of its Wonder count, currency status or Games of Nations champion status/);
  assert.match(victory, /another nation wins a later Games.*previous champion loses/);
  assert.match(victory, /Exclusion from an upcoming Games does not immediately remove/);
  assert.match(victory, /cancelled Games creates no new champion/);
  assert.match(victory, /See Games of Nations/);
  assert.match(games, /See Victory & Objectives/);
});
