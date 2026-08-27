import assert from 'node:assert/strict';
import test from 'node:test';
import { RightSidebarPanelDataProvider } from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

const HUMAN = 'human';
const OTHER = 'other';

/** Build a provider exercising only the audience diplomacy path; unused deps are inert stubs. */
function buildProvider() {
  let round = 0;
  const nationManager = { getNation: () => ({ color: 0x336699 }) } as unknown as NationManager;
  const inert = undefined as never;
  const provider = new RightSidebarPanelDataProvider(
    inert, inert, inert, nationManager, inert, HUMAN, inert, inert, inert,
  );
  const clock = { getCurrentRound: () => round } as unknown as TurnManager;
  const diplomacy = new DiplomacyManager(clock, 10);
  provider.setDiplomacyManager(diplomacy);
  provider.setCurrentTurnGetter(() => round);
  return { provider, diplomacy, setTurn: (turn: number) => { round = turn; } };
}

const buttonTexts = (rows: Array<{ kind: string; text?: string }>): string[] =>
  rows.filter((row) => row.kind === 'button').map((row) => row.text ?? '');

const allText = (rows: Array<{ kind: string; text?: string; disabledReason?: string }>): string =>
  rows.map((row) => `${row.text ?? ''}|${row.disabledReason ?? ''}`).join('\n');

test('at peace, the audience shows the full peacetime diplomacy action set', () => {
  const { provider } = buildProvider();
  const rows = provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string }>;
  const texts = buttonTexts(rows);
  assert.ok(texts.includes('Open Borders'));
  assert.ok(texts.includes('Establish Embassy'));
  assert.ok(texts.includes('Exchange Maps'));
  assert.ok(texts.includes('Give Gift'));
  assert.ok(texts.includes('Declare War'));
});

test('at war, peacetime actions and their unavailable text are filtered out entirely', () => {
  const { provider, diplomacy, setTurn } = buildProvider();
  setTurn(5);
  diplomacy.declareWar(HUMAN, OTHER);

  const rows = provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string; disabledReason?: string }>;
  const texts = buttonTexts(rows);

  // War-blocked peacetime actions are gone — no disabled buttons for them.
  for (const gone of ['Open Borders', 'Cancel Open Borders', 'Establish Embassy', 'Establish Trade Relations', 'Exchange Maps']) {
    assert.ok(!texts.includes(gone), `${gone} should not appear during war`);
  }
  // No "Unavailable during war." explanatory text remains anywhere.
  assert.doesNotMatch(allText(rows), /Unavailable during war\./);
  // Only genuinely wartime-usable actions remain.
  assert.ok(texts.includes('Give Gift'));
  assert.ok(texts.includes('Propose Peace'));
  assert.ok(!texts.includes('Declare War'));
});
