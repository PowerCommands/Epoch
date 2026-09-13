import { EraSystem, getHighestEra } from '../src/systems/EraSystem';
import { ALL_TECHNOLOGIES } from '../src/data/technologies';
import { WORKER, WORK_BOAT } from '../src/data/units';
import { Unit } from '../src/entities/Unit';
import { City } from '../src/entities/City';
import { BuilderSystem } from '../src/systems/BuilderSystem';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem';
import { UnitManager } from '../src/systems/UnitManager';
import { TurnManager } from '../src/systems/TurnManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldCouncilResolutionSystem } from '../src/systems/WorldCouncilResolutionSystem';
import { WorldCouncilSystem } from '../src/systems/WorldCouncilSystem';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem';
import { TradeDealSystem } from '../src/systems/TradeDealSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import { CityManager } from '../src/systems/CityManager';
import { Nation } from '../src/entities/Nation';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { getImprovementForTile } from '../src/systems/ImprovementResolution';
import { getTileYield, getTileImprovementYield, getTileNaturalResourceYield } from '../src/systems/CityEconomy';
import { type MapData } from '../src/types/map';
import type { Era } from '../src/data/technologies';
import type { WorldCouncilState, WorldCouncilMember } from '../src/types/worldCouncil';

const id = 'international_wildlife_protection';
const member = (nationId: string): WorldCouncilMember => ({ nationId, goldContributed: 0, scienceContributionPercent: 0, cultureContributionPercent: 0,
  diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0, diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0,
  diplomacyScoreFromGold: 0, diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0 });

function fixture(resourceId = 'ivory', foreign = false) {
  const resource = getNaturalResourceById(resourceId)!;
  const map: MapData = { width: 2, height: 1, tileSize: 1, tiles: [[
    { x: 0, y: 0, type: resource.allowedTileTypes[0], ownerId: foreign ? 'landowner' : 'seller', resourceId, improvementId: resource.improvementId, improvementOwnerId: 'seller' },
    { x: 1, y: 0, type: resource.allowedTileTypes[0], ownerId: 'prospector', resourceId },
  ]] };
  const nations = new NationManager();
  for (const nationId of ['seller', 'buyer', 'neutral', 'prospector', 'landowner']) nations.addNation(new Nation({ id: nationId, name: nationId, color: 1, isHuman: false }));
  const resolutions = new WorldCouncilResolutionSystem();
  const council = new WorldCouncilSystem(nations, new CityManager(), { addGold: () => {} } as never, resolutions);
  const state: WorldCouncilState = { organizationKind: 'worldCouncil', foundingCityId: 'council', foundingNationId: 'neutral', foundingTurn: 1,
    constructionStartedTurn: 1, constructionTurnsRemaining: 0, status: 'active', memberNationIds: ['neutral'], members: [member('neutral')],
    lastRegularMeetingTurn: 1, nextRegularMeetingTurn: 1000, meetings: [], nextMeetingId: 1, enactedResolutions: [] };
  council.restore(state);
  const payments: number[] = [];
  const trades = new TradeDealSystem(new DiplomacyManager(), () => 1, { getGold: () => 1000, addGold: (_nation, amount) => payments.push(amount) });
  trades.restoreDeals([{ id: 'trade_deal_1', sellerNationId: 'seller', buyerNationId: 'buyer', resourceId, goldPerTurn: 5, startTurn: 1, remainingTurns: 20 }]);
  const access = new ResourceAccessSystem(map, trades);
  access.setResourceExploitationProhibition(resource => council.isResourceExploitationProhibited(resource));
  trades.setResourceTradeSuspension(resource => council.isResourceExploitationProhibited(resource));
  trades.setCanExportResource((nation, resource) => access.canExportResource(nation, resource));
  resolutions.setRuntime({ getWorldEra: () => 'modern', getResourceEconomicInterest: (nation, resource) => access.getResourceEconomicInterest(nation, resource), getAvailableInfluence: () => 1000 });
  const pass = () => {
    const result = resolutions.resolve({ slot: 'host', resolutionId: id }, { meeting: { id: 1, kind: 'regular', turn: 1, cityId: 'council' }, turn: 1,
      members: [member('neutral')], previousEmergencyMeetings: [] });
    assert.equal(result.proposal.passed, true);
    assert.match(result.proposal.outcomeText!, /Passed by Influence/);
    council.restore({ ...council.getState()!, enactedResolutions: [result.enacted!] });
  };
  const deactivate = () => council.restore({ ...council.getState()!, enactedResolutions: council.getState()!.enactedResolutions.map(r => ({ ...r, active: false, repealed: true })) });
  return { map, access, council, resolutions, pass, deactivate, trades, payments, nations };
}

test('generic global minimum era preserves existing organization and ungated eligibility rules', () => {
  const system = new WorldCouncilResolutionSystem();
  let era: Era = 'industrial';
  system.setRuntime({ getWorldEra: () => era });
  const before = system.getEligibleDefinitions('worldCouncil').map(d => d.id);
  assert.ok(!before.includes(id));
  assert.ok(before.includes('shared_cartography'));
  assert.ok(!before.includes('climate_accord'));
  for (let seed = 0; seed < 100; seed++) assert.notEqual(system.chooseRandomProposal(seed).resolutionId, id);
  era = 'modern';
  const after = system.getEligibleDefinitions('worldCouncil').map(d => d.id);
  assert.ok(after.includes(id));
  assert.deepEqual(after.filter(value => value !== id), before);
  assert.ok(!system.getEligibleDefinitions('un').some(d => d.id === id));
  assert.ok(system.getEligibleDefinitions('un').some(d => d.id === 'climate_accord'));
  assert.ok(['worldCouncil', 'un'].every(kind => system.getDefinitions(kind as 'un').some(d => d.id === 'defense_support')));
  assert.ok(Array.from({ length: 100 }, (_, seed) => system.chooseRandomProposal(seed).resolutionId).includes(id));
  assert.equal(system.getDefinition(id)?.minimumEra, 'modern');
  assert.deepEqual(system.getDefinition(id)?.protectedResourceIds, ['ivory', 'whales', 'polar_bear']);
});

for (const resource of ['ivory', 'whales', 'polar_bear']) for (const foreign of [false, true]) {
  test(`${resource}: ${foreign ? 'foreign' : 'domestic'} exploitation, yields, imports and payments stop reversibly`, () => {
    const h = fixture(resource, foreign);
    const tile = h.map.tiles[0][0];
    const before = structuredClone(tile);
    const yields = getTileYield(tile);
    assert.equal(h.access.getResourceSourceCount('seller', resource), 2);
    assert.equal(h.access.getResourceSourceCount('buyer', resource), 1);
    assert.ok(getImprovementForTile(h.map.tiles[0][1]));
    h.pass();
    for (const nation of ['seller', 'buyer', 'prospector', 'landowner']) {
      assert.equal(h.access.getResourceSourceCount(nation, resource), 0);
      assert.ok(!h.access.getAvailableResources(nation).includes(resource));
    }
    assert.deepEqual(tile, before, 'resource and completed improvement remain intact');
    assert.equal(getImprovementForTile(h.map.tiles[0][1]), undefined, 'new construction is prohibited');
    assert.ok(Object.values(getTileNaturalResourceYield(tile)).every(value => value === 0));
    assert.ok(Object.values(getTileImprovementYield(tile)).every(value => value === 0));
    assert.equal(h.access.canExportResource('seller', resource), false);
    assert.deepEqual(h.access.getImportedResources('buyer'), []);
    assert.equal(h.trades.getGoldPerTurnDeltaForNation('seller'), 0);
    h.trades.advanceTurnForNation('buyer');
    assert.deepEqual(h.payments, []);
    assert.equal(h.trades.getAllDeals()[0].remainingTurns, 19);
    h.deactivate();
    assert.equal(h.access.getResourceSourceCount('seller', resource), 2);
    assert.equal(h.access.getResourceSourceCount('buyer', resource), 1);
    assert.deepEqual(getTileYield(tile), yields);
    assert.ok(getImprovementForTile(h.map.tiles[0][1]));
    h.trades.advanceTurnForNation('buyer');
    assert.deepEqual(h.payments, [-5, 5]);
  });
}

test('ordinary food resources retain access and yields', () => {
  for (const resource of ['deer', 'fish', 'crabs']) {
    const h = fixture(resource); const before = getTileYield(h.map.tiles[0][0]);
    h.pass();
    assert.equal(h.access.hasResource('seller', resource), true);
    assert.deepEqual(getTileYield(h.map.tiles[0][0]), before);
  }
});

test('AI policy voting opposes economic losses through domestic, foreign, unimproved and imported interests', () => {
  for (const foreign of [false, true]) {
    const h = fixture('ivory', foreign);
    h.pass(); // Interests remain visible to repeal scoring while access is prohibited.
    const result = h.resolutions.resolve({ slot: 'host', resolutionId: id }, { meeting: { id: 2, kind: 'regular', turn: 2, cityId: 'council' }, turn: 2,
      members: ['seller', 'buyer', 'prospector', 'neutral'].map(member), previousEmergencyMeetings: [] });
    for (const nation of ['seller', 'buyer', 'prospector']) {
      const vote = result.proposal.votes!.find(v => v.nationId === nation)!;
      assert.equal(vote.support, false);
      assert.ok(vote.supportScore! <= -30);
      assert.ok(vote.influence > 0);
    }
    assert.equal(result.proposal.votes!.find(v => v.nationId === 'neutral')!.support, true);
    const repeal = h.resolutions.resolve({ slot: 'host', resolutionId: id, repealTargetEnactedResolutionId: h.council.getState()!.enactedResolutions[0].id }, {
      meeting: { id: 3, kind: 'regular', turn: 3, cityId: 'council' }, turn: 3, members: [member('seller')], previousEmergencyMeetings: [] });
    assert.equal(repeal.proposal.votes![0].support, true);
  }
});

test('JSON council save/load retains active protection and backward compatible active flags', () => {
  const h = fixture(); h.pass();
  const saved = JSON.parse(JSON.stringify(h.council.getState()));
  const loaded = fixture(); loaded.council.restore(saved);
  assert.equal(loaded.access.hasResource('seller', 'ivory'), false);
  assert.equal(loaded.access.hasResource('buyer', 'ivory'), false);
  assert.ok(loaded.map.tiles[0][0].improvementId);
  delete saved.enactedResolutions[0].active;
  loaded.council.restore(saved);
  assert.equal(loaded.access.hasResource('seller', 'ivory'), false);
  loaded.deactivate();
  assert.equal(loaded.access.hasResource('seller', 'ivory'), true);
});

for (const resource of ['ivory', 'whales', 'polar_bear']) for (const foreign of [false, true]) {
  test(`${resource}: builder and in-progress construction obey protection with ${foreign ? 'foreign rights' : 'domestic ownership'}`, () => {
    const h = fixture(resource);
    const tile = h.map.tiles[0][1];
    tile.ownerId = foreign ? 'landowner' : 'prospector';
    const nation = new Nation({ id: 'prospector', name: 'Prospector', color: 1 });
    const nations = new NationManager(); nations.addNation(nation);
    const cities = new CityManager();
    const city = new City({ id: 'city', name: 'City', ownerId: nation.id, tileX: 0, tileY: 0 });
    city.ownedTileCoords = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; cities.addCity(city);
    const units = new UnitManager(h.map.width, h.map.height);
    const worker = new Unit({ id: 'worker', name: 'Builder', ownerId: nation.id, unitType: resource === 'whales' ? WORK_BOAT : WORKER,
      tileX: 1, tileY: 0, improvementCharges: 5 });
    units.addUnit(worker);
    const diplomacy = new DiplomacyManager(); diplomacy.grantExploitationRights('landowner', nation.id);
    const construction = new ImprovementConstructionSystem(h.map, units, cities, undefined, diplomacy);
    const builder = new BuilderSystem(units, cities, new TurnManager(nations), h.map, new HexGridSystem(), undefined, undefined, diplomacy);
    assert.equal(builder.canBuild(worker, tile), true);
    assert.ok(builder.build(worker, tile));
    h.pass();
    construction.handleTurnStart({ round: 2, nation });
    assert.equal(tile.improvementId, undefined);
    assert.equal(tile.improvementConstruction, undefined);
    worker.movementPoints = worker.maxMovementPoints;
    assert.equal(builder.canBuild(worker, tile), false);
    assert.equal(builder.build(worker, tile), null);
    h.deactivate();
    assert.equal(builder.canBuild(worker, tile), true);
  });
}

test('world era uses canonical progression even when the proposer has no modern research', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'proposer', name: 'Proposer', color: 1 }));
  const leader = new Nation({ id: 'leader', name: 'Leader', color: 2 }); nations.addNation(leader);
  const eras = new EraSystem(nations);
  const resolutions = new WorldCouncilResolutionSystem();
  resolutions.setRuntime({ getWorldEra: () => getHighestEra(nations.getAllNations().map(n => eras.getNationEra(n.id))) });
  assert.equal(resolutions.isProposalEligible(id, 'proposer'), false);
  leader.researchedTechIds.push(ALL_TECHNOLOGIES.find(tech => tech.era === 'modern')!.id);
  assert.equal(eras.getNationEra('proposer'), 'ancient');
  assert.equal(resolutions.isProposalEligible(id, 'proposer'), true);
});

test('normal council enactment and repeal update live restrictions and emit meeting events', () => {
  const h = fixture();
  h.nations.getNation('neutral')!.isHuman = true;
  h.nations.getNation('seller')!.isHuman = true;
  let adoptedTitle: string | undefined;
  h.council.onMeeting(meeting => {
    const proposal = meeting.proposals?.find(p => p.passed && !p.repealTargetEnactedResolutionId);
    if (proposal) adoptedTitle = h.resolutions.getDefinition(proposal.resolutionId)?.title;
  });
  h.council.restore({ ...h.council.getState()!, meetings: [{ id: 1, kind: 'regular', turn: 1, cityId: 'council',
    proposals: [{ slot: 'host', resolutionId: id, proposerNationId: 'neutral' }] }] });
  assert.equal(h.council.resolvePendingHumanVoteMeeting()?.proposals?.[0].passed, true);
  assert.equal(adoptedTitle, 'International Wildlife Protection');
  assert.equal(h.access.hasResource('seller', 'ivory'), false);
  const active = h.council.getState()!.enactedResolutions[0];
  h.council.restore({ ...h.council.getState()!, members: [member('seller')], memberNationIds: ['seller'], meetings: [{ id: 2, kind: 'regular', turn: 2, cityId: 'council',
    proposals: [{ slot: 'host', resolutionId: id, proposerNationId: 'seller', repealTargetEnactedResolutionId: active.id }] }] });
  assert.equal(h.council.resolvePendingHumanVoteMeeting()?.proposals?.[0].passed, true);
  assert.equal(h.access.hasResource('seller', 'ivory'), true);
});
