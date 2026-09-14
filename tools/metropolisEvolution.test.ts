import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, save } from './threeStageEvolution.test';
import { getBuildingById } from '../src/data/buildings';
import { METROPOLIS_DEVELOPMENT_REQUIREMENTS, CITY_DEVELOPMENT_BUILDINGS } from '../src/systems/UrbanDevelopment';
import { getSettlementProgress } from '../src/systems/SettlementProgress';
import { getUrbanInfrastructureCandidates } from '../src/systems/ai/AIUrbanDevelopment';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem';
import { TileType } from '../src/types/map';

test('all four alternative routes evolve human and AI Cities through ordinary production, in either order',()=>{
  for(const energy of METROPOLIS_DEVELOPMENT_REQUIREMENTS[0])for(const transport of METROPOLIS_DEVELOPMENT_REQUIREMENTS[1])for(const reverse of [false,true]) {
    const h=harness();h.nations.getNation('human')!.isHuman=!reverse;
    h.town();h.expand();h.complete('workshop');for(const id of CITY_DEVELOPMENT_BUILDINGS)h.complete(id);
    // Normal city territory can grow independently of its frozen development shell.
    for(const tile of h.map.tiles.flat())if(!tile.ownerId){tile.ownerId=h.city.ownerId;h.city.ownedTileCoords.push({x:tile.x,y:tile.y});}
    h.map.tiles[0][0].type=TileType.Coast;h.map.tiles[0][1].type=TileType.Coast;
    h.complete('colosseum');
    if(transport==='container_port'){h.complete('harbor');h.complete('seaport');}
    const footprint=JSON.stringify(h.city.ownedTileCoords), reservations=JSON.stringify(h.map.tiles.flat().map(t=>t.urbanSlot));
    const order=[energy,transport,'stock_exchange','broadcast_tower','stadium','medical_lab'];if(reverse)order.reverse();
    for(const [i,id] of order.entries()){
      assert.ok(getUrbanInfrastructureCandidates(h.city,h.buildings,()=>true).some(c=>c.building.id===id),id);
      h.complete(id);
      assert.equal(h.city.settlementStage,i===5?'Metropolis':'City');
      const progress=getSettlementProgress(h.city,h.buildings,()=>true);
      assert.equal(progress.to,'Metropolis');assert.equal(progress.completed,i+1);assert.equal(progress.slots.length,6);
      assert.equal(progress.slots[0].name,'Nuclear Power Plant OR Offshore Wind Farm');assert.equal(progress.slots[1].name,'Airport OR Container Port');
    }
    assert.equal(JSON.stringify(h.city.ownedTileCoords),footprint);assert.equal(JSON.stringify(h.map.tiles.flat().map(t=>t.urbanSlot)),reservations);
    for(const id of order){h.buildings.setBroken(id,true);h.buildings.remove(id);}
    h.manager.transferOwnership(h.city.id,'enemy');
    assert.equal(h.city.settlementStage,'Metropolis');assert.equal(getSettlementProgress(h.city,h.buildings,()=>false).completed,6);
    const serialized=save(h),loaded=harness();
    (SaveLoadService as any).applyCitiesAndProduction(serialized.cities,loaded.manager,loaded.production,loaded.map,loaded.grid,'standard');
    const restored=loaded.manager.getCity(h.city.id)!;
    assert.equal(restored.settlementStage,'Metropolis');assert.equal(restored.ownerId,'enemy');
    // Isolate stage capacity from working infrastructure/energy effects.
    const capacity=Object.create(PowerPlantSystem.prototype) as PowerPlantSystem;
    Object.assign(capacity,{cityManager:loaded.manager,getCityPowerPlant:()=>undefined,getCityRenewableCapacity:()=>0});
    const metropolisCapacity=capacity.getCityPopulationCapacity(restored.id);
    restored.settlementStage='City';assert.equal(metropolisCapacity-capacity.getCityPopulationCapacity(restored.id),10);
  }
});

test('alternatives count once; early infrastructure counts; every slot is necessary',()=>{
  for(const missing of METROPOLIS_DEVELOPMENT_REQUIREMENTS){
    const h=harness();h.city.settlementStage='City';
    for(const options of METROPOLIS_DEVELOPMENT_REQUIREMENTS)if(options!==missing)for(const id of options)h.buildings.add(getBuildingById(id)!);
    assert.equal(h.city.settlementStage,'City');assert.equal(getSettlementProgress(h.city,h.buildings,()=>true).completed,5);
    h.buildings.add(getBuildingById(missing[0])!);assert.equal(h.city.settlementStage,'Metropolis');
  }
  const h=harness();for(const options of METROPOLIS_DEVELOPMENT_REQUIREMENTS)h.buildings.add(getBuildingById(options[0])!);
  assert.equal(h.city.settlementStage,'Village');h.town();h.expand();h.complete('workshop');for(const id of CITY_DEVELOPMENT_BUILDINGS)h.complete(id);
  assert.equal(h.city.settlementStage,'Metropolis');
});

test('partial Metropolis progress survives load; demolishing the last wind farm clears only unfinished credit',async()=>{
  const {InfrastructureSabotageSystem}=await import('../src/systems/InfrastructureSabotageSystem');
  const {WonderSystem}=await import('../src/systems/WonderSystem');
  const {Unit}=await import('../src/entities/Unit');
  const {WORK_BOAT}=await import('../src/data/units');
  const h=harness();h.city.settlementStage='City';h.expand();
  h.map.tiles[4][6].type=TileType.Coast;h.map.tiles[3][6].type=TileType.Coast;
  h.complete('offshore_wind_farm');h.complete('offshore_wind_farm');h.complete('airport');
  const serialized=save(h),loaded=harness();
  SaveLoadService.restoreTiles(serialized.tiles,loaded.map);
  (SaveLoadService as any).applyCitiesAndProduction(serialized.cities,loaded.manager,loaded.production,loaded.map,loaded.grid,'standard');
  assert.equal(getSettlementProgress(loaded.manager.getCity(h.city.id)!,loaded.manager.getBuildings(h.city.id),()=>true).completed,2);
  const sabotage=new InfrastructureSabotageSystem(h.map,h.manager,new WonderSystem(),h.nations,()=>{});
  const farms=h.map.tiles.flat().filter(t=>t.buildingId==='offshore_wind_farm');assert.equal(farms.length,2);
  for(const [i,tile] of farms.entries()){
    const worker=new Unit({id:`worker${i}`,name:'Worker',ownerId:'human',unitType:WORK_BOAT,tileX:tile.x,tileY:tile.y});
    assert.equal(sabotage.destroyBuilding(worker),true);
    assert.equal(getSettlementProgress(h.city,h.buildings,()=>true).completed,i===0?2:1);
  }
});
