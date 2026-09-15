import assert from 'node:assert/strict';
import test from 'node:test';
import { NUCLEAR_WARHEAD } from '../src/data/strategicComponents';
import { ICBM, NUCLEAR_MISSILE } from '../src/data/units';
import { getGameSpeedById } from '../src/data/gameSpeeds';
import { Nation } from '../src/entities/Nation';
import { City } from '../src/entities/City';
import { NationManager } from '../src/systems/NationManager';
import { CityManager } from '../src/systems/CityManager';
import { UnitManager } from '../src/systems/UnitManager';
import { TurnManager } from '../src/systems/TurnManager';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService';
import { WorldCouncilSystem } from '../src/systems/WorldCouncilSystem';
import { WorldCouncilResolutionSystem } from '../src/systems/WorldCouncilResolutionSystem';
import { getCouncilProductionBlockReason } from '../src/systems/WorldCouncilPolicyEffects';
import { initializeUrbanDevelopment } from '../src/systems/UrbanDevelopment';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType, type MapData } from '../src/types/map';
import type { SavedCity, SavedNation, SavedUnit } from '../src/types/saveGame';
import type { WorldCouncilMember, WorldCouncilState } from '../src/types/worldCouncil';

const warhead = { kind: 'strategicComponent' as const, componentType: NUCLEAR_WARHEAD };

function fixture() {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'owner', name: 'Owner', color: 1, isHuman: true, researchedTechIds: ['nuclear_fission', 'satellites'] }));
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'City', ownerId: 'owner', tileX: 1, tileY: 1 });
  cities.addCity(city);
  const map: MapData = { width: 4, height: 4, tileSize: 16, tiles: Array.from({ length: 4 }, (_, y) =>
    Array.from({ length: 4 }, (_, x) => ({ x, y, type: TileType.Plains, ownerId: 'owner' }))) };
  initializeUrbanDevelopment(city, map);
  const turns = new TurnManager(nations, getGameSpeedById('marathon'));
  const happiness = new HappinessSystem(nations, cities);
  const production = new ProductionSystem(cities, turns, happiness, getGameSpeedById('marathon'), undefined, nations);
  let hasUranium = true;
  production.setStrategicComponentResourceAccessProvider((_id, resource, amount) => resource === 'uranium' && amount === 1 && hasUranium);
  const units = new UnitManager(4, 4);
  return { nations, cities, city, map, turns, production, units, setUranium: (value: boolean) => { hasUranium = value; } };
}

test('Nuclear Warhead is a costly, separately produced national inventory component', () => {
  const h = fixture();
  assert.ok(NUCLEAR_WARHEAD.productionCost >= ICBM.productionCost * 3);
  assert.equal(h.production.getCost(warhead, h.city.id), 1800);
  h.production.enqueue(h.city.id, warhead);
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 0);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 1);
  assert.equal(h.units.getAllUnits().length, 0);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'empty');
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 1);
});

test('technology and Uranium gates apply at queue insertion and completion; blocked work creates no inventory', () => {
  const h = fixture();
  const nation = h.nations.getNation('owner')!;
  nation.researchedTechIds = [];
  assert.match(h.production.getItemProductionBlockReason(h.city.id, warhead)!, /Nuclear Fission/);
  h.production.enqueue(h.city.id, warhead);
  assert.equal(h.production.getQueue(h.city.id).length, 0);
  nation.researchedTechIds = ['nuclear_fission'];
  h.setUranium(false);
  h.production.enqueueFront(h.city.id, warhead);
  assert.match(h.production.getItemProductionBlockReason(h.city.id, warhead)!, /Uranium/);
  assert.equal(h.production.getQueue(h.city.id).length, 0);
  h.setUranium(true);
  h.production.enqueue(h.city.id, warhead);
  h.setUranium(false);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'blocked');
  assert.equal(nation.nuclearWarheads, 0);
  h.setUranium(true);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(nation.nuclearWarheads, 1);
});

test('a completion listener rejecting a warhead never awards inventory', () => {
  const h = fixture();
  let blocked = true;
  h.production.onCompleted(() => !blocked);
  h.production.enqueue(h.city.id, warhead);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'blocked');
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 0);
  blocked = false;
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 1);
});

test('NPT blocks and cancels new warheads, preserving conventional ICBMs and existing nuclear inventory', () => {
  const h = fixture();
  const council = new WorldCouncilSystem(h.nations, h.cities, { addGold: () => {} } as never, new WorldCouncilResolutionSystem());
  const member: WorldCouncilMember = { nationId: 'owner', goldContributed: 0, scienceContributionPercent: 0, cultureContributionPercent: 0,
    diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0, diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0,
    diplomacyScoreFromGold: 0, diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0 };
  const state: WorldCouncilState = { organizationKind: 'un', foundingCityId: h.city.id, foundingNationId: 'owner', foundingTurn: 1,
    constructionStartedTurn: 1, constructionTurnsRemaining: 0, status: 'active', memberNationIds: ['owner'], members: [member],
    lastRegularMeetingTurn: 1, nextRegularMeetingTurn: 51, meetings: [], nextMeetingId: 1, enactedResolutions: [] };
  council.restore(state);
  h.production.setProductionProhibitionProvider((_city, item) => getCouncilProductionBlockReason(council, 'owner', item));
  h.nations.getNation('owner')!.nuclearWarheads = 2;
  h.production.restoreQueue(h.city.id, [{ item: warhead, accumulated: 800 }, { item: { kind: 'unit', unitType: ICBM }, accumulated: 75 }]);
  council.restore({ ...state, enactedResolutions: [{ id: 'npt', resolutionId: 'nuclear_non_proliferation_treaty', meetingId: 1, turn: 1, active: true }] });
  assert.match(h.production.getItemProductionBlockReason(h.city.id, warhead)!, /Non-Proliferation/);
  assert.equal(council.getUnitProductionRestrictionReason('owner', ICBM.id), undefined);
  assert.equal(council.getStrategicComponentProductionRestrictionReason('nonmember', NUCLEAR_WARHEAD.id), undefined);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'blocked');
  h.production.cancelProhibitedProduction();
  assert.equal(h.production.getQueue(h.city.id).length, 1);
  assert.equal(h.production.getQueue(h.city.id)[0]!.progress, 75);
  h.production.enqueue(h.city.id, warhead);
  h.production.enqueueFront(h.city.id, warhead);
  h.production.setProduction(h.city.id, warhead);
  assert.equal(h.production.getQueue(h.city.id).length, 1);
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 2);
  council.restore(state);
  assert.equal(h.production.getItemProductionBlockReason(h.city.id, warhead), undefined);
});

function serialize(h: ReturnType<typeof fixture>) {
  return JSON.parse(JSON.stringify(SaveLoadService.serialize({
    mapKey: 'strategic-components-test', humanNationId: 'owner', activeNationIds: ['owner'], gameSpeedId: 'marathon',
    mapData: h.map, nationManager: h.nations, cityManager: h.cities, unitManager: h.units, productionSystem: h.production,
    policySystem: { getActivePolicyAssignments: () => [] },
    diplomacyManager: new DiplomacyManager(),
    discoverySystem: { getAllMetPairs: () => [] }, turnManager: h.turns, gridSystem: new HexGridSystem(), wonderSystem: { getCompletedWonders: () => [] },
  } as unknown as SaveLoadContext))) as ReturnType<typeof SaveLoadService.serialize>;
}

const restore = SaveLoadService as unknown as {
  applyNations: (nations: SavedNation[], manager: NationManager) => void;
  applyUnits: (units: SavedUnit[], manager: UnitManager) => void;
  applyCitiesAndProduction: (cities: SavedCity[], manager: CityManager, production: ProductionSystem, map: MapData, grid: HexGridSystem, speed: string) => void;
};

test('JSON save/load preserves unused warheads, queued components and conventional/nuclear missile assignments', () => {
  const h = fixture();
  h.nations.getNation('owner')!.nuclearWarheads = 3;
  const conventional = h.units.createUnit({ type: ICBM, ownerId: 'owner', tileX: 0, tileY: 0, missileLaunchPad: { x: 0, y: 0 } });
  const armed = h.units.createUnit({ type: ICBM, ownerId: 'owner', tileX: 0, tileY: 0, missileLaunchPad: { x: 0, y: 0 }, nuclearArmed: true });
  h.production.restoreQueue(h.city.id, [{ item: warhead, accumulated: 345 }]);
  const saved = serialize(h);
  const restored = fixture();
  restore.applyNations(saved.nations, restored.nations);
  restore.applyUnits(saved.units, restored.units);
  restore.applyCitiesAndProduction(saved.cities, restored.cities, restored.production, restored.map, new HexGridSystem(), 'marathon');
  assert.equal(restored.nations.getNation('owner')!.nuclearWarheads, 3);
  assert.deepEqual(restored.units.getUnit(armed.id)!.missileLaunchPad, { x: 0, y: 0 });
  assert.equal(restored.units.getUnit(armed.id)!.nuclearArmed, true);
  assert.equal(restored.units.getUnit(conventional.id)!.nuclearArmed, false);
  const queued = restored.production.getQueue(h.city.id)[0]!;
  assert.equal(queued.item.kind, 'strategicComponent');
  assert.equal(queued.progress, 345);
  assert.equal(queued.cost, 1800);
});

test('saves without new strategic fields retain legacy missiles and default to no warheads', () => {
  const h = fixture();
  const missile = h.units.createUnit({ type: NUCLEAR_MISSILE, ownerId: 'owner', tileX: 1, tileY: 1 });
  const saved = serialize(h);
  for (const nation of saved.nations) delete nation.nuclearWarheads;
  for (const unit of saved.units) { delete unit.missileLaunchPad; delete unit.nuclearArmed; }
  h.nations.getNation('owner')!.nuclearWarheads = 9;
  restore.applyNations(saved.nations, h.nations);
  restore.applyUnits(saved.units, h.units);
  assert.equal(h.nations.getNation('owner')!.nuclearWarheads, 0);
  assert.equal(h.units.getUnit(missile.id)!.unitType.id, 'nuclear_missile');
  assert.equal(h.units.getUnit(missile.id)!.missileLaunchPad, undefined);
  assert.equal(h.units.getUnit(missile.id)!.nuclearArmed, false);
});
