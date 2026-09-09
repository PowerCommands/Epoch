import assert from 'node:assert/strict';
import test from 'node:test';
import { Nation } from '../src/entities/Nation';
import { City } from '../src/entities/City';
import { Unit } from '../src/entities/Unit';
import { NationManager } from '../src/systems/NationManager';
import { CityManager } from '../src/systems/CityManager';
import { WorldCouncilSystem } from '../src/systems/WorldCouncilSystem';
import { WorldCouncilResolutionSystem } from '../src/systems/WorldCouncilResolutionSystem';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { AISystem } from '../src/systems/AISystem';
import { ATOMIC_BOMB, NUCLEAR_MISSILE, WARRIOR, WORKER } from '../src/data/units';
import { getBuildingById } from '../src/data/buildings';
import { getCouncilEnergyPosition, getCouncilProductionBlockReason } from '../src/systems/WorldCouncilPolicyEffects';
import { isEligiblePeacekeepingUnit, isPeacekeepingAttackAllowed } from '../src/systems/PeacekeepingRules';
import { buildPeacekeepingContributionControls } from '../src/ui/hud/PeacekeepingContributionControls';
import type { WorldCouncilState, WorldCouncilMember, WorldCouncilResolutionId, WorldCouncilEnactedResolution } from '../src/types/worldCouncil';
import type { Producible } from '../src/types/producible';
import { TileType, type MapData } from '../src/types/map';

const member = (nationId: string): WorldCouncilMember => ({ nationId, goldContributed: 0, scienceContributionPercent: 0, cultureContributionPercent: 0,
  diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0, diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0,
  diplomacyScoreFromGold: 0, diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0 });
const building = (id: string): Producible => ({ kind: 'building', buildingType: getBuildingById(id)! });
const unitItem = (unitType: typeof WARRIOR): Producible => ({ kind: 'unit', unitType });
function fixture() {
  const nations = new NationManager();
  for (const id of ['host', 'human', 'ally', 'threat', 'outsider']) nations.addNation(new Nation({ id, name: id, color: 1, isHuman: id === 'human' }));
  const cities = new CityManager();
  cities.addCity(new City({ id: 'city', name: 'City', ownerId: 'human', tileX: 0, tileY: 0 }));
  const map: MapData = { width: 8, height: 1, tileSize: 1, tiles: [Array.from({ length: 8 }, (_, x) => ({ x, y: 0, type: TileType.Plains, ownerId: 'human', ...(x === 7 ? { resourceId: 'coal' } : {}) }))] };
  const access = new ResourceAccessSystem(map, { getAllDeals: () => [] });
  const plants = new PowerPlantSystem(cities, access, map, 1);
  const resolutions = new WorldCouncilResolutionSystem();
  const diplomacy = new DiplomacyManager(); diplomacy.declareWar('threat', 'host');
  resolutions.setRuntime({ getAvailableInfluence: () => 1000, spendInfluence: (_id, n) => n,
    getAllNationIds: () => ['host', 'human', 'ally', 'threat'], isNationActive: () => true,
    getDiplomacyState: (a, b) => diplomacy.getState(a, b), getAggressorNationId: () => 'threat',
    isHumanNation: id => id === 'human', requestHumanInfluenceVote: () => ({ support: true, influence: 1000 }),
    areAllied: (a, b) => a === 'ally' && b === 'host', getMilitaryStrength: () => 100,
    getPeacekeepingUnits: id => id === 'ally' ? ['soldier'] : [],
    getEnergyPosition: id => getCouncilEnergyPosition(plants, id),
  });
  const council = new WorldCouncilSystem(nations, cities, { addGold: () => {} } as never, resolutions);
  const state: WorldCouncilState = { organizationKind: 'un', foundingCityId: 'city', foundingNationId: 'human', foundingTurn: 1,
    constructionStartedTurn: 1, constructionTurnsRemaining: 0, status: 'active', memberNationIds: ['host', 'human', 'ally', 'threat'],
    members: ['host', 'human', 'ally', 'threat'].map(member), lastRegularMeetingTurn: 1, nextRegularMeetingTurn: 1000, meetings: [], nextMeetingId: 1, enactedResolutions: [] };
  council.restore(state);
  const happiness = new HappinessSystem(nations, cities);
  happiness.setClimateComplianceProvider(id => council.getClimateComplianceHappiness(id, getCouncilEnergyPosition(plants, id).activeFossilPlants));
  const production = new ProductionSystem(cities, { on: () => {} } as never, happiness);
  const reason = (cityId: string, item: Producible) => getCouncilProductionBlockReason(council, cities.getCity(cityId)!.ownerId, item);
  production.setProductionProhibitionProvider(reason);
  council.onChanged(() => production.cancelProhibitedProduction(reason));
  const activate = (resolutionId: WorldCouncilResolutionId) => {
    const r: WorldCouncilEnactedResolution = { id: resolutionId, resolutionId, meetingId: 1, meetingKind: 'regular', turn: 1, active: true };
    council.restore({ ...council.getState()!, enactedResolutions: [...council.getState()!.enactedResolutions, r] });
  };
  const repeal = (resolutionId: WorldCouncilResolutionId) => {
    const active = council.getState()!.enactedResolutions.find(r => r.resolutionId === resolutionId)!;
    council.restore({ ...council.getState()!, meetings: [{ id: 2, kind: 'regular', turn: 2, cityId: 'city', proposals: [{ slot: 'host', resolutionId, proposerNationId: 'human', repealTargetEnactedResolutionId: active.id }] }] });
    // Human's explicit commitment outweighs the other members' opposition.
    return council.resolvePendingHumanVoteMeeting();
  };
  return { nations, cities, council, resolutions, plants, access, map, happiness, production, reason, activate, repeal, diplomacy };
}

for (const unitType of [ATOMIC_BOMB, NUCLEAR_MISSILE]) test(`NPT blocks ${unitType.name} through canonical enqueue, front insert, replacement and purchase completion`, () => {
  const h = fixture(); h.activate('nuclear_non_proliferation_treaty');
  const item = unitItem(unitType);
  assert.match(h.reason('city', item)!, /Non-Proliferation/);
  h.production.enqueue('city', item); h.production.enqueueFront('city', item); h.production.setProduction('city', item);
  assert.equal(h.production.getQueue('city').length, 0);
  h.production.restoreQueue('city', [{ item, accumulated: 10000 }]);
  assert.equal(h.production.completeCurrentProduction('city').kind, 'blocked');
});

test('NPT cancels only prohibited queue entries, preserves unrelated progress and existing weapons', () => {
  const h = fixture(); const weapon = new Unit({ id: 'existing', ownerId: 'human', unitType: NUCLEAR_MISSILE, tileX: 0, tileY: 0 });
  h.production.restoreQueue('city', [{ item: unitItem(WARRIOR), accumulated: 7 }, { item: unitItem(ATOMIC_BOMB), accumulated: 12 }, { item: building('nuclear_plant'), accumulated: 9 }]);
  h.activate('nuclear_non_proliferation_treaty');
  assert.equal(h.production.getQueue('city').length, 2);
  assert.equal(h.production.getQueue('city')[0].progress, 7);
  h.production.moveQueueEntryToFront('city', 1);
  assert.equal(h.production.getQueue('city')[0].progress, 9);
  assert.equal(weapon.ownerId, 'human'); assert.equal(weapon.unitType, NUCLEAR_MISSILE);
  assert.equal(h.reason('city', building('nuclear_plant')), undefined);
  assert.equal(getCouncilProductionBlockReason(h.council, 'outsider', unitItem(ATOMIC_BOMB)), undefined);
});

test('AI nuclear candidates use the same treaty rule and become available after repeal', () => {
  const h = fixture(); h.activate('nuclear_non_proliferation_treaty');
  const ai = Object.create(AISystem.prototype) as AISystem;
  ai.setUnitProductionRestrictionReason((id, type) => h.council.getUnitProductionRestrictionReason(id, type));
  assert.equal((ai as any).canBuildUnit('human', ATOMIC_BOMB.id), false);
  assert.equal((ai as any).canBuildUnit('human', NUCLEAR_MISSILE.id), false);
  assert.equal((ai as any).canBuildUnit('human', WARRIOR.id), true);
  h.repeal('nuclear_non_proliferation_treaty');
  assert.equal((ai as any).canBuildUnit('human', ATOMIC_BOMB.id), true);
});

for (const id of ['coal_power_plant', 'oil_power_plant']) test(`Climate Accord blocks new ${id} and cancels it from queues`, () => {
  const h = fixture(); h.production.enqueue('city', building(id)); h.activate('climate_accord');
  assert.match(h.reason('city', building(id))!, /Climate Accord/);
  assert.equal(h.production.getQueue('city').length, 0);
  h.production.enqueue('city', building(id)); assert.equal(h.production.getQueue('city').length, 0);
});
for (const id of ['gas_power_plant', 'nuclear_plant', 'hydro_plant']) test(`Accord and treaty leave ${id} legal`, () => {
  const h = fixture(); h.activate('climate_accord'); h.activate('nuclear_non_proliferation_treaty');
  assert.ok(getBuildingById(id)); assert.equal(h.reason('city', building(id)), undefined);
});

test('Climate compliance is exactly +5 nationally, does not stack, and disappears on repeal', () => {
  const h = fixture(); h.cities.addCity(new City({ id: 'second', ownerId: 'human', name: 'Second', tileX: 1, tileY: 0 }));
  h.happiness.recalculateAll(); const before = h.happiness.getNationState('human').totalHappiness;
  h.activate('climate_accord'); h.activate('climate_accord');
  assert.equal(h.happiness.getNationState('human').totalHappiness, before + 5);
  assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 5);
  assert.equal(h.happiness.getNationState('outsider').happinessFromClimateAccord, 0);
  h.repeal('climate_accord');
  assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 0);
  assert.equal(h.reason('city', building('coal_power_plant')), undefined);
});

for (const id of ['coal_power_plant', 'oil_power_plant']) test(`Existing active ${id} survives the Accord; final expiry activates compliance`, () => {
  const h = fixture(); h.map.tiles[0]![7]!.resourceId = id === 'coal_power_plant' ? 'coal' : 'oil'; h.access.invalidateResourceIndex();
  h.plants.completeConstruction('city', id); const plant = h.plants.getCityPowerPlant('city')!;
  assert.equal(plant.active, true); h.activate('climate_accord');
  assert.equal(h.plants.getCityPowerPlant('city')!.active, true);
  assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 0);
  h.plants.handleRoundStart(plant.lifespan + 1);
  assert.equal(h.plants.getCityPowerPlant('city'), undefined);
  assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 5);
});

test('Gaining an operational fossil plant removes the live bonus; losing fuel restores it', () => {
  const h = fixture(); h.activate('climate_accord'); assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 5);
  // Capture/restore may legitimately introduce an existing plant, bypassing new production.
  h.cities.getBuildings('city').add(getBuildingById('coal_power_plant')!);
  assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 0);
  h.map.tiles[0]![7]!.resourceId = undefined; h.access.invalidateResourceIndex();
  assert.equal(h.happiness.getNationState('human').happinessFromClimateAccord, 5);
});

test('AI climate votes distinguish actual fossil dependency and repeal reverses that preference', () => {
  const h = fixture(); h.plants.completeConstruction('city', 'coal_power_plant');
  assert.ok(h.resolutions.scorePolicySupport('human', 'climate_accord') < 0);
  assert.ok(h.resolutions.scorePolicySupport('ally', 'climate_accord') > 0);
  const result = h.resolutions.resolve({ slot: 'host', resolutionId: 'climate_accord', proposerNationId: 'ally' }, { meeting: { id: 1, kind: 'regular', turn: 1, cityId: 'city' }, turn: 1, members: [member('human'), member('ally')], previousEmergencyMeetings: [] });
  assert.ok(result.proposal.votes!.find(v => v.nationId === 'human')!.supportScore! < 0);
  assert.ok(result.proposal.votes!.find(v => v.nationId === 'ally')!.supportScore! > 0);
});

test('AI nuclear voting distinguishes established arsenals and aspiring nuclear powers', () => {
  const r = new WorldCouncilResolutionSystem(); r.setRuntime({ getNuclearPosition: id => ({ weapons: id === 'armed' ? 2 : 0, pursuing: true }) });
  assert.ok(r.scorePolicySupport('armed', 'nuclear_non_proliferation_treaty') > 0);
  assert.ok(r.scorePolicySupport('aspiring', 'nuclear_non_proliferation_treaty') < 0);
});

test('JSON save/load preserves both restrictions and live climate compliance without stored rewards', () => {
  const h = fixture(); h.activate('climate_accord'); h.activate('nuclear_non_proliferation_treaty');
  const saved = JSON.parse(JSON.stringify(h.council.getState())); const restored = fixture(); restored.council.restore(saved);
  assert.match(restored.reason('city', unitItem(ATOMIC_BOMB))!, /Non-Proliferation/);
  assert.match(restored.reason('city', building('oil_power_plant'))!, /Climate Accord/);
  assert.equal(restored.happiness.getNationState('human').happinessFromClimateAccord, 5);
  restored.cities.getBuildings('city').add(getBuildingById('coal_power_plant')!);
  restored.plants.restore([{ id: 'city', powerPlantAge: 8 }], 9);
  assert.equal(restored.happiness.getNationState('human').happinessFromClimateAccord, 0);
});

function startMission(h: ReturnType<typeof fixture>) {
  const meeting = { id: 4, kind: 'regular' as const, turn: 10, cityId: 'city' };
  const result = h.resolutions.resolve({ slot: 'host', resolutionId: 'un_peacekeeping_mission', proposerNationId: 'host', targetNationId: 'host', secondaryTargetNationId: 'threat' }, { meeting, turn: 10, members: h.council.getState()!.members, previousEmergencyMeetings: [] });
  assert.equal(result.proposal.passed, true);
  h.council.restore({ ...h.council.getState()!, enactedResolutions: [result.enacted!] });
  return result.enacted!;
}

test('Mission stores both targets and exactly 30 turns; only willing AI nations contribute', () => {
  const h = fixture(); const mission = startMission(h);
  assert.equal(mission.targetNationId, 'host'); assert.equal(mission.secondaryTargetNationId, 'threat');
  assert.equal(mission.expirationTurn! - mission.turn, 30);
  assert.deepEqual(mission.participantNationIds, ['ally']);
  assert.deepEqual(mission.peacekeepingContributions, [{ nationId: 'ally', unitIds: ['soldier'] }]);
  assert.equal(h.diplomacy.getState('ally', 'threat'), 'PEACE');
  assert.equal(h.council.getPeacekeepingAssignment('human', 'human-unit'), undefined);
});

test('Human pledge is explicit, preserves ownership, rejects invalid units and grants only unit-specific access', () => {
  const h = fixture(); const mission = startMission(h);
  const unit = new Unit({ id: 'human-unit', ownerId: 'human', unitType: WARRIOR, tileX: 0, tileY: 0 });
  assert.equal(h.council.canPeacekeeperEnterTerritory('human', 'host', true, unit.id), false);
  assert.equal(h.council.contributePeacekeepingUnits(mission.id, 'human', [], () => true), false);
  assert.equal(h.council.contributePeacekeepingUnits(mission.id, 'human', ['invalid'], () => false), false);
  assert.equal(h.council.contributePeacekeepingUnits(mission.id, 'human', [unit.id], id => id === unit.id && isEligiblePeacekeepingUnit(unit)), true);
  assert.equal(unit.ownerId, 'human');
  assert.equal(h.council.canPeacekeeperEnterTerritory('human', 'host', true, unit.id), true);
  assert.equal(h.council.canPeacekeeperEnterTerritory('human', 'host', true, 'unpledged'), false);
  assert.equal(h.council.canPeacekeeperEnterTerritory('human', 'threat', true, unit.id), false);
  assert.equal(h.council.contributePeacekeepingUnits(mission.id, 'outsider', ['outsider-unit'], () => true), false);
});

test('Mandate combat is defensive, target-specific and cannot capture cities or fight unrelated wars', () => {
  const h = fixture(); const mission = startMission(h);
  assert.equal(h.council.canResolvePeacekeepingCombat('ally', 'threat', 'host', 'soldier', 'enemy'), true);
  assert.equal(h.council.canResolvePeacekeepingCombat('threat', 'ally', 'host', 'enemy', 'soldier'), true);
  assert.equal(h.council.canResolvePeacekeepingCombat('ally', 'threat', 'threat', 'soldier', 'enemy'), false);
  assert.equal(isPeacekeepingAttackAllowed(mission, 'host', 'threat'), true);
  assert.equal(isPeacekeepingAttackAllowed(mission, 'host', undefined), false);
  assert.equal(isPeacekeepingAttackAllowed(mission, 'outsider', 'threat'), false);
  assert.equal(isPeacekeepingAttackAllowed(mission, 'host', 'outsider'), false);
});

test('AI assigned units execute their mandate and never fall through to conquest when stranded', () => {
  const h = fixture(); const mission = startMission(h);
  const ai = Object.create(AISystem.prototype) as any;
  ai.setPeacekeepingAssignmentProvider(() => mission);
  ai.unitManager = { getAllUnits: () => [] }; ai.cityManager = { getCitiesByOwner: () => [] };
  ai.mapData = h.map;
  assert.equal(ai.runPeacekeeper(new Unit({ id: 'soldier', ownerId: 'ally', unitType: WARRIOR, tileX: 0, tileY: 0 })), true);
});

test('Mission expiry removes access, combat permission and assignment; independently granted borders survive', () => {
  const h = fixture(); startMission(h);
  h.diplomacy.toggleOpenBorders('host', 'ally');
  h.council.handleTurnStart({ round: 39, nation: h.nations.getNation('human')! } as never);
  assert.ok(h.council.getPeacekeepingAssignment('ally', 'soldier'));
  h.council.handleTurnStart({ round: 40, nation: h.nations.getNation('human')! } as never);
  assert.equal(h.council.getPeacekeepingAssignment('ally', 'soldier'), undefined);
  assert.equal(h.council.canPeacekeeperEnterTerritory('ally', 'host', true, 'soldier'), false);
  assert.equal(h.council.canResolvePeacekeepingCombat('ally', 'threat', 'host', 'soldier', 'enemy'), false);
  assert.equal(h.diplomacy.isOpenBorderGrantedFrom('host', 'ally'), true);
  assert.equal(h.diplomacy.getState('ally', 'threat'), 'PEACE');
});

test('Active mission save/load preserves commitments and remaining duration; cloned state cannot mutate assignments', () => {
  const h = fixture(); startMission(h);
  const saved = JSON.parse(JSON.stringify(h.council.getState())); const restored = fixture(); restored.council.restore(saved);
  restored.council.handleTurnStart({ round: 22, nation: restored.nations.getNation('human')! } as never);
  assert.equal(restored.council.getPeacekeepingAssignment('ally', 'soldier')!.expirationTurn! - 22, 18);
  assert.equal(restored.council.canPeacekeeperEnterTerritory('ally', 'host', true, 'soldier'), true);
  (saved.enactedResolutions[0].peacekeepingContributions[0].unitIds as string[]).push('unpledged');
  assert.equal(restored.council.getPeacekeepingAssignment('ally', 'unpledged'), undefined);
});

test('Older mission saves grant no blanket army access and remain safe', () => {
  const h = fixture(); const mission = startMission(h);
  h.council.restore({ ...h.council.getState()!, enactedResolutions: [{ ...mission, peacekeepingContributions: undefined }] });
  assert.equal(h.council.canPeacekeeperEnterTerritory('ally', 'host', true, 'unpledged'), false);
});

test('Workers and nuclear weapons cannot be pledged', () => {
  for (const type of [WORKER, ATOMIC_BOMB, NUCLEAR_MISSILE]) assert.equal(isEligiblePeacekeepingUnit(new Unit({ id: type.id, ownerId: 'human', unitType: type, tileX: 0, tileY: 0 })), false);
});

test('All three definitions preserve UN-only availability and support existing repeal', () => {
  const r = new WorldCouncilResolutionSystem();
  for (const id of ['climate_accord', 'nuclear_non_proliferation_treaty', 'un_peacekeeping_mission'] as const) {
    assert.ok(r.getDefinitions('un').some(d => d.id === id));
    assert.ok(!r.getDefinitions('worldCouncil').some(d => d.id === id));
    assert.equal(r.supportsRepeal(id), true);
  }
});

// Minimal DOM exercises actual rendered controls and explicit commitment semantics.
test('Human contribution controls require explicit selection and commitment; declining commits nothing', () => {
  class Node {
    children: any[] = []; style = {}; textContent = ''; type = ''; checked = false; onchange?: () => void; onclick?: () => void;
    constructor(public tag: string) {} append(...nodes: any[]) { this.children.push(...nodes); } appendChild(node: any) { this.children.push(node); }
    replaceChildren(...nodes: any[]) { this.children = nodes; }
  }
  const previous = globalThis.document;
  (globalThis as any).document = { createElement: (tag: string) => new Node(tag), createTextNode: (text: string) => text };
  try {
    const pledges: string[][] = [];
    const choice = { contributionUnits: [{ id: 'unit', name: 'Infantry' }], contribute: (ids: string[]) => { if (!ids.length) return false; pledges.push(ids); return true; } };
    const root = buildPeacekeepingContributionControls(choice) as unknown as Node;
    assert.equal(pledges.length, 0);
    const checkbox = root.children[1].children[0]; checkbox.checked = true; checkbox.onchange();
    assert.equal(pledges.length, 0);
    root.children[2].onclick(); assert.deepEqual(pledges, [['unit']]);
    const declined = buildPeacekeepingContributionControls(choice) as unknown as Node;
    declined.children[3].onclick(); assert.equal(pledges.length, 1);
  } finally { (globalThis as any).document = previous; }
});

test('Mission repeal releases units and access without requiring expiry', () => {
  const h = fixture(); startMission(h); h.repeal('un_peacekeeping_mission');
  assert.equal(h.council.getPeacekeepingAssignment('ally', 'soldier'), undefined);
  assert.equal(h.council.canPeacekeeperEnterTerritory('ally', 'host', true, 'soldier'), false);
});

test('No mandate is proposed without a threat, and missions cannot bypass a ceasefire', () => {
  const h = fixture(); assert.equal(h.resolutions.isProposalEligible('un_peacekeeping_mission', 'host'), true);
  startMission(h);
  h.resolutions.setRuntime({ getAllNationIds: () => ['host', 'threat'], getDiplomacyState: () => 'PEACE', getMilitaryStrength: () => 0 });
  assert.equal(h.resolutions.isProposalEligible('un_peacekeeping_mission', 'host'), false);
  assert.equal(h.council.canResolvePeacekeepingCombat('ally', 'threat', 'host', 'soldier', 'enemy'), false);
  h.resolutions.setRuntime({ getDiplomacyState: () => 'WAR', canAttack: () => false });
  assert.equal(h.council.canResolvePeacekeepingCombat('ally', 'threat', 'host', 'soldier', 'enemy'), false);
});

test('Deterrence counts only the strength of contributed, surviving units', () => {
  const h = fixture(); startMission(h);
  assert.equal(h.council.getPeacekeepingDefensivePowerAgainst('threat', 'host', (_nation, ids) => ids.includes('soldier') ? 7 : 0), 7);
  assert.equal(h.council.getPeacekeepingDefensivePowerAgainst('threat', 'host', () => 0), 0);
  assert.equal(h.council.getPeacekeepingDefensivePowerAgainst('outsider', 'host', () => 7), 0);
});

test('Canonical movement grants pledged units access and preserves independent border agreements after expiry', async () => {
  const { MovementSystem } = await import('../src/systems/MovementSystem');
  const h = fixture(); startMission(h);
  const movement = Object.create(MovementSystem.prototype) as any;
  movement.diplomacyManager = h.diplomacy;
  movement.setMissionMovementPermission(() => true);
  movement.canPeacekeeperEnterTerritory = (unit: Unit, owner: string) => h.council.canPeacekeeperEnterTerritory(unit.ownerId, owner, true, unit.id);
  const unit = new Unit({ id: 'soldier', ownerId: 'ally', unitType: WARRIOR, tileX: 0, tileY: 0 });
  const tile = { x: 1, y: 0, type: TileType.Plains, ownerId: 'host' };
  assert.equal(movement.canUnitPeacefullyEnterTile(unit, tile), true);
  h.council.handleTurnStart({ round: 40, nation: h.nations.getNation('human')! } as never);
  assert.equal(movement.canUnitPeacefullyEnterTile(unit, tile), false);
  h.diplomacy.toggleOpenBorders('host', 'ally');
  assert.equal(movement.canUnitPeacefullyEnterTile(unit, tile), true);
});

test('Canonical combat admits defensive intervention without declaring war and denies city conquest', async () => {
  const { CombatSystem } = await import('../src/systems/CombatSystem');
  const h = fixture(); startMission(h);
  const unit = new Unit({ id: 'soldier', ownerId: 'ally', unitType: WARRIOR, tileX: 0, tileY: 0 });
  let target: Unit | undefined = new Unit({ id: 'enemy', ownerId: 'threat', unitType: WARRIOR, tileX: 1, tileY: 0 });
  const combat = Object.create(CombatSystem.prototype) as any;
  combat.turnManager = { getCurrentNation: () => h.nations.getNation('ally') };
  combat.isUnitCombatBlocked = () => false;
  combat.mapData = h.map; h.map.tiles[0]![1]!.ownerId = 'host';
  combat.gridSystem = { getDistance: () => 1, isAdjacent: () => true };
  combat.unitManager = { getUnitAt: () => target };
  combat.cityManager = { getCityAt: () => ({ ownerId: 'host' }) };
  combat.diplomacyManager = h.diplomacy;
  combat.canResolvePeacekeepingCombat = (a: Unit, b: Unit, owner: string) => h.council.canResolvePeacekeepingCombat(a.ownerId, b.ownerId, owner, a.id, b.id);
  let combats = 0; combat.executeUnitCombat = () => { combats++; return true; };
  combat.setMissionAttackPermission((u: Unit) => isPeacekeepingAttackAllowed(h.council.getPeacekeepingAssignment(u.ownerId, u.id), 'host', target?.ownerId));
  assert.equal(combat.tryAttack(unit, 1, 0), true); assert.equal(combats, 1);
  assert.equal(h.diplomacy.getState('ally', 'threat'), 'PEACE');
  target = undefined; assert.equal(combat.tryAttack(unit, 1, 0), false); assert.equal(combats, 1);
});

test('AI contingent uses normal pathfinding and movement to deploy near the protected city', () => {
  const h = fixture(); const mission = startMission(h);
  const unit = new Unit({ id: 'soldier', ownerId: 'ally', unitType: WARRIOR, tileX: 0, tileY: 0 });
  const ai = Object.create(AISystem.prototype) as any;
  ai.setPeacekeepingAssignmentProvider(() => h.council.getPeacekeepingAssignment('ally', unit.id));
  ai.unitManager = { getAllUnits: () => [], getUnitAt: () => undefined };
  ai.cityManager = { getCitiesByOwner: (id: string) => { assert.equal(id, mission.targetNationId); return [{ tileX: 2, tileY: 0 }]; } };
  ai.mapData = h.map;
  const tile = { x: 1, y: 0, ownerId: 'host', type: TileType.Plains };
  ai.gridSystem = { getTilesInRange: () => [tile], getDistance: () => 1 };
  ai.pathfindingSystem = { findPath: (u: Unit, x: number, y: number) => { assert.equal(u, unit); assert.deepEqual([x, y], [1, 0]); return [tile]; } };
  let moves = 0; ai.movementSystem = { moveAlongPath: (u: Unit, path: any[]) => { assert.equal(u, unit); assert.deepEqual(path, [tile]); moves++; } };
  assert.equal(ai.runPeacekeeper(unit), true); assert.equal(moves, 1);
  h.council.handleTurnStart({ round: 40, nation: h.nations.getNation('human')! } as never);
  assert.equal(ai.runPeacekeeper(unit), false);
});

test('Inherited or restored prohibited queues are cancelled before any turn production accrues', () => {
  const h = fixture(); h.activate('climate_accord'); h.activate('nuclear_non_proliferation_treaty');
  h.production.restoreQueue('city', [{ item: unitItem(NUCLEAR_MISSILE), accumulated: 20 }, { item: building('coal_power_plant'), accumulated: 10 }, { item: unitItem(WARRIOR), accumulated: 7 }]);
  (h.production as any).handleTurnStart({ round: 2, nation: h.nations.getNation('human')! });
  assert.equal(h.production.getQueue('city').length, 1);
  assert.equal(h.production.getQueue('city')[0].progress, 7);
});
