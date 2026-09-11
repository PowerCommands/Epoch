import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { getLeaderById, getLeaderByNationId, setActiveLeaderSelections } from '../src/data/leaders';
import { setLeaderConfiguration } from '../src/data/leaderConfiguration';
import { effectiveLeader, validateConfiguration, serializeConfiguration, deserializeConfiguration } from '../src/editor/leaderEditorModel';
import { getLeaderWarDeclarationPhrases } from '../src/data/leaderWarDeclarations';
import { LeaderStatementSystem, STATEMENT_COOLDOWN } from '../src/systems/LeaderStatementSystem';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService';
import { SHOWMAN_STATEMENTS } from '../src/data/showmanStatements';
import type { HistoricalEventType, HistoricalEventMetadata } from '../src/types/historicalTimeline';

const id = 'leader_boris_johnson', nation = 'nation_england';
afterEach(() => { setLeaderConfiguration(); setActiveLeaderSelections(undefined); });
function harness(showman = true, roll: number | null = 0) {
  let round = 0, active = true;
  const history = new HistoricalTimelineService(() => round, () => '1900');
  let reactions = 0;
  const system = new LeaderStatementSystem({ history, round: () => round,
    diplomacy: { getRelation: () => { throw new Error('Showman must not evaluate diplomacy'); }, setMemoryValues: () => { reactions++; } },
    nationIds: () => [nation, 'nation_france'], active: () => active, haveMet: () => true,
    leaderName: () => 'Leader', militaryPower: () => { throw new Error('Showman must not evaluate military power'); },
    isBully: () => false, isShowman: () => showman, seed: 'showman-test', roll: roll === null ? undefined : () => roll,
    log: () => {},
  });
  return { system, history, at: (r: number) => { round = r; }, deactivate: () => { active = false; }, reactions: () => reactions,
    event: (type: HistoricalEventType, metadata?: HistoricalEventMetadata) => history.record({ type, icon: '', text: '', eventNationIds: [nation], metadata }) };
}

test('Boris combines independent traits and has full diplomacy and war flavor', () => {
  const boris = getLeaderById(id)!;
  assert.equal(boris.showman, true); assert.equal(boris.opportunism, true); assert.equal(boris.impulsiveBully, false);
  assert.equal(boris.isDefault, false);
  for (const key of ['greeting', 'friendly', 'neutral', 'hostile', 'warDeclaration', 'victory', 'defeat'] as const)
    assert.ok(boris.diplomacyFlavor?.[key]);
  for (const reason of ['conquest', 'hostility', 'threat', 'ideological', 'ambition'] as const)
    assert.ok(getLeaderWarDeclarationPhrases(id)[reason].length >= 2);
  assert.ok(SHOWMAN_STATEMENTS.length >= 40);
  assert.equal(new Set(SHOWMAN_STATEMENTS.map(l => l.id)).size, SHOWMAN_STATEMENTS.length);
});

test('missing traits default false; editor and overrides preserve explicit true and false', () => {
  assert.equal(effectiveLeader({ version: 1 }, 'leader_henry_v').showman, false);
  for (const showman of [true, false]) {
    const config = { version: 1 as const, leaders: { [id]: { showman } } };
    const decoded = deserializeConfiguration(serializeConfiguration(config));
    assert.deepEqual(validateConfiguration(decoded), []);
    assert.equal(effectiveLeader(decoded, id).showman, showman);
    setLeaderConfiguration(decoded); setActiveLeaderSelections({ [nation]: id });
    assert.equal(getLeaderByNationId(nation)?.showman, showman);
    assert.equal(getLeaderByNationId(nation)?.opportunism, true);
    assert.equal(getLeaderByNationId(nation)?.impulsiveBully, false);
  }
  assert.match(validateConfiguration({ version: 1, leaders: { [id]: { showman: 'yes' } } } as any).join(), /showman/);
  const editor = readFileSync('src/editor/leaderEditorBundle.ts', 'utf8');
  assert.match(editor, /showman.type = 'checkbox'/);
  assert.match(editor, /patchLeader\(\['showman'\], showman.checked\)/);
});

test('Showman cadence is moderate, shares the existing cooldown, and persists across restore', () => {
  const h = harness();
  for (let r = 0; r < 80; r++) { h.at(r); h.system.runTurn(nation); h.event('wonderBuilt'); }
  const speeches = h.history.getEvents().filter(e => e.type === 'leaderStatement');
  assert.equal(speeches.length, 80 / STATEMENT_COOLDOWN);
  assert.ok(speeches.every((e, i) => i === 0 || e.round - speeches[i - 1]!.round >= STATEMENT_COOLDOWN));
  assert.equal(h.reactions(), 0);
  const restored = harness(); restored.at(79); restored.system.restore(JSON.parse(JSON.stringify(h.system.serialize())));
  assert.equal(restored.system.available(nation), false);
  restored.at(80); assert.equal(restored.system.available(nation), true);
  restored.system.restore(undefined); assert.equal(restored.system.available(nation), true);
  const typical = harness(true, null);
  for (let r = 0; r < 1000; r++) { typical.at(r); typical.system.runTurn(nation); }
  const count = typical.history.getEvents().length;
  assert.ok(count > 35 && count < 90, `Moderate seeded frequency: ${count}/1000`);
});

test('supported events choose truthful contexts without diplomatic reactions', () => {
  const cases: Array<[HistoricalEventType, string, HistoricalEventMetadata?]> = [
    ['tradeRouteCompleted', 'economic_success'], ['embassyEstablished', 'diplomatic_success'],
    ['allianceFormed', 'alliance'], ['peace', 'peace_agreement'], ['cityFounded', 'construction'],
    ['wonderBuilt', 'wonder'], ['gamesGold', 'games_success', { gamesWinnerNationId: nation }],
    ['cityCaptured', 'city_victory', { aggressorNationId: nation, targetNationId: 'other' }],
    ['capitalCaptured', 'city_loss', { aggressorNationId: 'other', targetNationId: nation }],
    ['stockMarketCrash', 'economic_difficulty', { worldEventPhase: 'started' }],
    ['pandemic', 'recovery', { worldEventPhase: 'ended' }],
  ];
  for (const [event, context, metadata] of cases) {
    const h = harness(); const lines: string[] = [];
    h.system.onStatement(s => lines.push(s.context)); h.event(event, metadata);
    assert.ok(lines.includes(context), event); assert.equal(h.reactions(), 0);
  }
});

test('ordinary leaders, inactive nations, unrelated events and failed rolls create no Showman statements', () => {
  for (const h of [harness(false), harness(true, .9)]) {
    h.system.runTurn(nation); h.event('wonderBuilt');
    assert.equal(h.history.getEvents().filter(e => e.type === 'leaderStatement').length, 0);
  }
  const ordinary = harness(false);
  assert.equal(ordinary.system.issue(nation, l => l.requiredTrait === 'showman'), undefined);
  assert.ok(ordinary.system.issue(nation, l => l.tone === 'assertive'));
  const h = harness(); h.event('warDeclared'); h.event('leaderInsult');
  assert.equal(h.history.getEvents().length, 2);
  h.deactivate(); h.system.runTurn(nation); h.event('wonderBuilt');
  assert.equal(h.history.getEvents().length, 3);
});
