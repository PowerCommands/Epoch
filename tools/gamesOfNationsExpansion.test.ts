import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  ADDITIONAL_GAMES_SPORTS,
  GAMES_OF_NATIONS_SPORT_DEFINITIONS,
  TRADITIONAL_GAMES_SPORTS,
  getGamesSportById,
} from '../src/data/gamesOfNationsSports';
import { ALL_LEADERS } from '../src/data/leaders';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GamesOfNationsSystem,
  buildAISportWeights,
  distributeGamesPointsEvenly,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem';
import type { GamesOfNationsLeaderPreferences, SavedGamesOfNationsState } from '../src/types/gamesOfNations';

function createHarness(options: { human?: boolean; future?: boolean; saved?: SavedGamesOfNationsState } = {}) {
  let turn = 1;
  const ids = ['alpha', 'beta', ...(options.human ? ['human'] : [])];
  const gold: Record<string, number> = { alpha: 1000, beta: 800, human: 1200 };
  const spent: Array<{ nationId: string; amount: number }> = [];
  const preferences: Record<string, GamesOfNationsLeaderPreferences> = {
    alpha: { traditionalFavourite: 'wrestling', additionalFavourite: 'horse_racing' },
    beta: { traditionalFavourite: 'marathon', additionalFavourite: 'boxing' },
    human: { traditionalFavourite: 'javelin', additionalFavourite: 'fencing' },
  };
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => ids,
    getNationName: (id) => id,
    getCapitalCity: (id) => ({ id: `${id}-city`, name: `${id} City` }),
    getCityOwnerId: (cityId) => cityId.replace(/-city$/, ''),
    hasGrandStadium: () => true,
    isHumanNation: (id) => options.human === true && id === 'human',
    getGold: (id) => gold[id] ?? 0,
    spendGold: (id, amount) => {
      if ((gold[id] ?? 0) < amount) return false;
      gold[id] -= amount;
      spent.push({ nationId: id, amount });
      return true;
    },
    getLeaderGamesPreferences: (id) => preferences[id],
    getWorldEra: () => options.future ? 'future' : 'renaissance',
    getWorldDateForTurn: (round) => ({ worldYear: 1000 + round, yearLabel: `${1000 + round} AD` }),
    seed: 'sport-expansion-tests',
  };
  const system = options.saved
    ? GamesOfNationsSystem.fromSave(dependencies, options.saved, turn)
    : GamesOfNationsSystem.forNewGame(dependencies);
  return {
    system, gold, spent,
    setTurn(value: number) { turn = value; },
    advanceTo(value: number) {
      for (let next = turn + 1; next <= value; next += 1) {
        turn = next;
        system.handleRoundStart(next);
      }
    },
  };
}

test('sport catalog defines five traditional and exactly five additional sports with matching assets', () => {
  assert.equal(TRADITIONAL_GAMES_SPORTS.length, 5);
  assert.equal(ADDITIONAL_GAMES_SPORTS.length, 5);
  assert.equal(GAMES_OF_NATIONS_SPORT_DEFINITIONS.length, 10);
  assert.deepEqual(ADDITIONAL_GAMES_SPORTS.map((sport) => sport.id), [
    'horse_racing', 'boxing', 'hundred_metres', 'pole_vault', 'fencing',
  ]);
  for (const sport of GAMES_OF_NATIONS_SPORT_DEFINITIONS) {
    assert.equal(existsSync(`public${sport.image}`), true, sport.image);
  }
});

test('era auction is global, AI-only, affordable, one-shot, and only its winner pays once', () => {
  const h = createHarness();
  assert.equal(h.system.handleEraReached('renaissance', 2), false);
  h.setTurn(10);
  assert.equal(h.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 10), true);
  assert.equal(h.system.handleEraReached('renaissance', 11), false, 'missed pre-founding era stays processed');
  assert.equal(h.system.handleEraReached('industrial', 12), true);
  assert.equal(h.system.getSummary().introducedAdditionalSportIds.length, 1);
  assert.equal(h.spent.length, 1);
  assert.ok(h.spent[0]!.amount <= 1000);
  assert.equal(h.system.handleEraReached('industrial', 13), false);
  assert.equal(h.spent.length, 1);
});

test('missed pre-founding era triggers persist without creating retroactive auctions', () => {
  const h = createHarness();
  h.system.handleEraReached('renaissance', 2);
  const restored = createHarness({ saved: h.system.getState() });
  restored.setTurn(10);
  restored.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 10);
  assert.equal(restored.system.handleEraReached('renaissance', 11), false);
  assert.deepEqual(restored.system.getSummary().introducedAdditionalSportIds, []);
});

test('human sees fixed AI proposals, must exceed the leader, may abstain, and pending bids survive save/load', () => {
  const h = createHarness({ human: true });
  h.setTurn(10);
  h.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 10);
  assert.equal(h.system.handleEraReached('renaissance', 11), true);
  const pending = h.system.getSummary().pendingSportAuction!;
  assert.equal(pending.proposals.length, 2);
  const saved = h.system.getState();
  const restored = createHarness({ human: true, saved });
  assert.deepEqual(restored.system.getSummary().pendingSportAuction?.proposals, pending.proposals);
  const leadingBid = Math.max(...pending.proposals.map((proposal) => proposal.bid));
  assert.equal(restored.system.submitHumanSportAuctionBid('human', 'fencing', leadingBid), false);
  assert.equal(restored.system.submitHumanSportAuctionBid('human', 'fencing', 1201), false);
  assert.equal(restored.system.abstainFromHumanSportAuction('human'), true);
  assert.equal(restored.spent.length, 1);
  assert.equal(restored.system.getSummary().introducedAdditionalSportIds.length, 1);
});

test('a winning human bid deducts exactly once and equal bids never replace the AI leader', () => {
  const h = createHarness({ human: true });
  h.setTurn(10);
  h.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 10);
  h.system.handleEraReached('renaissance', 11);
  const pending = h.system.getSummary().pendingSportAuction!;
  const leadingBid = Math.max(...pending.proposals.map((proposal) => proposal.bid));
  assert.equal(h.system.submitHumanSportAuctionBid('human', 'fencing', leadingBid), false);
  assert.equal(h.system.submitHumanSportAuctionBid('human', 'fencing', leadingBid + 1), true);
  assert.deepEqual(h.spent, [{ nationId: 'human', amount: leadingBid + 1 }]);
  assert.equal(h.gold.human, 1200 - leadingBid - 1);
  assert.equal(h.system.getSummary().introducedAdditionalSportIds[0], 'fencing');
  assert.equal(h.system.getSummary().pendingSportAuction, null);
});

test('sport list freezes at Preparation and dynamic Competition/cadence use six then seven sports', () => {
  const h = createHarness();
  h.setTurn(1);
  h.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 1);
  h.system.handleEraReached('renaissance', 2);
  h.advanceTo(16);
  assert.equal(h.system.getSummary().phase, 'preparation');
  assert.equal(h.system.getSummary().activeSports.length, 6);
  h.system.handleEraReached('industrial', 17);
  assert.equal(h.system.getSummary().introducedAdditionalSportIds.length, 2);
  assert.equal(h.system.getSummary().activeSports.length, 6, 'current Preparation remains frozen');
  h.advanceTo(26);
  assert.equal(h.system.getSummary().phaseTotalTurns, 6);
  h.advanceTo(31);
  assert.equal(h.system.getSummary().phase, 'competition');
  h.advanceTo(32);
  assert.equal(h.system.getSummary().phase, 'cooldown');
  h.advanceTo(42);
  assert.equal(h.system.getSummary().phase, 'preparation');
  assert.equal(h.system.getSummary().activeSports.length, 7);
  assert.equal(h.system.getSummary().nextGamesTurn, 52);
});

test('a complete ten-sport program resolves one sport per turn and archives its exact sport IDs', () => {
  const initial = createHarness();
  initial.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 1);
  const saved = initial.system.getState();
  saved.introducedAdditionalSportIds = ['horse_racing', 'boxing', 'hundred_metres', 'pole_vault', 'fencing'];
  const h = createHarness({ saved });
  h.advanceTo(16);
  assert.equal(h.system.getSummary().activeSports.length, 10);
  h.advanceTo(26);
  assert.equal(h.system.getSummary().phaseTotalTurns, 10);
  for (let turn = 26; turn <= 35; turn += 1) {
    h.advanceTo(turn);
    assert.equal(h.system.getSummary().sportResults.filter((result) => result.resolved).length, turn - 25);
  }
  assert.equal(h.system.getCompletedGames()[0]?.sportIds?.length, 10);
  h.advanceTo(36);
  assert.equal(h.system.getSummary().phase, 'cooldown');
});

test('dynamic even distribution, AI favourite weights, and inactive future sports behave correctly', () => {
  const six = [...TRADITIONAL_GAMES_SPORTS.map((sport) => sport.name), 'Horse Racing' as const];
  const distributed = distributeGamesPointsEvenly(73, six);
  assert.deepEqual(six.map((sport) => distributed[sport]), [13, 12, 12, 12, 12, 12]);
  assert.equal(distributed.Boxing, 0);
  const plain = buildAISportWeights('same', six);
  const preferred = buildAISportWeights('same', six, {
    traditionalFavourite: 'wrestling', additionalFavourite: 'horse_racing',
  });
  assert.equal(preferred.Wrestling, plain.Wrestling + 14);
  assert.equal(preferred['Horse Racing'], plain['Horse Racing'] + 14);
  assert.equal(preferred.Boxing, 0);
});

test('all leaders have valid varied category-correct favourites', () => {
  const pairs = new Set<string>();
  for (const leader of ALL_LEADERS) {
    const preference = leader.gamesOfNationsPreferences;
    assert.equal(getGamesSportById(preference.traditionalFavourite).category, 'traditional', leader.id);
    assert.equal(getGamesSportById(preference.additionalFavourite).category, 'additional', leader.id);
    pairs.add(`${preference.traditionalFavourite}/${preference.additionalFavourite}`);
  }
  assert.ok(pairs.size >= 10);
});

test('Future fallback introduces at most one remaining sport at each hosting-cycle start', () => {
  const h = createHarness({ future: true });
  h.setTurn(1);
  h.system.handleCultureCompleted('alpha', GAMES_AND_RECREATION_CULTURE_ID, 1);
  assert.equal(h.system.getSummary().introducedAdditionalSportIds.length, 1);
  h.advanceTo(26);
  assert.equal(h.system.getSummary().introducedAdditionalSportIds.length, 2);
  assert.equal(new Set(h.system.getSummary().introducedAdditionalSportIds).size, 2);
});

test('autoplay treats the human nation as AI, chooses its capital, and resolves sport auctions without UI', () => {
  let turn = 1;
  let autoplay = false;
  const gold: Record<string, number> = { human: 10_000, ai: 100 };
  const system = GamesOfNationsSystem.forNewGame({
    getCurrentTurn: () => turn,
    getLivingNationIds: () => ['human', 'ai'],
    getNationName: (id) => id,
    getCapitalCity: (id) => ({ id: `${id}-capital`, name: `${id} Capital` }),
    getHostCityCandidates: (id) => id === 'human' ? [
      { id: 'human-commercial-city', name: 'Commercial City', productionPerTurn: 100, canConstructGrandStadium: true, hasGrandStadium: false },
      { id: 'human-capital', name: 'Human Capital', productionPerTurn: 1, canConstructGrandStadium: true, hasGrandStadium: false },
    ] : [
      { id: 'ai-capital', name: 'AI Capital', productionPerTurn: 10, canConstructGrandStadium: true, hasGrandStadium: false },
    ],
    isHumanNation: (id) => id === 'human',
    isAutoplayActive: () => autoplay,
    getGold: (id) => gold[id]!,
    spendGold: (id, amount) => {
      if (gold[id]! < amount) return false;
      gold[id]! -= amount;
      return true;
    },
    getLeaderGamesPreferences: (id) => id === 'human'
      ? { traditionalFavourite: 'javelin', additionalFavourite: 'fencing' }
      : { traditionalFavourite: 'wrestling', additionalFavourite: 'boxing' },
    seed: 'autoplay-games-tests',
  });

  system.handleCultureCompleted('human', GAMES_AND_RECREATION_CULTURE_ID, turn);
  assert.equal(system.isHumanHostingPromptPending(), true);
  autoplay = true;
  system.handleAutoplayStarted();
  assert.equal(system.getSummary().upcomingHostCityId, 'human-capital');
  assert.equal(system.getSummary().hostingDecision, 'confirmed');
  assert.equal(system.isHumanHostingPromptPending(), false);

  system.handleEraReached('renaissance', 2);
  assert.equal(system.getSummary().pendingSportAuction, null);
  assert.equal(system.getSummary().introducedAdditionalSportIds[0], 'fencing');
  assert.ok(gold.human < 10_000);

  for (turn = 2; turn <= 16; turn += 1) system.handleRoundStart(turn);
  assert.equal(system.getSummary().humanInteractionSuppressed, true);
  assert.equal(system.isHumanPreparationPromptPending(), false);
  assert.equal(system.getState().participants.find((participant) => participant.nationId === 'human')?.strategyInitialized, true);
});
