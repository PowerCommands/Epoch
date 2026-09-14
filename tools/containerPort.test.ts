import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createCanvas, loadImage } from 'canvas';
import { ALL_BUILDINGS, CONTAINER_PORT, HARBOR, MARKET, SEAPORT } from '../src/data/buildings';
import { getAIStrategyById } from '../src/data/aiStrategies';
import { getCorporationById } from '../src/data/corporations';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { ResearchSystem } from '../src/systems/ResearchSystem';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem';
import { completeBuildingUpgrade, getBuildingUpgradeBlockReason, normalizeBuildingUpgrades } from '../src/systems/buildingUpgrades';
import { calculateCityEconomy } from '../src/systems/CityEconomy';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TradeConnectionSystem } from '../src/systems/TradeConnectionSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { AISystem } from '../src/systems/AISystem';
import { getUrbanInfrastructureCandidates } from '../src/systems/ai/AIUrbanDevelopment';
import { scoreAIProductionCandidate } from '../src/systems/ai/AIProductionScoring';
import { getSettlementProgress } from '../src/systems/SettlementProgress';
import { initializeUrbanDevelopment } from '../src/systems/UrbanDevelopment';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService';
import { CorporationSystem } from '../src/systems/CorporationSystem';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem';
import { PORT_CRANE_PERIOD, PORT_TRUCK_PERIOD, portCranePose, portTruckPose } from '../src/systems/rendering/ContainerPortActivity';
import { TileType, type MapData } from '../src/types/map';

function harness() {
  const nationManager = new NationManager(), cityManager = new CityManager();
  const nation = new Nation({ id: 'port_nation', name: 'Port Nation', color: 0x224466 });
  nationManager.addNation(nation);
  const city = new City({ id: 'port_city', name: 'Port City', ownerId: nation.id, tileX: 2, tileY: 2 });
  const mapData: MapData = { width: 5, height: 5, tileSize: 64, tiles: Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) => ({ x, y, ownerId: nation.id, type: x === 1 && y === 1 ? TileType.Coast : TileType.Plains }))) };
  city.ownedTileCoords = mapData.tiles.flat().map(({ x, y }) => ({ x, y }));
  initializeUrbanDevelopment(city, mapData);
  cityManager.addCity(city);
  const buildings = cityManager.getBuildings(city.id), tile = mapData.tiles[1][1];
  const turnManager = new TurnManager(nationManager);
  const production = new ProductionSystem(cityManager, turnManager, new HappinessSystem(nationManager, cityManager));
  const research = new ResearchSystem(nationManager, cityManager, () => 1), placement = new BuildingPlacementSystem();
  production.setItemProductionBlockReasonProvider((_id, item) => item.kind === 'building'
    ? !research.isBuildingUnlocked(nation.id, item.buildingType.id) ? 'Requires technology' : getBuildingUpgradeBlockReason(cityManager.getBuildings(city.id), item.buildingType)
    : undefined);
  production.onCompleted((_id, item) => {
    if (item.kind !== 'building') return true;
    if (!placement.completePhysicalBuilding(cityManager.getCity(city.id)!, item.buildingType, mapData)) return false;
    completeBuildingUpgrade(cityManager.getBuildings(city.id), item.buildingType);
    return true;
  });
  const install = (building = SEAPORT) => { tile.buildingId = building.id; buildings.add(building); };
  return { nationManager, cityManager, nation, city, mapData, buildings, tile, turnManager, production, research, placement, install };
}

test('Container Port unlocks at Combustion and replaces Seaport with exactly the requested modifiers', () => {
  const h = harness();
  assert.equal(ALL_BUILDINGS.filter(b => b.id === CONTAINER_PORT.id).length, 1);
  assert.equal(CONTAINER_PORT.placement, 'water');
  assert.equal(CONTAINER_PORT.upgradesFrom, SEAPORT.id);
  assert.deepEqual(CONTAINER_PORT.modifiers, { productionPerTurn: 2, goldPerTurn: 2, productionPercent: 10, happinessPerTurn: 2, tradeCapacity: 5 });
  assert.equal(h.research.getRequiredTechnologyForBuilding(CONTAINER_PORT.id)?.id, 'combustion');
  h.install();
  h.production.enqueue(h.city.id, { kind: 'building', buildingType: CONTAINER_PORT });
  assert.equal(h.production.getQueue(h.city.id).length, 0);
  h.nation.researchedTechIds.push('combustion');
  assert.equal(h.placement.startPlacement(h.city, CONTAINER_PORT.id, h.mapData), false);
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city, CONTAINER_PORT, h.mapData), [{ x: 1, y: 1 }]);
  h.production.enqueue(h.city.id, { kind: 'building', buildingType: CONTAINER_PORT });
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.tile.buildingId, CONTAINER_PORT.id);
  assert.deepEqual(h.buildings.getAll(), [CONTAINER_PORT.id]);
  for (const building of [HARBOR, SEAPORT, CONTAINER_PORT]) assert.ok(getBuildingUpgradeBlockReason(h.buildings, building));
});

test('Harbor alone cannot skip Seaport, another city cannot supply it, and protected infrastructure retains its rules', () => {
  const h = harness();
  h.nation.researchedTechIds.push('combustion'); h.install(HARBOR);
  assert.match(getBuildingUpgradeBlockReason(h.buildings, CONTAINER_PORT)!, /Requires Seaport/);
  const other = new City({ id: 'other', name: 'Other', ownerId: h.nation.id, tileX: 4, tileY: 4 });
  h.cityManager.addCity(other); h.cityManager.getBuildings(other.id).add(SEAPORT);
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city, CONTAINER_PORT, h.mapData), []);
  assert.match(getBuildingUpgradeBlockReason({ has: id => id === SEAPORT.id, isProtected: () => true }, CONTAINER_PORT)!, /Permanent Town/);
});

test('economy, happiness and trade count only the Container Port; damage removes its effects', () => {
  const h = harness(); h.city.population = 20;
  const economy = () => calculateCityEconomy(h.city, h.mapData, h.buildings, new HexGridSystem());
  const baseline = economy();
  const trade = new TradeConnectionSystem(h.cityManager, new DiplomacyManager(), h.nationManager);
  h.install(HARBOR); completeBuildingUpgrade(h.buildings, SEAPORT); completeBuildingUpgrade(h.buildings, CONTAINER_PORT);
  assert.equal(economy().production, Math.floor((baseline.production + 2) * 1.10));
  assert.equal(economy().gold, baseline.gold + 2);
  assert.equal(economy().happiness, baseline.happiness + 2);
  assert.equal(trade.getCityTradeCapacity(h.city.id), 6);
  h.buildings.setBroken(CONTAINER_PORT.id, true);
  assert.deepEqual(economy(), baseline);
  assert.equal(trade.getCityTradeCapacity(h.city.id), 1);
  assert.ok(getBuildingUpgradeBlockReason(h.buildings, SEAPORT));
});

test('legacy mixed harbor levels normalize to the final Container Port without stacking', () => {
  const h = harness();
  for (const building of [HARBOR, SEAPORT, CONTAINER_PORT]) h.buildings.add(building);
  assert.deepEqual(new Set(normalizeBuildingUpgrades(h.buildings)), new Set([HARBOR.id, SEAPORT.id]));
  assert.deepEqual(h.buildings.getAll(), [CONTAINER_PORT.id]);
});

test('AI offers the unlocked upgrade once and retains naval infrastructure preference', () => {
  const h = harness(); h.install();
  const ai = Object.create(AISystem.prototype);
  Object.assign(ai, { cityManager: h.cityManager, nationManager: h.nationManager, productionSystem: h.production,
    mapData: h.mapData, buildingPlacementSystem: h.placement,
    canBuildBuilding: (nationId: string, id: string) => h.research.isBuildingUnlocked(nationId, id), pickBestAvailableWorldWonder: () => undefined });
  const candidates = () => ai.getPeaceInfrastructureCandidates(h.city, h.nation.id, {}).filter((c: any) => c.item.buildingType?.id === CONTAINER_PORT.id);
  assert.equal(candidates().length, 0);
  h.nation.researchedTechIds.push('combustion');
  const [candidate] = candidates(); assert.ok(candidate.baseScore > 0); assert.equal(candidates().length, 1);
  const strategy = getAIStrategyById('balanced')!;
  assert.ok(scoreAIProductionCandidate(candidate, strategy, undefined, 'naval') > scoreAIProductionCandidate(candidate, strategy));
  h.production.enqueue(h.city.id, candidate.item); assert.equal(candidates().length, 0);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed'); assert.equal(candidates().length, 0);
});

test('City View and AI retain the transport development slot through Container Port and its damaged state', () => {
  const h = harness(); h.city.settlementStage = 'Town'; h.install(CONTAINER_PORT);
  for (const broken of [false, true]) {
    h.buildings.setBroken(CONTAINER_PORT.id, broken);
    const progress = getSettlementProgress(h.city, h.buildings, () => true);
    assert.equal(progress.slots[0].complete, true);
    assert.equal(progress.slots[0].spriteId, CONTAINER_PORT.id);
    assert.equal(progress.slots[0].broken, broken);
    assert.ok(!getUrbanInfrastructureCandidates(h.city, h.buildings, () => true).some(c => ['seaport', 'railway_station'].includes(c.building.id)));
  }
});

test('maritime corporations accept upgraded ports, count each city once, and stop when damaged', () => {
  const h = harness(); h.install(CONTAINER_PORT); h.buildings.add(MARKET);
  h.nation.researchedTechIds.push('navigation', 'guilds');
  h.mapData.tiles[0][0].resourceId = 'spices';
  const resources = new ResourceAccessSystem(h.mapData, { getAllDeals: () => [] });
  const corporations = new CorporationSystem(h.nationManager, h.cityManager, { researchSystem: h.research, resourceAccessSystem: resources });
  for (const id of ['hanseatic_league', 'dutch_east_india_company']) {
    const def = getCorporationById(id)!;
    assert.deepEqual(corporations.getCityCorporationBlockers(h.city, id), []);
    assert.equal(corporations.foundCorporation(h.nation.id, id, h.city.id), true);
    assert.equal(corporations.getNationManufacturedResources(h.nation.id).get(def.manufacturedResourceId), 1);
  }
  h.buildings.setBroken(CONTAINER_PORT.id, true);
  assert.equal(corporations.getNationManufacturedResources(h.nation.id).get('colonial_goods') ?? 0, 0);
  assert.equal(corporations.getNationManufacturedResources(h.nation.id).get('trade_goods') ?? 0, 0);
});

test('real serialization restores legacy Seaports, queued upgrades, completed and broken Container Ports', () => {
  for (const state of ['legacy', 'queued', 'built', 'broken']) {
    const h = harness(); h.nation.researchedTechIds.push('combustion');
    h.install(state === 'built' || state === 'broken' ? CONTAINER_PORT : SEAPORT);
    if (state === 'broken') h.buildings.setBroken(CONTAINER_PORT.id, true);
    if (state === 'queued') h.production.enqueue(h.city.id, { kind: 'building', buildingType: CONTAINER_PORT });
    const save = SaveLoadService.serialize({ mapKey: 'port-test', humanNationId: h.nation.id, activeNationIds: [h.nation.id], gameSpeedId: 'standard',
      mapData: h.mapData, nationManager: h.nationManager, cityManager: h.cityManager, productionSystem: h.production, turnManager: h.turnManager,
      unitManager: { getAllUnits: () => [] }, policySystem: { getActivePolicyAssignments: () => [] },
      diplomacyManager: { getAllStates: () => [], getAllVassalRelationships: () => [], getPendingPeaceProposals: () => [], getPeaceTreatyCooldownTurns: () => 0, getMinPeaceNegotiationTurns: () => 0 },
      discoverySystem: { getAllMetPairs: () => [] }, gridSystem: new HexGridSystem(), wonderSystem: { getCompletedWonders: () => [] },
    } as unknown as SaveLoadContext);
    const restored = harness(); restored.nation.researchedTechIds.push('combustion');
    SaveLoadService.restoreTiles(save.tiles, restored.mapData);
    (SaveLoadService as any).applyCitiesAndProduction(save.cities, restored.cityManager, restored.production, restored.mapData, new HexGridSystem(), 'standard');
    assert.deepEqual(restored.cityManager.getBuildings(h.city.id).getAllEntries(), h.buildings.getAllEntries());
    assert.equal(restored.tile.buildingId, h.tile.buildingId);
    const queue = restored.production.getQueue(h.city.id);
    assert.equal(queue.length, state === 'queued' ? 1 : 0);
    if (state === 'queued') {
      assert.equal(queue[0].item.kind === 'building' && queue[0].item.buildingType, CONTAINER_PORT);
      assert.equal(restored.production.completeCurrentProduction(h.city.id).kind, 'completed');
      assert.equal(restored.tile.buildingId, CONTAINER_PORT.id);
      assert.deepEqual(restored.cityManager.getBuildings(h.city.id).getAll(), [CONTAINER_PORT.id]);
    }
  }
});

test('crane cycles clear cargo before traversing and release before returning; truck routes loop without drift', () => {
  assert.equal(portCranePose(1, 0).lift, 0); assert.equal(portCranePose(3, 0).lift, 1);
  assert.equal(portCranePose(4, 0).lift, 1); assert.ok(portCranePose(4, 0).travel > 0);
  assert.equal(portCranePose(8, 0).travel, 1); assert.equal(portCranePose(8, 0).lift, 0);
  assert.equal(portCranePose(9, 0).loaded, false); assert.equal(portCranePose(13, 0).lift, 1);
  for (let t = 0; t < 18; t += .125) {
    const p = portCranePose(t, .31), repeated = portCranePose(t + PORT_CRANE_PERIOD * 100, .31);
    assert.ok(Math.abs(p.travel - repeated.travel) < 1e-10 && Math.abs(p.lift - repeated.lift) < 1e-10);
    assert.ok(p.travel >= 0 && p.travel <= 1 && p.lift >= 0 && p.lift <= 1);
    if (p.travel > 0 && p.travel < 1) assert.equal(p.lift, 1);
  }
  assert.notDeepEqual(portCranePose(4, .1), portCranePose(4, .7));
  assert.deepEqual(portTruckPose(7, 0), portTruckPose(8, 0));
  assert.equal(portTruckPose(16, 0).visible, false);
  for (const outbound of [false, true]) for (let t = 0; t < 20; t += .25) {
    const p = portTruckPose(t, .2, outbound), repeated = portTruckPose(t + PORT_TRUCK_PERIOD * 100, .2, outbound);
    assert.ok(Math.abs(p.x - repeated.x) < 1e-10 && Math.abs(p.y - repeated.y) < 1e-10);
    assert.ok(p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1);
  }
});

test('normal and damaged sprites have real transparency and an editor catalogue entry', async () => {
  for (const suffix of ['', '-broken']) {
    const image = await loadImage(`public/assets/sprites/buildings/container_port${suffix}.png`);
    assert.equal(image.width, 512); assert.equal(image.height, 512);
    const canvas = createCanvas(512, 512), context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 512, 512).data;
    let clear = 0; for (let i = 3; i < pixels.length; i += 4) if (!pixels[i]) clear++;
    assert.ok(clear > 512 * 512 * .2 && clear < 512 * 512 * .8);
  }
  const manifest = JSON.parse(readFileSync('public/assets/data/buildings-manifest.json', 'utf8'));
  assert.equal(manifest.buildings.find((b: any) => b.id === CONTAINER_PORT.id).iconPath, 'assets/sprites/buildings/container_port.png');
});
