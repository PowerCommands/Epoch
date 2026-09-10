import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { COMPOSITE_BOWMAN, ARCHER_GALLEY, CATAPULT, SWORDSMAN } from '../src/data/units.ts';
import type { UnitType } from '../src/entities/UnitType.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { CombatSystem, type CityCombatEvent } from '../src/systems/CombatSystem.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

// Recife siege from city-will-not-give-up.json, translated onto a small map.
function siege(atWar = true) {
  const map: MapData = {width:8,height:8,tileSize:32,tiles:Array.from({length:8},(_,y)=>
    Array.from({length:8},(_,x)=>({x,y,type:TileType.Plains}))) } as MapData;
  const nations = new NationManager();
  for (const id of ['canada','brazil']) nations.addNation(new Nation({id,name:id,color:0}));
  const cities = new CityManager();
  const turns = new TurnManager(nations);
  const units = new UnitManager(8,8);
  const diplomacy = new DiplomacyManager(turns);
  const production = new ProductionSystem(cities,turns,new HappinessSystem(nations,cities));
  const combat = new CombatSystem(units,turns,cities,production,map,diplomacy,new HexGridSystem());
  if (atWar) diplomacy.declareWar('canada','brazil');
  const city = new City({id:'recife',name:'Recife',ownerId:'brazil',tileX:3,tileY:3,isCapital:false});
  city.health=1;
  cities.addCity(city);
  const events: CityCombatEvent[]=[];
  combat.onCityCombat(e=>events.push(e));
  function add(type:UnitType,x=2,y=3,ownerId='canada') {
    const u=new Unit({id:`unit_${units.getAllUnits().length}`,name:type.name,ownerId,unitType:type,tileX:x,tileY:y,qualityLevel:5});
    units.addUnit(u);return u;
  }
  const attack=(u:Unit)=>combat.tryAttack(u,3,3);
  return {map,city,units,combat,diplomacy,events,add,attack};
}

test('Recife: galley removes garrison, adjacent bowman storms and occupies the depleted city',()=>{
  const h=siege();
  const garrison=h.add(SWORDSMAN,3,3,'brazil');garrison.health=10;
  const galley=h.add(ARCHER_GALLEY,4,4);
  const bowman=h.add(COMPOSITE_BOWMAN);
  assert.equal(h.attack(galley),true);
  assert.equal(h.units.getUnit(garrison.id),undefined);
  assert.equal(h.city.ownerId,'brazil');
  assert.equal(h.attack(bowman),true);
  assert.equal(h.city.ownerId,'canada');
  assert.deepEqual([bowman.tileX,bowman.tileY],[3,3]);
  assert.ok(bowman.health<100,'storming takes counterattack damage');
  assert.equal(bowman.movementPoints,0);
  assert.equal(h.events.at(-1)?.captured,true);
});

test('garrison must be defeated before a separate city assault',()=>{
  const h=siege();const guard=h.add(SWORDSMAN,3,3,'brazil');guard.health=1;
  const bowman=h.add(COMPOSITE_BOWMAN);
  h.attack(bowman);
  assert.equal(h.city.ownerId,'brazil');
  assert.equal(bowman.tileX,2);
  assert.equal(h.attack(bowman),false,'no second attack without movement');
});

for(const [label,type,x,y] of [
  ['distant bowman',COMPOSITE_BOWMAN,1,3],
  ['adjacent galley',ARCHER_GALLEY,2,3],
  ['adjacent siege engine',CATAPULT,2,3],
] as const) test(`${label} still only bombards`,()=>{
  const h=siege();const unit=h.add(type,x,y);
  assert.equal(h.attack(unit),true);
  assert.equal(h.city.health,1);
  assert.equal(h.city.ownerId,'brazil');
  assert.equal(unit.health,100);
  assert.equal(h.events.at(-1)?.captured,false);
});

test('healthy city is bombarded first, then stormed on a later action',()=>{
  const h=siege();h.city.health=2;const u=h.add(COMPOSITE_BOWMAN);
  h.attack(u);assert.equal(h.city.health,1);assert.equal(h.city.ownerId,'brazil');
  u.movementPoints=u.maxMovementPoints;h.attack(u);assert.equal(h.city.ownerId,'canada');
});

test('a bowman killed by the city counterattack cannot occupy it',()=>{
  const h=siege();const u=h.add(COMPOSITE_BOWMAN);u.health=1;
  h.attack(u);assert.equal(h.city.ownerId,'brazil');assert.equal(h.events.at(-1)?.result.attackerDied,true);
});

test('embarked bowman cannot storm a city',()=>{
  const h=siege();const u=h.add(COMPOSITE_BOWMAN);h.map.tiles[3][2].type=TileType.Coast;
  assert.equal(h.attack(u),false);assert.equal(h.city.ownerId,'brazil');
});

test('storming respects diplomacy',()=>{
  const h=siege(false);const u=h.add(COMPOSITE_BOWMAN);
  assert.equal(h.attack(u),false);assert.equal(h.city.ownerId,'brazil');
});
