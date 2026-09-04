import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCapitulationPressurePercent,
  RightSidebarPanelDataProvider,
} from '../src/ui/phaser/RightSidebarPanelDataProvider.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { VassalIndependenceSystem } from '../src/systems/diplomacy/VassalIndependenceSystem.ts';
import {
  CAPITULATION_ACCEPTANCE_THRESHOLD,
  type CapitulationSystem,
} from '../src/systems/CapitulationSystem.ts';

const HUMAN = 'human';
const OTHER = 'other';
const THIRD = 'third';

/** Build a provider exercising only the audience diplomacy path; unused deps are inert stubs. */
function buildProvider(humanGold = 0) {
  let round = 0;
  const gold = new Map([[HUMAN, humanGold], [OTHER, 0], [THIRD, 0]]);
  const nationManager = {
    getNation: (id: string) => ({
      id,
      name: id === HUMAN ? 'England' : id === OTHER ? 'USA' : id === THIRD ? 'China' : id,
      color: 0x336699,
    }),
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
  assert.ok(!texts.includes('Give Gift'));
  assert.ok(texts.includes('Propose Peace'));
  assert.ok(!texts.includes('Declare War'));
});

test('war diagnostics are gated by Diagnostic mode and require an active war', () => {
  const { provider, diplomacy } = buildProvider();
  let computations = 0;
  provider.setCapitulationSystem({
    getAcceptanceThreshold: () => CAPITULATION_ACCEPTANCE_THRESHOLD,
    computeCapitulationPressure: () => {
      computations += 1;
      return { pressure: 0.4, factors: { warPressure: 0.12, militaryCollapse: 0.18, attrition: 0.06, territorialCollapse: 0.04 } };
    },
  } as unknown as CapitulationSystem);

  assert.deepEqual(provider.getAudienceWarDiagnosticRows(OTHER, false), []);
  assert.deepEqual(provider.getAudienceWarDiagnosticRows(OTHER, true), []);
  assert.equal(computations, 0);

  diplomacy.declareWar(HUMAN, OTHER);
  assert.deepEqual(provider.getAudienceWarDiagnosticRows(OTHER, false), []);
  assert.equal(computations, 0);
  assert.ok(provider.getAudienceWarDiagnosticRows(OTHER, true).length > 0);
  assert.equal(computations, 1);
});

test('capitulation pressure normalization maps the acceptance threshold to 100 percent', () => {
  const threshold = CAPITULATION_ACCEPTANCE_THRESHOLD;
  assert.equal(normalizeCapitulationPressurePercent(0, threshold), 0);
  assert.equal(normalizeCapitulationPressurePercent(threshold / 2, threshold), 50);
  assert.equal(normalizeCapitulationPressurePercent(threshold, threshold), 100);
  assert.equal(normalizeCapitulationPressurePercent(threshold * 1.5, threshold), 100);
  assert.equal(normalizeCapitulationPressurePercent(0.25, 0.5), 50);
  assert.equal(normalizeCapitulationPressurePercent(0.5, 0.5), 100);
  assert.equal(normalizeCapitulationPressurePercent(0.7, 0.9), 78);
});

test('Audience diagnostics read normalization from the CapitulationSystem instance', () => {
  const { provider, diplomacy } = buildProvider();
  diplomacy.declareWar(HUMAN, OTHER);
  provider.setCapitulationSystem({
    getAcceptanceThreshold: () => 0.5,
    computeCapitulationPressure: () => ({
      pressure: 0.25,
      factors: { warPressure: 0.1, militaryCollapse: 0.05, attrition: 0.05, territorialCollapse: 0.05 },
    }),
  } as unknown as CapitulationSystem);

  const rows = provider.getAudienceWarDiagnosticRows(OTHER, true) as Array<{
    kind: string;
    current?: number;
    valueText?: string;
  }>;
  const progress = rows.find((row) => row.kind === 'progress');
  assert.equal(progress?.current, 50);
  assert.equal(progress?.valueText, '50%');
});

test('war diagnostics cover human, AI, and simultaneous enemies with additive displayed factors', () => {
  const { provider, diplomacy } = buildProvider();
  diplomacy.declareWar(HUMAN, OTHER);
  diplomacy.declareWar(OTHER, THIRD);
  const calls: Array<[string, string]> = [];
  provider.setCapitulationSystem({
    getAcceptanceThreshold: () => CAPITULATION_ACCEPTANCE_THRESHOLD,
    computeCapitulationPressure: (target: string, demander: string) => {
      calls.push([target, demander]);
      return demander === HUMAN
        ? { pressure: 0.4, factors: { warPressure: 0.12, militaryCollapse: 0.18, attrition: 0.06, territorialCollapse: 0.04 } }
        : { pressure: 0.5, factors: { warPressure: 0.11, militaryCollapse: 0.12, attrition: 0.13, territorialCollapse: 0.14 } };
    },
  } as unknown as CapitulationSystem);

  const rows = provider.getAudienceWarDiagnosticRows(OTHER, true) as Array<{
    kind: string;
    text?: string;
    rows?: string[][];
  }>;
  assert.deepEqual(calls.sort(), [[OTHER, HUMAN], [OTHER, THIRD]].sort());
  assert.ok(rows.some((row) => row.text === 'DIAGNOSTIC — CAPITULATION'));
  assert.ok(rows.some((row) => row.text === 'vs England'));
  assert.ok(rows.some((row) => row.text === 'vs China'));

  const progressRows = rows.filter((row) => row.kind === 'progress') as Array<{
    current?: number;
    valueText?: string;
  }>;
  assert.deepEqual(progressRows.map((row) => row.current), [71, 57]);
  assert.deepEqual(progressRows.map((row) => row.valueText), ['71%', '57%']);
  assert.equal(rows.filter((row) => row.text === 'Pressure breakdown').length, 2);

  const tables = rows.filter((row) => row.kind === 'compactTable');
  assert.equal(tables.length, 2);
  for (const table of tables) {
    const values = new Map(table.rows!.map(([label, value]) => [label, Number(value)]));
    const factorSum = ['War Pressure', 'Military Collapse', 'Attrition', 'Territorial Collapse']
      .reduce((sum, label) => sum + values.get(label)!, 0);
    assert.equal(Number(factorSum.toFixed(2)), values.get('Internal Total'));
    assert.equal(values.has('Demand Threshold'), false);
    assert.equal(values.has('Acceptance Threshold'), false);
  }
});

test('diagnostic readiness reaches 100 percent at the acceptance threshold and remains clamped above it', () => {
  const { provider, diplomacy } = buildProvider();
  diplomacy.declareWar(HUMAN, OTHER);
  let pressure = CAPITULATION_ACCEPTANCE_THRESHOLD;
  provider.setCapitulationSystem({
    getAcceptanceThreshold: () => CAPITULATION_ACCEPTANCE_THRESHOLD,
    computeCapitulationPressure: () => ({
      pressure,
      factors: { warPressure: pressure, militaryCollapse: 0, attrition: 0, territorialCollapse: 0 },
    }),
  } as unknown as CapitulationSystem);

  const readiness = () => provider.getAudienceWarDiagnosticRows(OTHER, true) as Array<{
    kind: string;
    text?: string;
    current?: number;
  }>;
  let rows = readiness();
  assert.equal(rows.find((row) => row.kind === 'progress')?.current, 100);
  assert.ok(rows.some((row) => row.text === 'READY TO CAPITULATE'));

  pressure = CAPITULATION_ACCEPTANCE_THRESHOLD + 0.2;
  rows = readiness();
  assert.equal(rows.find((row) => row.kind === 'progress')?.current, 100);
  assert.ok(rows.some((row) => row.text === 'READY TO CAPITULATE'));
});

test('Demand Capitulation is hidden below acceptance and appears only for an accepted demand', () => {
  const { provider, diplomacy } = buildProvider();
  diplomacy.declareWar(HUMAN, OTHER);
  const pressure = 0.32;
  let runtimeThreshold = 0.5;
  provider.setCapitulationSystem({
    evaluateCapitulationDemand: (demanding: string, target: string) => ({
      accepted: demanding === HUMAN && target === OTHER && pressure >= runtimeThreshold,
    }),
  } as unknown as CapitulationSystem);

  let rows = provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string }>;
  assert.ok(!buttonTexts(rows).includes('Demand Capitulation'));
  runtimeThreshold = 0.2;
  rows = provider.getAudienceDiplomacyActionRows(OTHER) as Array<{ kind: string; text?: string }>;
  assert.ok(buttonTexts(rows).includes('Demand Capitulation'));
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
