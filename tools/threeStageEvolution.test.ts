import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from './urbanDevelopment.test';
import { getBuildingById } from '../src/data/buildings';
import { WORKER, WARRIOR, AGENT, GUIDED_MISSILE } from '../src/data/units';
import { Unit } from '../src/entities/Unit';
import { Nation } from '../src/entities/Nation';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { UnitManager } from '../src/systems/UnitManager';
import { WonderSystem } from '../src/systems/WonderSystem';
import { InfrastructureSabotageSystem } from '../src/systems/InfrastructureSabotageSystem';
import { StrategicWeaponsSystem } from '../src/systems/StrategicWeaponsSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService';
import { CITY_DEVELOPMENT_BUILDINGS, getUrbanSlots, getSettlementStage } from '../src/systems/UrbanDevelopment';
import { getSettlementProgress } from '../src/systems/SettlementProgress';
import { getUrbanInfrastructureCandidates } from '../src/systems/ai/AIUrbanDevelopment';
import { completeBuildingUpgrade } from '../src/systems/buildingUpgrades';

function harness() {
  const h = setup();
  const nations = new NationManager();
  for (const id of ['human','enemy']) nations.addNation(new Nation({id,name:id,color:0,isHuman:id==='human'}));
  const turns = new TurnManager(nations);
  const production = new ProductionSystem(h.manager, turns, new HappinessSystem(nations,h.manager));
  production.onCompleted((_id,item) => {
    if(item.kind==='building') {
      if(!h.placement.completePhysicalBuilding(h.city,item.buildingType,h.map)) return false;
      completeBuildingUpgrade(h.buildings,item.buildingType);
    }
    return true;
  });
  const complete = (id:string) => {
    const def=getBuildingById(id)!;
    h.placement.reserveFirstValidPlacement(h.city,def,h.map);
    production.enqueue(h.city.id,{kind:'building',buildingType:def});
    assert.equal(production.completeCurrentProduction(h.city.id).kind,'completed',id);
  };
  const town = () => {for(const slot of getUrbanSlots(h.city)) complete(slot.buildingId!);};
  const expand = () => {
    for(const row of h.map.tiles) for(const tile of row) if(h.grid.getDistance({x:h.city.tileX,y:h.city.tileY},tile)===2) {
      tile.ownerId=h.city.ownerId;h.city.ownedTileCoords.push({x:tile.x,y:tile.y});
    }
  };
  return {...h,nations,turns,production,complete,town,expand};
}

test('human and AI evolve on the sixth ordinary City requirement in either order without new reservations',()=>{
  for(const reverse of [false,true]) {
    const h=harness();h.nations.getNation('human')!.isHuman=!reverse;
    h.town();h.expand();h.complete('workshop');
    const footprint=h.city.ownedTileCoords.map(c=>({...c}));
    const reservations=h.map.tiles.flat().filter(t=>t.urbanSlot).map(t=>[t.x,t.y,t.urbanSlot]);
    assert.equal(h.city.settlementStage,'Town');
    const order=reverse?[...CITY_DEVELOPMENT_BUILDINGS].reverse():CITY_DEVELOPMENT_BUILDINGS;
    for(const [i,id] of order.entries()) {
      const candidates=getUrbanInfrastructureCandidates(h.city,h.buildings,b=>h.placement.getValidPlacementCoords(h.city,b,h.map).length>0);
      assert.ok(candidates.some(c=>c.building.id===id),id);
      h.complete(id);
      assert.equal(h.city.settlementStage,i===5?'City':'Town');
      const progress=getSettlementProgress(h.city,h.buildings,()=>true);
      assert.equal(progress.spatial,false);assert.equal(progress.completed,i+1);
      assert.deepEqual(progress.slots.map(s=>s.buildingId),[...CITY_DEVELOPMENT_BUILDINGS]);
      assert.equal(getUrbanSlots(h.city).length,6);
    }
    assert.deepEqual(h.city.ownedTileCoords,footprint);
    assert.deepEqual(h.map.tiles.flat().filter(t=>t.urbanSlot).map(t=>[t.x,t.y,t.urbanSlot]),reservations);
    for(const id of CITY_DEVELOPMENT_BUILDINGS) {
      assert.equal(h.buildings.setBroken(id,true),true);
      assert.equal(h.city.settlementStage,'City');
      assert.equal(h.buildings.setBroken(id,false),true);
      assert.equal(h.buildings.remove(id),true);
      assert.equal(getSettlementStage(h.buildings,h.city),'City');
    }
    assert.equal(getSettlementProgress(h.city,h.buildings,()=>true).completed,0);
  }
});

test('Town core cannot be removed or damaged; units cannot spend actions or trigger war on it',()=>{
  const h=harness();
  h.complete('forge');assert.equal(h.buildings.setBroken('forge',true),true);
  assert.equal(h.buildings.setBroken('forge',false),true);
  assert.equal(h.buildings.remove('forge'),true);
  // Rebuild the deliberately removed pre-Town fixture through normal production.
  const first=getUrbanSlots(h.city)[0];h.map.tiles[first.y][first.x].buildingId=undefined;
  h.town();
  const sabotage=new InfrastructureSabotageSystem(h.map,h.manager,new WonderSystem(),h.nations,()=>{throw new Error('Protected target logged an action');});
  for(const slot of getUrbanSlots(h.city)) {
    assert.equal(h.buildings.remove(slot.buildingId!),false);
    assert.equal(h.buildings.setBroken(slot.buildingId!,true),false);
    for(const unitType of [WORKER,{...WARRIOR,canDestroyBuilding:true},AGENT]) {
      const unit=new Unit({id:'actor',name:'Actor',ownerId:unitType===WORKER?'human':'enemy',unitType,tileX:slot.x,tileY:slot.y});
      const movement=unit.movementPoints;
      assert.equal(sabotage.canDestroyBuilding(unit),false);
      assert.equal(sabotage.destroyBuilding(unit),false);
      assert.equal(sabotage.getActOfWarTarget(unit,'building'),undefined);
      assert.equal(unit.movementPoints,movement);
      assert.equal(h.map.tiles[slot.y][slot.x].buildingId,slot.buildingId);
      assert.equal(h.buildings.hasActive(slot.buildingId!),true);
    }
  }
  h.manager.transferOwnership(h.city.id,'enemy');
  for(const slot of getUrbanSlots(h.city))assert.equal(h.buildings.remove(slot.buildingId!),false);
  assert.equal(h.city.settlementStage,'Town');
});

test('strategic blast leaves permanent Town buildings active and damages ordinary City infrastructure',()=>{
  const h=harness();h.town();h.expand();h.complete('railway_station');
  const units=new UnitManager(9,9),diplomacy=new DiplomacyManager();diplomacy.declareWar('enemy','human');
  const missile=new Unit({id:'missile',name:'Missile',ownerId:'enemy',unitType:GUIDED_MISSILE,tileX:1,tileY:4});units.addUnit(missile);
  const station=h.map.tiles.flat().find(t=>t.buildingId==='railway_station')!;
  const weapons=new StrategicWeaponsSystem(units,h.manager,h.map,h.grid,diplomacy);
  assert.equal(weapons.launch(missile,station.x,station.y),true);
  assert.equal(h.buildings.isBroken('railway_station'),true);
  for(const slot of getUrbanSlots(h.city))assert.equal(h.buildings.hasActive(slot.buildingId!),true);
});

function save(h:ReturnType<typeof harness>) {
  return JSON.parse(JSON.stringify(SaveLoadService.serialize({mapKey:'test',humanNationId:'human',activeNationIds:['human'],gameSpeedId:'standard',mapData:h.map,nationManager:h.nations,cityManager:h.manager,
    unitManager:{getAllUnits:()=>[]},productionSystem:h.production,policySystem:{getActivePolicyAssignments:()=>[]},
    diplomacyManager:{getAllStates:()=>[],getAllVassalRelationships:()=>[],getPendingPeaceProposals:()=>[],getPeaceTreatyCooldownTurns:()=>0,getMinPeaceNegotiationTurns:()=>0},
    discoverySystem:{getAllMetPairs:()=>[]},turnManager:h.turns,gridSystem:h.grid,wonderSystem:{getCompletedWonders:()=>[]}} as unknown as SaveLoadContext)));
}

test('saved stages survive capture and lost City requirements; legacy Towns infer stage without changing layout',()=>{
  for(const state of ['Village','Town','partial','City','legacy']) {
    const h=harness();
    if(state!=='Village')h.town();
    if(state==='partial'||state==='City') {
      h.expand();h.complete('workshop');
      for(const id of state==='City'?CITY_DEVELOPMENT_BUILDINGS:CITY_DEVELOPMENT_BUILDINGS.slice(0,2))h.complete(id);
    }
    if(state==='City') {
      h.buildings.remove('bank');
      const tile=h.map.tiles.flat().find(t=>t.buildingId==='bank')!;tile.buildingId=undefined;
      h.manager.transferOwnership(h.city.id,'enemy');
    }
    const serialized=save(h);
    if(state==='legacy')delete serialized.cities[0].settlementStage;
    const loaded=harness();SaveLoadService.restoreTiles(serialized.tiles,loaded.map);
    (SaveLoadService as any).applyCitiesAndProduction(serialized.cities,loaded.manager,loaded.production,loaded.map,loaded.grid,'standard');
    const city=loaded.manager.getCity(h.city.id)!,buildings=loaded.manager.getBuildings(h.city.id);
    assert.equal(city.settlementStage,h.city.settlementStage);
    assert.equal(city.ownerId,h.city.ownerId);
    assert.deepEqual(city.urbanDevelopment,h.city.urbanDevelopment);
    assert.deepEqual(buildings.getAllEntries(),h.buildings.getAllEntries());
    if(state!=='Village')assert.equal(buildings.remove('forge'),false);
  }
});

test('City buildings completed before Town count without imposing an order',()=>{
  const h=harness();h.expand();h.complete('workshop');
  for(const id of CITY_DEVELOPMENT_BUILDINGS)h.complete(id);
  assert.equal(h.city.settlementStage,'Village');
  h.town();assert.equal(h.city.settlementStage,'City');
});

test('ordinary City infrastructure remains a valid covert and Worker target',()=>{
  const h=harness();h.town();h.expand();h.complete('workshop');
  for(const id of CITY_DEVELOPMENT_BUILDINGS)h.complete(id);
  const sabotage=new InfrastructureSabotageSystem(h.map,h.manager,new WonderSystem(),h.nations,()=>{});
  const tile=h.map.tiles.flat().find(t=>t.buildingId==='bank')!;
  const agent=new Unit({id:'agent',name:'Agent',ownerId:'enemy',unitType:AGENT,tileX:tile.x,tileY:tile.y});
  assert.equal(sabotage.destroyBuilding(agent),true);
  assert.equal(h.buildings.isBroken('bank'),true);
  assert.equal(h.city.settlementStage,'City');
  assert.equal(h.buildings.setBroken('bank',false),true);
  const worker=new Unit({id:'worker',name:'Worker',ownerId:'human',unitType:WORKER,tileX:tile.x,tileY:tile.y});
  assert.equal(sabotage.destroyBuilding(worker),true);
  assert.equal(tile.buildingId,undefined);assert.equal(h.buildings.has('bank'),false);
  assert.equal(h.city.settlementStage,'City');
});

test('all 42 developable coastal footprints retain a horizontal railway corridor on land',async()=>{
  const {HexGridLayout}=await import('../src/systems/gridLayout/HexGridLayout');
  const {cityRailCorridor,cityContains}=await import('../src/systems/rendering/OrganicCityArtwork');
  const h=harness(),layout=new HexGridLayout(),origin=layout.tileToWorld({x:4,y:4},h.map);
  const size=layout.getTileRect({x:4,y:4},h.map).width;
  for(let mask=0;mask<64;mask++) {
    if(mask.toString(2).replaceAll('0','').length>3)continue;
    const coords=[{x:4,y:4},...getUrbanSlots(h.city).filter((_,i)=>!(mask&(1<<i)))];
    const land=coords.map(c=>layout.getTileOutlinePoints(c,h.map).map(p=>({x:p.x-origin.x,y:p.y-origin.y})));
    const rail=cityRailCorridor(land,size);
    assert.ok(rail.right-rail.left>=.6*size,`visible track for mask ${mask}`);
    for(let x=rail.left;x<rail.right;x+=.01*size) {
      assert.ok(land.some(poly=>cityContains(poly,{x,y:rail.y-.04*size})),`rear rail mask ${mask}`);
      assert.ok(land.some(poly=>cityContains(poly,{x,y:rail.y+.04*size})),`front rail mask ${mask}`);
    }
  }
});

test('Seaport fulfills the single transport slot through ordinary coastal production',async()=>{
  const {TileType}=await import('../src/types/map');
  const h=harness();h.town();h.expand();h.complete('workshop');
  h.map.tiles[4][6].type=TileType.Coast;
  h.complete('harbor');
  const candidates=()=>getUrbanInfrastructureCandidates(h.city,h.buildings,b=>h.placement.getValidPlacementCoords(h.city,b,h.map).length>0);
  assert.ok(candidates().some(c=>c.building.id==='seaport'));
  h.complete('seaport');
  let progress=getSettlementProgress(h.city,h.buildings,()=>false);
  assert.equal(progress.slots.length,6);assert.equal(progress.completed,1);
  assert.equal(progress.slots[0].name,'Railway Station OR Seaport');
  assert.equal(progress.slots[0].spriteId,'seaport');
  assert.deepEqual(progress.slots[0].alternativeTechs,[]);
  assert.ok(!candidates().some(c=>['railway_station','seaport'].includes(c.building.id)));
  for(const id of CITY_DEVELOPMENT_BUILDINGS.slice(1))h.complete(id);
  assert.equal(h.city.settlementStage,'City');assert.equal(h.buildings.has('railway_station'),false);
  h.complete('railway_station');
  progress=getSettlementProgress(h.city,h.buildings,()=>true);
  assert.equal(progress.completed,6);assert.equal(progress.slots.length,6);
  h.buildings.remove('railway_station');h.buildings.remove('seaport');
  const serialized=save(h),loaded=harness();
  (SaveLoadService as any).applyCitiesAndProduction(serialized.cities,loaded.manager,loaded.production,loaded.map,loaded.grid,'standard');
  assert.equal(loaded.manager.getCity(h.city.id)!.settlementStage,'City');
});

test('transport alternatives count once and never substitute for another requirement',()=>{
  const h=harness();h.town();
  h.buildings.add(getBuildingById('railway_station')!);
  h.buildings.add(getBuildingById('seaport')!);
  assert.equal(getSettlementProgress(h.city,h.buildings,()=>true).completed,1);
  for(const missing of CITY_DEVELOPMENT_BUILDINGS.slice(1)) {
    for(const id of CITY_DEVELOPMENT_BUILDINGS.slice(1)) if(id!==missing)h.buildings.add(getBuildingById(id)!);
    assert.equal(getSettlementStage(h.buildings,h.city),'Town',missing);
    assert.equal(getSettlementProgress(h.city,h.buildings,()=>true).completed,5);
    for(const id of CITY_DEVELOPMENT_BUILDINGS.slice(1))h.buildings.remove(id);
  }
});
