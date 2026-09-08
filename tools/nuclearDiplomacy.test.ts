import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldCouncilSystem } from '../src/systems/WorldCouncilSystem';
import { WorldCouncilResolutionSystem } from '../src/systems/WorldCouncilResolutionSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import { CityManager } from '../src/systems/CityManager';
import { Nation } from '../src/entities/Nation';
import { City } from '../src/entities/City';
import type { WorldCouncilMember, WorldCouncilOrganizationKind, WorldCouncilState } from '../src/types/worldCouncil';
import { getCityUnitProductionBlockReason } from '../src/systems/ProductionRules';
import { NUCLEAR_MISSILE, ATOMIC_BOMB, GUIDED_MISSILE } from '../src/data/units';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType } from '../src/types/map';

const member = (nationId: string): WorldCouncilMember => ({ nationId, goldContributed: 0, scienceContributionPercent: 0, cultureContributionPercent: 0,
  diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0, diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0,
  diplomacyScoreFromGold: 0, diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0 });
function fixture(kind: WorldCouncilOrganizationKind, human = 'human') {
  const ids = ['aggressor', 'victim', 'ally', 'reject', 'human'];
  const nations = new NationManager();
  for (const id of ids) nations.addNation(new Nation({ id, name: id, color: 1, isHuman: id === human }));
  const cities = new CityManager(); cities.addCity(new City({ id: 'council', name: 'Council', ownerId: 'victim', tileX: 0, tileY: 0 }));
  const diplomacy = new DiplomacyManager(); diplomacy.declareWar('aggressor', 'victim');
  const resolutions = new WorldCouncilResolutionSystem();
  const humanVotes: string[] = [];
  let support: boolean | undefined;
  const joins: string[] = [];
  resolutions.setRuntime({
    isNationActive: () => true, isHumanNation: id => id === human,
    getDiplomacyState: (a, b) => diplomacy.getState(a, b),
    getRelationMemory: voter => ({ trust: voter === 'reject' ? 100 : 0, hostility: voter === 'reject' ? 0 : 100, fear: 0 }),
    getMilitaryStrength: () => 100, getLeaderPersonality: () => ({ aggressionBias: 0, economyBias: 0, diplomacyBias: 0, warTolerance: 50, peacePreference: 50 }),
    requestHumanInfluenceVote: input => { humanVotes.push(input.nationId); return support === undefined ? null : { support, influence: 0 }; },
    spendInfluence: () => { throw new Error('Response must not spend Influence'); },
    joinNuclearResponse: (id, aggressor, victim) => { joins.push(id); return diplomacy.joinCollectiveNuclearResponse(id, aggressor, victim); },
  });
  const system = new WorldCouncilSystem(nations, cities, { addGold: () => {} } as never, resolutions);
  const state: WorldCouncilState = { organizationKind: kind, foundingCityId: 'council', foundingNationId: 'victim', foundingTurn: 1,
    constructionStartedTurn: 1, constructionTurnsRemaining: 0, status: 'active', memberNationIds: ids, members: ids.map(member),
    lastRegularMeetingTurn: 1, nextRegularMeetingTurn: 51, meetings: [], nextMeetingId: 1, enactedResolutions: [] };
  system.restore(state); system.setHumanVotingDeferralEnabled(() => true);
  const trigger = () => system.triggerEmergencyMeeting(10, { eventType: 'nuclearAttack', aggressorNationId: 'aggressor', targetNationId: 'victim' });
  return { system, resolutions, diplomacy, trigger, joins, humanVotes, setSupport: (value: boolean | undefined) => { support = value; }, state };
}
for (const kind of ['worldCouncil', 'un'] as const) {
  test(`${kind}: immediate nuclear emergency, human participation, supporters only join war`, () => {
    const h = fixture(kind); const meeting = h.trigger();
    assert.equal(meeting?.kind, 'emergency');
    assert.equal(meeting?.proposals?.[0].resolutionId, 'collective_nuclear_response');
    assert.equal(h.system.getPendingHumanVoteMeeting()?.id, meeting?.id);
    assert.deepEqual(h.joins, []);
    h.setSupport(true); const resolved = h.system.resolvePendingHumanVoteMeeting()!;
    const proposal = resolved.proposals![0];
    assert.equal(proposal.passed, true);
    assert.equal(proposal.votes?.some(vote => vote.nationId === 'aggressor'), false);
    assert.equal(proposal.votes?.find(vote => vote.nationId === 'victim')?.support, true);
    assert.deepEqual(h.joins.sort(), ['ally', 'human']);
    assert.equal(h.diplomacy.getState('human', 'aggressor'), 'WAR');
    assert.equal(h.diplomacy.getState('reject', 'aggressor'), 'PEACE');
    assert.equal(h.diplomacy.getRelation('human', 'aggressor').aggressorNationId, 'aggressor');
  });
  test(`${kind}: aggressor has no ballot or pending input; victim automatic support`, () => {
    for (const human of ['aggressor', 'victim']) {
      const h = fixture(kind, human); const result = h.trigger();
      assert.equal(result?.proposals?.[0].resolved, true);
      assert.equal(h.system.getPendingHumanVoteMeeting(), null);
      assert.deepEqual(h.humanVotes, []);
    }
  });
}
test('missing human input never joins war and a tied response fails', () => {
  const h = fixture('un'); h.trigger(); h.system.resolvePendingHumanVoteMeeting();
  assert.equal(h.diplomacy.getState('human', 'aggressor'), 'PEACE');
  assert.deepEqual(h.joins, []);
});
test('multiple pending emergency responses survive canonical state save/load and drain in order', () => {
  const h = fixture('un'); const first = h.trigger()!; const second = h.trigger()!;
  const saved = JSON.parse(JSON.stringify(h.system.getState())); h.system.restore(saved);
  assert.equal(h.system.getPendingHumanVoteMeeting()?.id, first.id);
  h.setSupport(false); h.system.resolvePendingHumanVoteMeeting();
  assert.equal(h.system.getPendingHumanVoteMeeting()?.id, second.id);
  h.system.resolvePendingHumanVoteMeeting(); assert.equal(h.system.getPendingHumanVoteMeeting(), null);
});
test('UN Non-Proliferation Treaty blocks new atomic and nuclear missile production, keeps conventional production', () => {
  const h = fixture('un');
  h.system.restore({ ...h.state, enactedResolutions: [{ id: 'treaty', resolutionId: 'nuclear_non_proliferation_treaty', meetingId: 1, turn: 1, active: true }] });
  const city = new City({ id: 'a', name: 'A', ownerId: 'ally', tileX: 0, tileY: 0 });
  const map = { width: 1, height: 1, tileSize: 1, tiles: [[{ x: 0, y: 0, type: TileType.Plains }]] };
  const context = { getUnitProductionRestrictionReason: (nation: string, unit: string) => h.system.getUnitProductionRestrictionReason(nation, unit) };
  for (const unit of [ATOMIC_BOMB, NUCLEAR_MISSILE]) assert.match(getCityUnitProductionBlockReason(city, unit, map, new HexGridSystem(), context)!, /Nuclear Non-Proliferation/);
  assert.equal(getCityUnitProductionBlockReason(city, GUIDED_MISSILE, map, new HexGridSystem(), context), undefined);
});

test('collective responders do not pull rejecting allies or vassals into new wars', async () => {
  const { AllianceManager } = await import('../src/systems/diplomacy/AllianceManager');
  const { AllianceWarSystem } = await import('../src/systems/diplomacy/AllianceWarSystem');
  const { VassalWarSystem } = await import('../src/systems/diplomacy/VassalWarSystem');
  const h = fixture('un');
  const alliances = new AllianceManager(); alliances.createAlliance('aggressor', 'reject', 'Pact', 1);
  new AllianceWarSystem(h.diplomacy, alliances);
  h.diplomacy.establishVassal('vassal', 'ally');
  new VassalWarSystem(h.diplomacy, { isHumanNation: () => false, shouldAIDefend: () => true, requestHumanDefense: () => {} });
  h.trigger(); h.setSupport(true); h.system.resolvePendingHumanVoteMeeting();
  assert.equal(h.diplomacy.getState('ally', 'aggressor'), 'WAR');
  assert.equal(h.diplomacy.getState('reject', 'ally'), 'PEACE');
  assert.equal(h.diplomacy.getState('vassal', 'aggressor'), 'PEACE');
});

test('AI coalition risk uses the same political inputs as response voting', () => {
  const h = fixture('un');
  assert.equal(h.system.estimateNuclearInterventionRisk('aggressor', 'victim'), 200);
  assert.equal(h.resolutions.isProposalEligible('collective_nuclear_response', 'ally'), false);
});
