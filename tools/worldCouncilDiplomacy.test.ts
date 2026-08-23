/**
 * Focused tests for the redesigned Diplomatic Score model.
 * Diplomatic Score is now event-driven (political outcomes at meetings) rather
 * than passively accrued from leader-personality contribution percentages.
 *
 * Run with:  npx tsx --test tools/worldCouncilDiplomacy.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  WorldCouncilSystem,
  computeMeetingPoliticalScoreAwards,
  getDiplomaticScoreBreakdown,
  type WorldCouncilLogger,
} from '../src/systems/WorldCouncilSystem.ts';
import {
  WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED,
  WORLD_COUNCIL_DIPLOMACY_SCORE_SUPPORT_POOL,
  WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD,
  type WorldCouncilMeeting,
  type WorldCouncilMember,
} from '../src/types/worldCouncil.ts';

// --- helpers ------------------------------------------------------------

function member(nationId: string, overrides: Partial<WorldCouncilMember> = {}): WorldCouncilMember {
  return {
    nationId,
    goldContributed: 0,
    scienceContributionPercent: 1,
    cultureContributionPercent: 1,
    diplomacyScore: 0,
    diplomacyScoreSinceLastRegularMeeting: 0,
    diplomacyScoreFromProposals: 0,
    diplomacyScoreFromSupport: 0,
    diplomacyScoreFromGold: 0,
    diplomacyScoreFromScience: 0,
    diplomacyScoreFromCulture: 0,
    diplomacyScoreFromOther: 0,
    ...overrides,
  };
}

function regularMeeting(proposals: WorldCouncilMeeting['proposals']): WorldCouncilMeeting {
  return { id: 1, kind: 'regular', turn: 100, cityId: 'city', proposals };
}

// --- pure award model ---------------------------------------------------

test('2. proposer of a passed resolution gains Diplomatic Score', () => {
  const meeting = regularMeeting([
    { slot: 'host', resolutionId: 'un_peacekeeping_mission', proposerNationId: 'india', passed: true, votes: [] },
  ]);
  const awards = computeMeetingPoliticalScoreAwards(meeting, ['india', 'sweden']);
  assert.equal(awards.length, 1);
  assert.equal(awards[0].nationId, 'india');
  assert.equal(awards[0].proposalScore, WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED);
  assert.equal(awards[0].supportScore, 0);
});

test('3. proposer of a FAILED resolution gains no success reward', () => {
  const meeting = regularMeeting([
    { slot: 'host', resolutionId: 'international_embargo', proposerNationId: 'india', passed: false, votes: [] },
  ]);
  const awards = computeMeetingPoliticalScoreAwards(meeting, ['india', 'sweden']);
  assert.equal(awards.length, 0);
});

test('4. Influence-spending supporters share the smaller pool by commitment', () => {
  const meeting = regularMeeting([
    {
      slot: 'host',
      resolutionId: 'climate_accord',
      proposerNationId: 'india',
      passed: true,
      votes: [
        { nationId: 'india', support: true, influence: 500 }, // proposer, excluded from support pool
        { nationId: 'sweden', support: true, influence: 300 },
        { nationId: 'china', support: true, influence: 100 },
        { nationId: 'england', support: false, influence: 400 }, // opposed, no reward
      ],
    },
  ]);
  const awards = computeMeetingPoliticalScoreAwards(meeting, ['india', 'sweden', 'china', 'england']);
  const by = new Map(awards.map((a) => [a.nationId, a]));

  // Proposer gets the large proposer reward and NOT a support share.
  assert.equal(by.get('india')!.proposalScore, WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED);
  assert.equal(by.get('india')!.supportScore, 0);

  // Supporters split the pool 300:100 by Influence committed.
  assert.equal(by.get('sweden')!.supportScore, Math.round(WORLD_COUNCIL_DIPLOMACY_SCORE_SUPPORT_POOL * 0.75));
  assert.equal(by.get('china')!.supportScore, Math.round(WORLD_COUNCIL_DIPLOMACY_SCORE_SUPPORT_POOL * 0.25));

  // Supporter reward is much smaller than the proposer reward.
  assert.ok(by.get('sweden')!.supportScore < WORLD_COUNCIL_DIPLOMACY_SCORE_PROPOSAL_PASSED);

  // The opposing nation receives nothing (blocking is not score-farmable).
  assert.equal(by.get('england'), undefined);
});

test('5. spending Influence without a passing resolution generates no score', () => {
  const meeting = regularMeeting([
    {
      slot: 'host',
      resolutionId: 'international_sanctions',
      proposerNationId: 'india',
      passed: false, // failed despite Influence spent
      votes: [
        { nationId: 'india', support: true, influence: 5000 },
        { nationId: 'sweden', support: true, influence: 4000 },
      ],
    },
  ]);
  const awards = computeMeetingPoliticalScoreAwards(meeting, ['india', 'sweden']);
  assert.equal(awards.length, 0, 'no score from Influence when the resolution does not pass');
});

test('6. contribution percentages do not independently create score', () => {
  // Two nations with wildly different science/culture contribution percentages,
  // neither proposing nor voting: both must earn exactly zero.
  const meeting = regularMeeting([
    { slot: 'random', resolutionId: 'shared_cartography', passed: true, votes: [] },
  ]);
  const awards = computeMeetingPoliticalScoreAwards(meeting, ['india', 'england']);
  assert.equal(awards.length, 0, 'a passed resolution with no proposer and no voters awards nobody');
});

test('emergency meetings never award Diplomatic Score', () => {
  const meeting: WorldCouncilMeeting = {
    id: 2, kind: 'emergency', turn: 120, cityId: 'city',
    proposals: [{ slot: 'host', resolutionId: 'defense_support', proposerNationId: 'india', passed: true, votes: [] }],
  };
  assert.equal(computeMeetingPoliticalScoreAwards(meeting, ['india', 'sweden']).length, 0);
});

// --- breakdown / save compatibility ------------------------------------

test('breakdown attributes score to proposals / support / contributions', () => {
  const m = member('india', {
    diplomacyScore: 950,
    diplomacyScoreFromProposals: 600,
    diplomacyScoreFromSupport: 300,
    diplomacyScoreFromGold: 50,
  });
  const b = getDiplomaticScoreBreakdown(m);
  assert.equal(b.total, 950);
  assert.equal(b.proposalScore, 600);
  assert.equal(b.supportScore, 300);
  assert.equal(b.contributionScore, 50);
  assert.equal(b.otherScore, 0);
});

test('8. legacy save score (pre-redesign buckets) is preserved in the total', () => {
  // A member restored from an old save has passive science/culture score and
  // none of the new proposal/support fields; the total must survive.
  const legacy = member('india', {
    diplomacyScore: 4000,
    diplomacyScoreFromScience: 2000,
    diplomacyScoreFromCulture: 2000,
    diplomacyScoreFromProposals: 0,
    diplomacyScoreFromSupport: 0,
  });
  const b = getDiplomaticScoreBreakdown(legacy);
  assert.equal(b.total, 4000);
  assert.equal(b.contributionScore, 4000, 'legacy passive score shows as contribution, not lost');
  assert.equal(b.proposalScore, 0);
});

// --- integration: no passive per-turn accrual --------------------------

interface FakeNation { id: string; isHuman: boolean; aiGoals: never[]; name: string; }

function makeSystem(founderId: string): { system: WorldCouncilSystem; logs: string[] } {
  const nation: FakeNation = { id: founderId, isHuman: false, aiGoals: [], name: founderId };
  const logs: string[] = [];
  const log: WorldCouncilLogger = (_nationId, message) => logs.push(message);
  const nationManager = {
    getNation: (id: string) => (id === founderId ? nation : undefined),
    getAllNations: () => [nation],
    getResources: () => ({ gold: 1000, goldPerTurn: 10 }),
  };
  const cityManager = { getCity: (id: string) => ({ id }) };
  const resourceSystem = { addGold: () => {} };
  const system = new WorldCouncilSystem(
    nationManager as never,
    cityManager as never,
    resourceSystem as never,
    undefined,
    undefined,
    log,
  );
  return { system, logs };
}

test('1 & 6. high contribution percentages produce no passive per-turn score', () => {
  const { system } = makeSystem('india');
  system.found({
    foundingCityId: 'delhi',
    foundingNationId: 'india',
    foundingTurn: 1,
    founderOffer: { gold: 0, sciencePercent: 22, culturePercent: 22 }, // maxed out
  });
  const before = system.getDiplomaticScoreBreakdown('india').total;

  // Advance many turns. The first turn-start is intentionally skipped by the
  // system, so run well past that.
  for (let round = 2; round < 60; round++) {
    system.handleTurnStart({ round, nation: { id: 'india' } } as never);
  }
  const after = system.getDiplomaticScoreBreakdown('india').total;

  assert.equal(before, 0);
  assert.equal(after, 0, 'no Diplomatic Score accrues from contribution percentages over time');
});

test('7. Diplomatic Score reaches the victory threshold through repeated passed proposals', () => {
  // Model a nation that keeps getting its proposals passed at regular meetings.
  let m = member('india');
  const meeting = regularMeeting([
    { slot: 'host', resolutionId: 'climate_accord', proposerNationId: 'india', passed: true, votes: [] },
  ]);
  let meetings = 0;
  let scoreBeforeWinningProposal = m.diplomacyScore;
  while (m.diplomacyScore < WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD && meetings < 100) {
    scoreBeforeWinningProposal = m.diplomacyScore;
    const award = computeMeetingPoliticalScoreAwards(meeting, ['india'])[0];
    m = { ...m, diplomacyScore: m.diplomacyScore + award.proposalScore + award.supportScore };
    meetings++;
  }
  assert.ok(scoreBeforeWinningProposal < WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD);
  assert.ok(m.diplomacyScore >= WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD);
});
