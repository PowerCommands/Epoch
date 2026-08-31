import assert from 'node:assert/strict';
import test from 'node:test';
import { RightSidebarPanelDataProvider } from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { VassalIndependenceSystem } from '../src/systems/diplomacy/VassalIndependenceSystem.ts';
import type { CapitulationSystem } from '../src/systems/CapitulationSystem.ts';

const HUMAN = 'human';
const OTHER = 'other';

/** Build a provider exercising only the audience diplomacy path; unused deps are inert stubs. */
function buildProvider(humanGold = 0) {
  let round = 0;
  const gold = new Map([[HUMAN, humanGold], [OTHER, 0]]);
  const nationManager = {
    getNation: (id: string) => ({ id, name: id, color: 0x336699 }),
    getResources: (id: string) => ({ gold: gold.get(id) ?? 0 }),
  } as unknown as NationManager;
  const inert = undefined as never;
  const provider = new RightSidebarPanelDataProvider(
    inert, inert, inert, nationManager, inert, HUMAN, inert, inert, inert,
  );
  const clock = { getCurrentRound: () => round } as unknown as TurnManager;
  const diplomacy = new DiplomacyManager(clock, 10);
  provider.setDiplomacyManager(diplomacy);
  provider.setVassalIndependenceSystem(new VassalIndependenceSystem(diplomacy, {
    getGold: (id) => gold.get(id) ?? 0,
    transferGold: (from, to, amount) => {
      if ((gold.get(from) ?? 0) < amount) return false;
      gold.set(from, (gold.get(from) ?? 0) - amount);
      gold.set(to, (gold.get(to) ?? 0) + amount);
      return true;
    },
  }));
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

test('a vassal sees an authoritative war block while its human host sees Release Vassal', () => {
  const vassal = buildProvider();
  vassal.diplomacy.establishVassal(HUMAN, OTHER);
  const vassalRows = vassal.provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string; disabledReason?: string }>;
  assert.match(allText(vassalRows), /A vassal state cannot declare war\./);
  assert.equal(vassal.diplomacy.declareWar(HUMAN, 'third'), false);
  assert.equal(vassal.diplomacy.forceDeclareWar(HUMAN, 'third'), false);

  const host = buildProvider();
  host.diplomacy.establishVassal(OTHER, HUMAN);
  const hostRows = host.provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string }>;
  assert.ok(buttonTexts(hostRows).includes('Release Vassal'));
  assert.match(allText(hostRows), /host cannot declare war on its own vassal/i);
});

test('human vassal Audience identifies its Host State and exposes priced independence purchase', () => {
  const poor = buildProvider(199_999);
  poor.diplomacy.establishVassal(HUMAN, OTHER);
  const poorStatus = poor.provider.getAudienceStatusRows(OTHER) as Array<{ kind: string; text?: string }>;
  assert.match(allText(poorStatus), /Host State/);
  const poorActions = poor.provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string; disabledReason?: string }>;
  assert.ok(buttonTexts(poorActions).includes('Buy Independence – 200,000 Gold'));
  assert.match(allText(poorActions), /Requires 200,000 Gold/);

  const rich = buildProvider(200_000);
  rich.diplomacy.establishVassal(HUMAN, OTHER);
  const richActions = rich.provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string; disabledReason?: string }>;
  const buy = richActions.find((row) => row.text === 'Buy Independence – 200,000 Gold');
  assert.equal(buy?.disabledReason, undefined);
});

test('a human in a decisively lost war can choose capitulation instead of being auto-defeated', () => {
  const h = buildProvider();
  h.diplomacy.declareWar(OTHER, HUMAN);
  h.provider.setCapitulationSystem({
    canDemandCapitulation: () => false,
    evaluateCapitulationDemand: (demanding: string, target: string) => ({
      accepted: demanding === OTHER && target === HUMAN,
    }),
  } as unknown as CapitulationSystem);
  const rows = h.provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string }>;
  assert.ok(buttonTexts(rows).includes('Capitulate'));
});
