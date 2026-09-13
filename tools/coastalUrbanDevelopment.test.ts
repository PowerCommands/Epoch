import { PowerPlantSystem } from '../src/systems/PowerPlantSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCK, HARBOR, SEAPORT, LIGHTHOUSE, getBuildingById } from '../src/data/buildings.ts';
import { getTechnologyById } from '../src/data/technologies.ts';
import { WORK_BOAT, TRIREME, WARRIOR } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { CityTerritorySystem } from '../src/systems/CityTerritorySystem.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { getUrbanSlots, getSettlementStage, canDevelopIntoCity, URBAN_SLOTS } from '../src/systems/UrbanDevelopment.ts';
import { getUrbanInfrastructureCandidates } from '../src/systems/ai/AIUrbanDevelopment.ts';
import { completeBuildingUpgrade } from '../src/systems/buildingUpgrades.ts';
import { getCityUnitProductionBlockReason } from '../src/systems/ProductionRules.ts';
import { findFunctioningDock, findDockSpawnTile, DOCK_PRODUCTION_REQUIREMENT } from '../src/systems/NavalProduction.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import { createCanvas, loadImage } from 'canvas';

function harness(mask=0, ownerId='human', mountainSlot=-1) {
  const map:MapData={width:11,height:11,tileSize:64,tiles:Array.from({length:11},(_,y)=>Array.from({length:11},(_,x)=>({x,y,type:TileType.Plains,ownerId})))};
  const city=new City({id:'city',name:'Coastford',ownerId,tileX:5,tileY:5});
  URBAN_SLOTS.forEach((s,i)=>{if(mask&(1<<i))map.tiles[5+s.dr][5+s.dq].type=TileType.Coast;});
  if(mountainSlot>=0){const s=URBAN_SLOTS[mountainSlot];map.tiles[5+s.dr][5+s.dq].type=TileType.Mountain;}
  const grid=new HexGridSystem(),territory=new CityTerritorySystem();territory.initializeOwnedTiles(city,map,grid);
  const cities=new CityManager();cities.addCity(city);const buildings=cities.getBuildings(city.id);
  const nations=new NationManager();nations.addNation(new Nation({id:ownerId,name:'Test',color:0x333333}));
  const turns=new TurnManager(nations),production=new ProductionSystem(cities,turns,new HappinessSystem(nations,cities));
  const placement=new BuildingPlacementSystem();
  production.setNavalDockAvailable(id=>!!findFunctioningDock(cities.getCity(id)!,cities.getBuildings(id),map));
  production.onCompleted((id,item)=>{
    if(item.kind==='building'){
      const tile=placement.completePhysicalBuilding(city,item.buildingType,map);
      if(!tile)return false;
      completeBuildingUpgrade(buildings,item.buildingType);
    }
    return true;
  });
  const complete=(id:string)=>{
    production.enqueue(city.id,{kind:'building',buildingType:getBuildingById(id)!});
    assert.equal(production.completeCurrentProduction(city.id).kind,'completed',id);
  };
  return {map,city,grid,territory,cities,buildings,nations,turns,production,placement,complete};
}

test('Sailing unlocks standalone Ancient Dock without changing naval unlocks or Harbor chain',()=>{
  const sailing=getTechnologyById('sailing')!;
  assert.ok(sailing.unlocks.some(u=>u.kind==='building'&&u.id===DOCK.id));
  for(const id of ['work_boat','trireme','cargo_ship'])assert.ok(sailing.unlocks.some(u=>u.kind==='unit'&&u.id===id));
  assert.equal(DOCK.era,'ancient');assert.equal(DOCK.upgradesFrom,undefined);assert.equal(HARBOR.upgradesFrom,undefined);assert.equal(SEAPORT.upgradesFrom,HARBOR.id);
});

test('Dock accepts only owned Coast, with normal manual placement when not an urban requirement',()=>{
  const h=harness();const tile=h.map.tiles[5][7];h.city.ownedTileCoords.push({x:7,y:5});
  for(const terrain of Object.values(TileType)){
    tile.type=terrain;
    assert.equal(h.placement.getValidPlacementCoords(h.city,DOCK,h.map).length,terrain===TileType.Coast?1:0,terrain);
  }
  tile.type=TileType.Coast;tile.ownerId='foreign';
  assert.equal(h.placement.getValidPlacementCoords(h.city,DOCK,h.map).length,0);
  tile.ownerId=h.city.ownerId;
  assert.equal(h.placement.startPlacement(h.city,DOCK.id,h.map),true);
  assert.equal(h.placement.selectTile(h.city,tile,h.map).status,'reserved');h.complete(DOCK.id);
  assert.equal(findFunctioningDock(h.city,h.buildings,h.map),tile);
});

test('every coastal arrangement derives six frozen requirements; 0–3 Coast permits City, 4–6 never does',()=>{
  for(let mask=0;mask<64;mask++)for(const owner of ['human','ai']){
    const h=harness(mask,owner),slots=getUrbanSlots(h.city),count=slots.filter(s=>s.water).length;
    const maritime=['dock','lighthouse','harbor'];let coast=0;
    slots.forEach((slot,i)=>assert.equal(slot.buildingId,count>=4?null:mask&(1<<i)?maritime[coast++]??null:URBAN_SLOTS[i].buildingId));
    assert.equal(canDevelopIntoCity(h.city),count<=3);
    const requirements=slots.flatMap(s=>s.buildingId?[s.buildingId]:[]);
    assert.equal(getSettlementStage(h.buildings,h.city),'Village');
    for(const id of requirements.slice(0,-1))h.complete(id);
    assert.equal(getSettlementStage(h.buildings,h.city),'Village');
    if(requirements.length)h.complete(requirements.at(-1)!);
    assert.equal(getSettlementStage(h.buildings,h.city),count<=3?'City':'Village');
    assert.equal(h.buildings.getAll().length,requirements.length);
    // Terrain later changing must not reinterpret the founding layout.
    for(const slot of slots)h.map.tiles[slot.y][slot.x].type=TileType.Plains;
    assert.deepEqual(getUrbanSlots(h.city),slots);
  }
});

test('Dock functionality is per-city, requires functioning infrastructure and gates enqueue and completion',()=>{
  const h=harness(1),context={getCityBuildings:(id:string)=>h.cities.getBuildings(id)};
  assert.equal(getCityUnitProductionBlockReason(h.city,WORK_BOAT,h.map,h.grid,context),DOCK_PRODUCTION_REQUIREMENT);
  h.production.enqueue(h.city.id,{kind:'unit',unitType:WORK_BOAT});assert.equal(h.production.getQueue(h.city.id).length,0);
  h.complete(DOCK.id);
  assert.equal(getCityUnitProductionBlockReason(h.city,WORK_BOAT,h.map,h.grid,context),undefined);
  h.production.enqueue(h.city.id,{kind:'unit',unitType:TRIREME});assert.equal(h.production.getQueue(h.city.id).length,1);
  h.buildings.setBroken(DOCK.id,true);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind,'blocked');
  assert.equal(getCityUnitProductionBlockReason(h.city,TRIREME,h.map,h.grid,context),DOCK_PRODUCTION_REQUIREMENT);
  h.buildings.setBroken(DOCK.id,false);assert.equal(h.production.completeCurrentProduction(h.city.id).kind,'completed');
  const other=new City({id:'other',name:'Other',ownerId:h.city.ownerId,tileX:2,tileY:2});h.cities.addCity(other);
  other.ownedTileCoords=[{x:5,y:4}];
  assert.equal(getCityUnitProductionBlockReason(other,WORK_BOAT,h.map,h.grid,context),DOCK_PRODUCTION_REQUIREMENT);
  assert.equal(getCityUnitProductionBlockReason(other,WARRIOR,h.map,h.grid,context),undefined);
});

test('ships spawn on Dock or nearest valid free water from Dock with row/column ties',()=>{
  const h=harness(1);h.complete(DOCK.id);const dock=findFunctioningDock(h.city,h.buildings,h.map)!;
  const occupied=new Set<string>();
  const valid=(tile:MapData['tiles'][number][number])=>(tile.type===TileType.Coast||tile.type===TileType.Ocean)&&tile.ownerId===h.city.ownerId&&!occupied.has(`${tile.x},${tile.y}`);
  assert.equal(findDockSpawnTile(dock,h.map,h.grid,valid),dock);
  occupied.add(`${dock.x},${dock.y}`);
  const candidates=h.grid.getAdjacentCoords(dock).filter(c=>c.x!==h.city.tileX||c.y!==h.city.tileY);
  for(const c of candidates)h.map.tiles[c.y][c.x].type=TileType.Coast;
  const expected=[...candidates].sort((a,b)=>a.y-b.y||a.x-b.x)[0];
  for(let i=0;i<10;i++){
    const chosen=findDockSpawnTile(dock,h.map,h.grid,valid)!;
    assert.deepEqual([chosen.x,chosen.y],[expected.x,expected.y]);
    h.city.ownedTileCoords.reverse();
  }
  for(const c of candidates)occupied.add(`${c.x},${c.y}`);
  assert.equal(findDockSpawnTile(dock,h.map,h.grid,valid),null);
});

test('AI proposes actual geography requirements, and no City-completion candidates for 4+ water',()=>{
  for(let mask=0;mask<64;mask++){
    const h=harness(mask,'ai');
    const choices=getUrbanInfrastructureCandidates(h.city,h.buildings,()=>true).map(c=>c.building.id);
    if(!canDevelopIntoCity(h.city))assert.deepEqual(choices,['dock']);
    else for(const id of choices.filter(id=>id!==DOCK.id))assert.ok(getUrbanSlots(h.city).some(s=>s.buildingId===id));
    h.buildings.add(DOCK);
    if(!canDevelopIntoCity(h.city))assert.deepEqual(getUrbanInfrastructureCandidates(h.city,h.buildings,()=>true),[]);
  }
});

test('Harbor → Seaport keeps Dock independent and satisfies the same harbor requirement',()=>{
  const h=harness(7);for(const s of getUrbanSlots(h.city))h.complete(s.buildingId!);
  const dock=findFunctioningDock(h.city,h.buildings,h.map);
  h.complete(SEAPORT.id);
  assert.equal(h.buildings.has(HARBOR.id),false);assert.equal(h.buildings.has(SEAPORT.id),true);
  assert.equal(h.buildings.has(DOCK.id),true);assert.equal(findFunctioningDock(h.city,h.buildings,h.map),dock);
  assert.equal(getSettlementStage(h.buildings,h.city),'City');
});

test('partial and completed coastal layouts, buildings and Dock capability survive new-format save/load',()=>{
  for(const mask of [0,1,3,7,18,50,15,31,63,-1])for(const partial of [true,false]){
    const h=mask===-1?harness(0,'human',0):harness(mask),slots=getUrbanSlots(h.city).filter(s=>s.buildingId);
    for(const s of partial?slots.slice(0,2):slots)h.complete(s.buildingId!);
    if(!canDevelopIntoCity(h.city) && mask>0){
      assert.ok(h.placement.reserveFirstValidPlacement(h.city,DOCK,h.map));h.complete(DOCK.id);
    }
    const context={mapKey:'test',humanNationId:'human',activeNationIds:['human'],gameSpeedId:'standard',mapData:h.map,nationManager:h.nations,cityManager:h.cities,
      unitManager:{getAllUnits:()=>[]},productionSystem:h.production,policySystem:{getActivePolicyAssignments:()=>[]},
      diplomacyManager:{getAllStates:()=>[],getAllVassalRelationships:()=>[],getPendingPeaceProposals:()=>[],getPeaceTreatyCooldownTurns:()=>0,getMinPeaceNegotiationTurns:()=>0},
      discoverySystem:{getAllMetPairs:()=>[]},turnManager:h.turns,gridSystem:h.grid,wonderSystem:{getCompletedWonders:()=>[]}} as unknown as SaveLoadContext;
    const save=JSON.parse(JSON.stringify(SaveLoadService.serialize(context)));
    const loaded=harness();SaveLoadService.restoreTiles(save.tiles,loaded.map);
    (SaveLoadService as any).applyCitiesAndProduction(save.cities,loaded.cities,loaded.production,loaded.map,loaded.grid,'standard');
    const city=loaded.cities.getCity('city')!,buildings=loaded.cities.getBuildings('city');
    const capacity=(cities:CityManager,map:MapData)=>new PowerPlantSystem(cities,new ResourceAccessSystem(map,{getAllDeals:()=>[]}),map,1).getCityPopulationCapacity('city');
    assert.equal(capacity(loaded.cities,loaded.map),capacity(h.cities,h.map));
    assert.deepEqual(city.urbanDevelopment,h.city.urbanDevelopment);
    assert.equal(getSettlementStage(buildings,city),getSettlementStage(h.buildings,h.city));
    assert.deepEqual(buildings.getAllEntries(),h.buildings.getAllEntries());
    const dock=findFunctioningDock(city,buildings,loaded.map), original=findFunctioningDock(h.city,h.buildings,h.map);
    assert.deepEqual(dock && [dock.x,dock.y,dock.buildingId,dock.urbanSlot],original && [original.x,original.y,original.buildingId,original.urbanSlot]);
  }
});

test('Dock artwork has real transparency and visible pixels',async()=>{
  for(const suffix of ['','-broken']){
    const image=await loadImage(`public/assets/sprites/buildings/dock${suffix}.png`);
    const c=createCanvas(256,256),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,256,256).data;
    assert.equal(data[3],0);assert.ok(data.some((v,i)=>i%4===3&&v===255));
  }
});

test('replaced land buildings use unreserved territory; Dock revalidates terrain and ownership at completion',()=>{
  const h=harness(16),workshop=getBuildingById('workshop')!;
  const land=h.map.tiles[5][7];h.city.ownedTileCoords.push({x:7,y:5});
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city,workshop,h.map),[{x:7,y:5}]);
  assert.equal(h.placement.startPlacement(h.city,workshop.id,h.map),true);
  assert.equal(h.placement.selectTile(h.city,land,h.map).status,'reserved');h.complete(workshop.id);
  assert.equal(getSettlementStage(h.buildings,h.city),'Village');
  const standalone=harness(),water=standalone.map.tiles[5][7];
  standalone.city.ownedTileCoords.push({x:7,y:5});water.type=TileType.Coast;
  standalone.placement.reserveFirstValidPlacement(standalone.city,DOCK,standalone.map);
  water.type=TileType.Plains;
  assert.equal(standalone.placement.completePhysicalBuilding(standalone.city,DOCK,standalone.map),null);
  water.type=TileType.Coast;water.ownerId='enemy';
  assert.equal(standalone.placement.completePhysicalBuilding(standalone.city,DOCK,standalone.map),null);
  assert.equal(water.buildingId,undefined);
});

test('Dock capability follows city ownership without changing coastal development',()=>{
  const h=harness(7);for(const slot of getUrbanSlots(h.city))h.complete(slot.buildingId!);
  const layout=structuredClone(h.city.urbanDevelopment);
  h.city.ownerId='captor';
  for(const c of h.city.ownedTileCoords)h.map.tiles[c.y][c.x].ownerId='captor';
  assert.ok(findFunctioningDock(h.city,h.buildings,h.map));
  assert.deepEqual(h.city.urbanDevelopment,layout);
  assert.equal(getSettlementStage(h.buildings,h.city),'City');
  h.map.tiles[4][5].ownerId='enemy';
  assert.equal(findFunctioningDock(h.city,h.buildings,h.map),undefined);
});

for (const [mask, expected] of [
  [0, ['forge', 'aqueduct', 'monument', 'water_mill', 'market', 'sewers']],
  [2, ['forge', 'dock', 'monument', 'water_mill', 'market', 'sewers']],
  [18, ['forge', 'dock', 'monument', 'water_mill', 'lighthouse', 'sewers']],
  [50, ['forge', 'dock', 'monument', 'water_mill', 'lighthouse', 'harbor']],
] as const) {
  test(`local blueprint ${mask}: only assigned buildings auto-place; blocked slots never relocate`, () => {
    const h = harness(mask);
    assert.deepEqual(getUrbanSlots(h.city).map(s => s.buildingId), expected);
    const extraLand = h.map.tiles[5][7], extraCoast = h.map.tiles[6][7];
    extraCoast.type = TileType.Coast;
    h.city.ownedTileCoords.push(extraLand, extraCoast);
    for (const id of [...URBAN_SLOTS.map(s => s.buildingId), 'dock', 'lighthouse', 'harbor']) {
      const building = getBuildingById(id)!;
      const slot = getUrbanSlots(h.city).find(s => s.buildingId === id);
      if (slot) {
        assert.equal(h.placement.startPlacement(h.city, id, h.map), false, id);
        assert.equal(h.placement.isActive(), false);
        assert.deepEqual(h.placement.getValidPlacementCoords(h.city, building, h.map), [{x: slot.x, y: slot.y}]);
        const tile = h.map.tiles[slot.y][slot.x];
        tile.buildingId = 'granary';
        assert.deepEqual(h.placement.getValidPlacementCoords(h.city, building, h.map), []);
        assert.equal(h.placement.reserveFirstValidPlacement(h.city, building, h.map), undefined);
        assert.equal(h.placement.completePhysicalBuilding(h.city, building, h.map), null);
        tile.buildingId = undefined;
        h.complete(id);
        assert.equal(tile.buildingId, id);
      } else {
        const destination = building.placement === 'water' ? extraCoast : extraLand;
        assert.equal(h.placement.startPlacement(h.city, id, h.map), true, id);
        assert.equal(h.placement.selectTile(h.city, destination, h.map).status, 'reserved');
        h.complete(id);
        assert.equal(destination.buildingId, id);
        assert.ok(h.buildings.hasActive(id));
        // Remove the optional investment: neither its presence nor its absence
        // may replace a missing requirement in this settlement's blueprint.
        h.buildings.remove(id);
        destination.buildingId = undefined;
      }
    }
    assert.equal(getSettlementStage(h.buildings, h.city), 'City');
    assert.deepEqual(new Set(h.buildings.getAll()), new Set(expected));
  });
}

test('displaced Aqueduct and Market cannot substitute for missing Dock or Lighthouse', () => {
  const h = harness(18);
  for (const id of ['forge', 'monument', 'water_mill', 'sewers']) h.complete(id);
  for (const [id, x] of [['aqueduct', 7], ['market', 8]] as const) {
    const tile = h.map.tiles[5][x];
    h.city.ownedTileCoords.push(tile);
    assert.equal(h.placement.startPlacement(h.city, id, h.map), true);
    assert.equal(h.placement.selectTile(h.city, tile, h.map).status, 'reserved');
    h.complete(id);
  }
  assert.equal(getSettlementStage(h.buildings, h.city), 'Village');
  h.complete('dock');
  assert.equal(getSettlementStage(h.buildings, h.city), 'Village');
  h.complete('lighthouse');
  assert.equal(getSettlementStage(h.buildings, h.city), 'City');
  for (const id of ['aqueduct', 'market']) assert.ok(h.buildings.hasActive(id));
});


test('a mountain in any surrounding position or 4+ water disables all reservations and automatic placement', () => {
  for (const owner of ['human','ai']) for (const [mask,mountain] of [
    ...URBAN_SLOTS.map((_,i)=>[0,i]), [15,-1], [31,-1], [63,-1], [2,4],
  ]) {
    const h=harness(mask,owner,mountain);
    assert.equal(canDevelopIntoCity(h.city),false);
    assert.ok(getUrbanSlots(h.city).every(s=>s.buildingId===null));
    for(const coord of h.city.ownedTileCoords)assert.equal(h.map.tiles[coord.y][coord.x].urbanSlot,undefined);
    const building=getBuildingById(mask===63?'dock':'market')!;
    const valid=h.placement.getValidPlacementCoords(h.city,building,h.map);
    assert.ok(valid.length>0);
    assert.equal(h.placement.startPlacement(h.city,building.id,h.map),true);
    assert.equal(h.placement.selectTile(h.city,valid[0],h.map).status,'reserved');
    h.complete(building.id);
    assert.ok(h.map.tiles[valid[0].y][valid[0].x].buildingId===building.id);
    for(const slot of URBAN_SLOTS)h.buildings.add(getBuildingById(slot.buildingId)!);
    assert.equal(getSettlementStage(h.buildings,h.city),'Village');
    assert.deepEqual(getUrbanInfrastructureCandidates(h.city,h.buildings,()=>false),[]);
  }
});

test('City completion adds exactly five capacity: 8→13 and 10→15, without changing population', () => {
  for(const [mask,before,after] of [[2,8,13],[0,10,15]]) {
    const h=harness(mask),power=new PowerPlantSystem(h.cities,new ResourceAccessSystem(h.map,{getAllDeals:()=>[]}),h.map,1);
    const population=h.city.population;
    for(const slot of getUrbanSlots(h.city).filter(s=>s.buildingId!=='water_mill'))h.complete(slot.buildingId!);
    assert.equal(getSettlementStage(h.buildings,h.city),'Village');
    assert.equal(power.getCityPopulationCapacity(h.city.id),before);
    h.complete('water_mill');
    for(let i=0;i<3;i++)assert.equal(power.getCityPopulationCapacity(h.city.id),after);
    assert.equal(h.city.population,population);
    h.buildings.setBroken('forge',true);
    assert.equal(power.getCityPopulationCapacity(h.city.id),after);
    h.cities.transferOwnership(h.city.id,'captor');
    for(const coord of h.city.ownedTileCoords)h.map.tiles[coord.y][coord.x].ownerId='captor';
    assert.equal(power.getCityPopulationCapacity(h.city.id),after);
  }
});
