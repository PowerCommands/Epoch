import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { CityTerritorySystem } from '../src/systems/CityTerritorySystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { HexGridLayout } from '../src/systems/gridLayout/HexGridLayout.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { WonderPlacementSystem } from '../src/systems/WonderPlacementSystem.ts';
import { getUrbanSlots, getSettlementStage, URBAN_SLOTS } from '../src/systems/UrbanDevelopment.ts';
import { getBuildingById, BARRACKS, FACTORY } from '../src/data/buildings.ts';
import { completeBuildingUpgrade } from '../src/systems/buildingUpgrades.ts';
import { getCityViewTileBreakdown } from '../src/systems/CityViewData.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import { PYRAMIDS } from '../src/data/wonders.ts';

export function setup() {
  const map: MapData = { width: 9, height: 9, tileSize: 64,
    tiles: Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>({x,y,type:TileType.Plains}))) };
  const city = new City({id:'city', name:'Alderwick',ownerId:'human',tileX:4,tileY:4});
  const manager=new CityManager(); manager.addCity(city);
  const territory=new CityTerritorySystem();const grid=new HexGridSystem();
  territory.initializeOwnedTiles(city,map,grid);
  const placement=new BuildingPlacementSystem();
  return {map,city,manager,territory,grid,placement,buildings:manager.getBuildings(city.id)};
}

test('new Village owns six fixed slots matching hex adjacency and projected directions',()=>{
  const {city,map,grid,buildings}=setup();
  assert.equal(getSettlementStage(buildings),'Village');assert.equal(city.ownedTileCoords.length,7);
  const slots=getUrbanSlots(city);const layout=new HexGridLayout();const center=layout.tileToWorld({x:4,y:4},map);
  assert.deepEqual(new Set(slots.map(s=>`${s.x},${s.y}`)),new Set(grid.getAdjacentCoords({x:4,y:4}).map(s=>`${s.x},${s.y}`)));
  const signs=slots.map(s=>{const p=layout.tileToWorld(s,map);return [Math.sign(p.x-center.x),Math.sign(p.y-center.y)];});
  assert.deepEqual(signs,[[-1,-1],[1,-1],[1,0],[1,1],[-1,1],[-1,0]]);
  slots.forEach(s=>assert.deepEqual(map.tiles[s.y][s.x].urbanSlot,{cityId:city.id,buildingId:s.buildingId}));
});

test('human and AI complete the same slots automatically; only sixth building develops Town',()=>{
  for(const ai of [false,true]){
    const {city,map,placement,buildings,territory,grid}=setup();
    city.ownerId=ai?'ai':'human';for(const s of getUrbanSlots(city))map.tiles[s.y][s.x].ownerId=city.ownerId;
    URBAN_SLOTS.forEach((s,i)=>{
      const def=getBuildingById(s.buildingId)!;
      assert.equal(placement.startPlacement(city,def.id,map),false);assert.equal(placement.isActive(),false);
      if(ai)assert.ok(placement.reserveFirstValidPlacement(city,def,map));
      const tile=placement.completePhysicalBuilding(city,def,map);assert.ok(tile);
      const slot=getUrbanSlots(city)[i];assert.deepEqual([tile.x,tile.y],[slot.x,slot.y]);
      completeBuildingUpgrade(buildings,def);
      assert.equal(getSettlementStage(buildings),i===5?'Town':'Village');
      assert.equal(getCityViewTileBreakdown(city,slot,map,grid,territory)?.buildingName,def.name);
    });
    assert.equal(buildings.getAll().length,6);
    assert.equal(buildings.getAll().reduce((sum,id)=>sum+(getBuildingById(id)!.modifiers.productionPercent??0),0),5);
    buildings.setBroken('forge',true);assert.equal(getSettlementStage(buildings),'Town');assert.equal(buildings.hasActive('forge'),true);
  }
});

test('reserved slots exclude ordinary buildings and wonders; expanded territory works normally',()=>{
  const {city,map,placement}=setup();
  assert.deepEqual(placement.getValidPlacementCoords(city,BARRACKS,map),[]);
  assert.deepEqual(new WonderPlacementSystem().getValidPlacementCoords(city,PYRAMIDS,map),[]);
  city.ownedTileCoords.push({x:6,y:4});map.tiles[4][6].ownerId=city.ownerId;
  assert.equal(placement.startPlacement(city,BARRACKS.id,map),true);
  assert.equal(placement.selectTile(city,{x:6,y:4},map).status,'reserved');
  assert.equal(placement.completePhysicalBuilding(city,BARRACKS,map)?.buildingId,BARRACKS.id);
});

test('terrain and resources remain intact; capture and existing upgrades preserve development',()=>{
  const {city,map,placement,manager,buildings}=setup();
  for(const slot of getUrbanSlots(city)){
    const tile=map.tiles[slot.y][slot.x];tile.type=TileType.Coast;tile.resourceId='fish';
    assert.ok(placement.completePhysicalBuilding(city,getBuildingById(slot.buildingId)!,map));
    buildings.add(getBuildingById(slot.buildingId)!);
    assert.equal(tile.type,TileType.Coast);assert.equal(tile.resourceId,'fish');
  }
  manager.transferOwnership(city.id,'captor');for(const coord of city.ownedTileCoords)map.tiles[coord.y][coord.x].ownerId='captor';
  assert.equal(getSettlementStage(buildings),'Town');
  const workshopTile=map.tiles[4][6];workshopTile.ownerId='captor';workshopTile.buildingId='workshop';city.ownedTileCoords.push({x:6,y:4});buildings.add(getBuildingById('workshop')!);
  const upgraded=placement.completePhysicalBuilding(city,FACTORY,map);assert.ok(upgraded);
  completeBuildingUpgrade(buildings,FACTORY);assert.equal(getSettlementStage(buildings),'Town');
  assert.equal(upgraded.urbanSlot,undefined);
});

test('new urban reservations are serialized exactly, including empty and completed slots',async()=>{
  const {SaveLoadService}=await import('../src/systems/SaveLoadService.ts');
  for(const count of [0,2,5,6]){
    const h=setup();
    for(const slot of getUrbanSlots(h.city).slice(0,count)){
      const def=getBuildingById(slot.buildingId)!;
      h.placement.completePhysicalBuilding(h.city,def,h.map);h.buildings.add(def);
    }
    const saved=JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(h.map)));
    const restored=setup();SaveLoadService.restoreTiles(saved,restored.map);
    assert.deepEqual(JSON.parse(JSON.stringify(restored.map.tiles)),JSON.parse(JSON.stringify(h.map.tiles)));
  }
});

test('worker improvements cannot consume a reserved urban position',async()=>{
  const {BuilderSystem}=await import('../src/systems/BuilderSystem.ts');
  const {UnitManager}=await import('../src/systems/UnitManager.ts');
  const {TurnManager}=await import('../src/systems/TurnManager.ts');
  const {NationManager}=await import('../src/systems/NationManager.ts');
  const h=setup();
  const builder=new BuilderSystem(new UnitManager(h.map.width,h.map.height),h.manager,new TurnManager(new NationManager()),h.map,h.grid);
  for(const slot of getUrbanSlots(h.city))assert.equal(builder.canNationImproveLandTile(h.city.ownerId,h.map.tiles[slot.y][slot.x]),false);
});

test('razing releases all permanent reservations for future settlements',async()=>{
  const {razeCapturedCity}=await import('../src/systems/CityCaptureDecision.ts');
  const h=setup();
  razeCapturedCity(h.city,{
    mapData:h.map,cityManager:h.manager,
    productionSystem:{clearProduction:()=>{}},wonderSystem:{removeWondersForCity:()=>[]},
  } as Parameters<typeof razeCapturedCity>[1]);
  assert.equal(h.manager.getCity(h.city.id),undefined);
  for(const slot of getUrbanSlots(h.city))assert.equal(h.map.tiles[slot.y][slot.x].urbanSlot,undefined);
});

test('Granary cannot select, reserve or complete on any of the six urban slots',()=>{
  const h=setup(),granary=getBuildingById('granary')!;
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city,granary,h.map),[]);
  assert.equal(h.placement.startPlacement(h.city,granary.id,h.map),false);
  assert.equal(h.placement.reserveFirstValidPlacement(h.city,granary,h.map),undefined);
  for(const slot of getUrbanSlots(h.city)){
    const tile=h.map.tiles[slot.y][slot.x];
    tile.buildingConstruction={cityId:h.city.id,buildingId:granary.id};
    assert.equal(h.placement.completePhysicalBuilding(h.city,granary,h.map),null);
    assert.equal(h.placement.finalizeReservedBuilding(h.city.id,granary.id,h.map),null);
    assert.equal(tile.buildingId,undefined);
    assert.equal(tile.urbanSlot?.buildingId,slot.buildingId);
    tile.buildingConstruction=undefined;
  }
});

test('slot geometry blocks unrelated buildings even without tile reservation metadata',()=>{
  const h=setup(),granary=getBuildingById('granary')!;
  // Deliberately incomplete runtime state must fail closed, not create or infer reservations.
  for(const slot of getUrbanSlots(h.city))delete h.map.tiles[slot.y][slot.x].urbanSlot;
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city,granary,h.map),[]);
  assert.deepEqual(new WonderPlacementSystem().getValidPlacementCoords(h.city,PYRAMIDS,h.map),[]);
  for(const slot of getUrbanSlots(h.city)){
    const tile=h.map.tiles[slot.y][slot.x];
    tile.buildingConstruction={cityId:h.city.id,buildingId:granary.id};
    assert.equal(h.placement.completePhysicalBuilding(h.city,granary,h.map),null);
    assert.equal(tile.buildingId,undefined);assert.equal(tile.urbanSlot,undefined);
    tile.buildingConstruction=undefined;
  }
});

test('tile selection revalidates live reservation state instead of trusting its cached list',()=>{
  const h=setup(),granary=getBuildingById('granary')!;
  const coord={x:6,y:4},tile=h.map.tiles[4][6];
  h.city.ownedTileCoords.push(coord);tile.ownerId=h.city.ownerId;
  assert.equal(h.placement.startPlacement(h.city,granary.id,h.map),true);
  tile.urbanSlot={cityId:'another-city',buildingId:'market'};
  assert.equal(h.placement.selectTile(h.city,coord,h.map).status,'invalid');
  assert.equal(tile.buildingConstruction,undefined);
  delete tile.urbanSlot;
  assert.equal(h.placement.selectTile(h.city,coord,h.map).status,'reserved');
  assert.equal(h.placement.completePhysicalBuilding(h.city,granary,h.map),tile);
});

test('an unrelated predecessor cannot be upgraded on a reserved urban tile',()=>{
  const h=setup(),slot=getUrbanSlots(h.city).find(s=>s.buildingId==='market')!;
  const tile=h.map.tiles[slot.y][slot.x];tile.buildingId='barracks';
  const armory=getBuildingById('armory')!;
  assert.deepEqual(h.placement.getValidPlacementCoords(h.city,armory,h.map),[]);
  assert.equal(h.placement.completePhysicalBuilding(h.city,armory,h.map),null);
  assert.equal(tile.buildingId,'barracks');
});

test('a queued wonder cannot complete over a permanent urban reservation',()=>{
  const h=setup(),slot=getUrbanSlots(h.city)[0],tile=h.map.tiles[slot.y][slot.x];
  tile.wonderConstruction={cityId:h.city.id,wonderId:PYRAMIDS.id};
  assert.equal(new WonderPlacementSystem().finalizeReservedWonder(h.city.id,PYRAMIDS.id,h.map),null);
  assert.equal(tile.wonderId,undefined);
});
