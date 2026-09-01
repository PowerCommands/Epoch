import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ALL_POLICIES, getPolicyById } from '../src/data/policies';
import { CULTURE_TREE } from '../src/data/cultureTree';
import { ALL_GAMES_SPORTS } from '../src/data/gamesOfNationsSports';
import { Nation } from '../src/entities/Nation';
import { GamesOfNationsSystem, type GamesOfNationsDependencies } from '../src/systems/GamesOfNationsSystem';
import { NationManager } from '../src/systems/NationManager';
import { PolicySystem } from '../src/systems/PolicySystem';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const ATHLETES = [
  ['aleksandr_barelin', 'games_recreation', 'wrestling'],
  ['eliud_kiprun', 'drama_civics', 'marathon'],
  ['michael_pelps', 'foreign_trade', 'swimming'],
  ['jan_zeleznyx', 'theology_civics', 'javelin'],
  ['carl_leaps', 'feudalism', 'long_jump'],
  ['kim_true_shot', 'guilds', 'archery'],
  ['isabella_worth', 'exploration', 'equestrian'],
  ['edoardo_blademari', 'humanism', 'fencing'],
  ['eddy_mercxwell', 'natural_history', 'cycling'],
  ['simone_flies', 'opera_ballet', 'gymnastics'],
] as const;

test('Culture athlete policies use unique policy-free culture nodes and data-driven +100 modifiers', () => {
  for (const [policyId, cultureNodeId, sportId] of ATHLETES) {
    const policy = getPolicyById(policyId)!;
    assert.ok(policy);
    assert.equal(policy.category, 'culture');
    assert.equal(policy.requiredCultureNodeId, cultureNodeId);
    assert.equal(policy.humanOnly, true);
    assert.deepEqual(policy.modifiers, [{ type: 'gamesOfNationsSportScoreBonus', sportId, value: 100 }]);
    assert.ok(CULTURE_TREE.some((node) => node.id === cultureNodeId));
    assert.deepEqual(
      ALL_POLICIES.filter((entry) => entry.requiredCultureNodeId === cultureNodeId).map((entry) => entry.id),
      [policyId],
    );
  }
});

test('Culture and wildcard slots activate athlete policies, AI cannot see or activate them, and saves normalize safely', () => {
  const nations = new NationManager();
  const unlockedCultureNodeIds = ['games_recreation', 'professional_sports', 'mysticism'];
  nations.addNation(new Nation({ id: 'human', name: 'Human', color: 0, isHuman: true, unlockedCultureNodeIds }));
  nations.addNation(new Nation({ id: 'ai', name: 'AI', color: 0, isHuman: false, unlockedCultureNodeIds }));
  const policies = new PolicySystem(nations);

  assert.equal(policies.getSlotCounts('human').culture, 2);
  assert.equal(policies.activatePolicy('human', 'aleksandr_barelin', 'culture'), true);
  assert.equal(policies.getGamesOfNationsSportScoreBonus('human', 'wrestling'), 100);
  assert.equal(policies.getGamesOfNationsSportScoreBonus('human', 'marathon'), 0);
  assert.equal(policies.deactivatePolicy('human', 'aleksandr_barelin'), true);
  assert.equal(policies.getGamesOfNationsSportScoreBonus('human', 'wrestling'), 0);
  assert.equal(policies.activatePolicy('human', 'aleksandr_barelin', 'wildcard'), true);

  const saved = policies.getActivePolicyAssignments('human');
  const loaded = new PolicySystem(nations);
  loaded.loadNationPolicies('human', saved);
  assert.deepEqual(loaded.getActivePolicyAssignments('human'), saved);
  loaded.loadNationPolicies('human', []);
  assert.deepEqual(loaded.getActivePolicyAssignments('human'), []);

  assert.equal(policies.getUnlockedPolicies('ai').some((policy) => policy.humanOnly), false);
  assert.equal(policies.activatePolicy('ai', 'aleksandr_barelin', 'culture'), false);
  policies.loadNationPolicies('ai', [{ policyId: 'aleksandr_barelin', slotCategory: 'culture' }]);
  assert.deepEqual(policies.getActivePolicyAssignments('ai'), []);
});

test('Games scoring adds exactly +100 only to the matching sport weight', () => {
  const participant = (nationId: string): GamesOfNationsParticipantState => ({
    nationId,
    participating: true,
    cultureCommitment: 0,
    productionCommitment: 0,
    unallocatedGamesPoints: 0,
    gamesPointsStrategyBySport: sportValues(0),
    gamesPointsBySport: sportValues(10),
    totalGamesPoints: 50,
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: true,
  });
  const state: SavedGamesOfNationsState = {
    founded: true,
    phase: 'competition',
    competitionNumber: 1,
    phaseStartTurn: 105,
    scheduledGamesTurn: 105,
    hostRotationOrder: ['human', 'b', 'c'],
    hostRotationIndex: 0,
    participants: [participant('human'), participant('b'), participant('c')],
    lastProcessedTurn: 104,
  };
  let turn = 104;
  let active = true;
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => ['human', 'b', 'c'],
    getNationName: (id) => id,
    getCapitalCity: (id) => ({ id: `${id}-city`, name: id }),
    getSportScoreBonus: (nationId, sportId) => active && nationId === 'human' && sportId === 'wrestling' ? 100 : 0,
    seed: 'athlete-policy-test',
  };
  const games = GamesOfNationsSystem.fromSave(dependencies, state, turn);
  turn = 105;
  games.handleRoundStart(turn);
  assert.deepEqual(games.getSummary().sportResults[0]?.weights, { human: 110, b: 10, c: 10 });
  turn = 106;
  games.handleRoundStart(turn);
  assert.deepEqual(games.getSummary().sportResults[1]?.weights, { human: 10, b: 10, c: 10 });

  active = false;
  const inactiveGames = GamesOfNationsSystem.fromSave(dependencies, { ...state, sportResults: undefined }, 104);
  turn = 105;
  inactiveGames.handleRoundStart(turn);
  assert.deepEqual(inactiveGames.getSummary().sportResults[0]?.weights, { human: 10, b: 10, c: 10 });
});

test('all ten athlete artworks are unique 256x256 RGBA non-interlaced PNG files', () => {
  const hashes = new Set<string>();
  for (const [policyId] of ATHLETES) {
    const png = readFileSync(new URL(`../public/assets/sprites/policies/${policyId}.png`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[25], 6, `${policyId} must be RGBA`);
    assert.equal(png[28], 0, `${policyId} must be non-interlaced`);
    hashes.add(createHash('sha256').update(png).digest('hex'));
  }
  assert.equal(hashes.size, ATHLETES.length);
});

test('Policies dialog uses 95% of the viewport and the requested three-row slot ordering', () => {
  const source = readFileSync(new URL('../src/ui/hud/PolicyDialog.ts', import.meta.url), 'utf8');
  assert.match(source, /const PANEL_WIDTH_RATIO = 0\.95;/);
  assert.match(source, /const PANEL_HEIGHT_RATIO = 0\.95;/);
  assert.match(source, /placePairRow\('military', 'economic'\);[\s\S]*placePairRow\('culture', 'diplomatic'\);/);
  assert.match(source, /layoutSlotCategory\('wildcard', rightX, cursor, rightWidth\)/);
});

function sportValues(value: number): GamesOfNationsSportValues {
  return Object.fromEntries(ALL_GAMES_SPORTS.map((sport) => [sport, value])) as GamesOfNationsSportValues;
}
