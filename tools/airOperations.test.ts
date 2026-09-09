import { planAirProduction } from '../src/systems/ai/AIAirProduction';
import assert from 'node:assert/strict';
import test from 'node:test';
import { AIRFIELD, AIR_BASE } from '../src/data/buildings';
import { FIGHTER_INTERCEPTION, GROUND_INTERCEPTION, airMissionRoll } from '../src/data/airOperations';
import { TRIPLANE, FIGHTER, GREAT_WAR_BOMBER, BOMBER, STEALTH_BOMBER, ANTI_AIRCRAFT_GUN, MOBILE_SAM, CARRIER, WARRIOR, HELICOPTER_GUNSHIP, ATOMIC_BOMB, GUIDED_MISSILE, NUCLEAR_MISSILE, canCarryUnitType } from '../src/data/units';
import type { UnitType } from '../src/entities/UnitType';
import { Unit } from '../src/entities/Unit';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { UnitManager } from '../src/systems/UnitManager';
import { CityManager } from '../src/systems/CityManager';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { CombatSystem } from '../src/systems/CombatSystem';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { completeBuildingUpgrade } from '../src/systems/buildingUpgrades';
import { getCityUnitProductionBlockReason } from '../src/systems/ProductionRules';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { TileType, type MapData } from '../src/types/map';
import type { SavedUnit } from '../src/types/saveGame';
import type { AirFlightEvent } from '../src/systems/AirOperationsSystem';
import { getTechnologyById } from '../src/data/technologies';

function harness() {
  const map: MapData = { width: 30, height: 20, tileSize: 32, tiles: Array.from({ length: 20 },(_,y) => Array.from({ length: 30 },(_,x) => ({ x,y,type: TileType.Plains }))) };
  const grid = new HexGridSystem(), units = new UnitManager(30,20), cities = new CityManager(), nations = new NationManager();
  for (const id of ['a','b']) nations.addNation(new Nation({ id,name: id,color: 1 }));
  const turns = new TurnManager(nations), diplomacy = new DiplomacyManager(); diplomacy.declareWar('a','b');
  const production = new ProductionSystem(cities,turns,new HappinessSystem(nations,cities));
  const combat = new CombatSystem(units,turns,cities,production,map,diplomacy,grid);
  let serial = 0;
  const city = (x=2,y=10,ownerId='a',capacity=true) => {
    const c = new City({ id: `c${serial++}`, name: `Base ${serial}`, ownerId,tileX:x,tileY:y });
    cities.addCity(c); if (capacity) cities.getBuildings(c.id).add(AIRFIELD); return c;
  };
  const spawn = (type: UnitType=GREAT_WAR_BOMBER,x=2,y=10,ownerId='a',id=`u${serial++}`) => {
    const u = new Unit({ id,name: type.name,ownerId,tileX:x,tileY:y,unitType:type }); units.addUnit(u); return u;
  };
  const events: AirFlightEvent[] = []; combat.airOperations.onFlight(e => events.push(e));
  production.onCompleted((id,item) => {
    const c = cities.getCity(id)!;
    if (item.kind === 'building') { completeBuildingUpgrade(cities.getBuildings(id),item.buildingType); return true; }
    if (item.kind === 'unit') units.createUnit({ type:item.unitType,ownerId:c.ownerId,tileX:c.tileX,tileY:c.tileY,airBase: item.unitType.aircraftRole ? { kind:'city',id:c.id } : undefined,movementPoints:0 });
    return true;
  });
  return { map,grid,units,cities,nations,turns,diplomacy,production,combat,air:combat.airOperations,city,spawn,events };
}
function interceptionId(attacker: Unit, chance: number, succeeds: boolean): string {
  for (let i=0;;i++) if ((airMissionRoll(`1:${attacker.id}:def${i}`)<chance) === succeeds) return `def${i}`;
}

test('Flight and Radar unlock the data-driven 2/4 capacity upgrade chain', () => {
  assert.ok(getTechnologyById('flight')?.unlocks.some(u=>u.kind==='building' && u.id==='airfield'));
  assert.ok(getTechnologyById('radar')?.unlocks.some(u=>u.kind==='building' && u.id==='air_base'));
  assert.equal(AIRFIELD.aircraftCapacity,2); assert.equal(AIR_BASE.aircraftCapacity,4); assert.equal(AIR_BASE.upgradesFrom,AIRFIELD.id);
  const h=harness(); const c=h.city(); const a=h.spawn(); const b=h.spawn(); h.air.reconcile();
  completeBuildingUpgrade(h.cities.getBuildings(c.id),AIR_BASE);
  assert.equal(h.air.cityCapacity(c),4); assert.equal(h.cities.getBuildings(c.id).has(AIRFIELD.id),false);
  assert.ok(h.units.getUnit(a.id)); assert.ok(h.units.getUnit(b.id));
  h.cities.getBuildings(c.id).add(AIRFIELD); assert.equal(h.air.cityCapacity(c),4,'capacity never stacks');
});
test('production rejects missing/full capacity on enqueue, purchase/completion, and assigns producing base', () => {
  const h=harness(), c=h.city(2,10,'a',false), item={kind:'unit' as const,unitType:GREAT_WAR_BOMBER};
  h.production.enqueue(c.id,item); assert.equal(h.production.getQueue(c.id).length,0);
  h.cities.getBuildings(c.id).add(AIRFIELD);
  for(let i=0;i<2;i++) { h.production.enqueue(c.id,item); assert.equal(h.production.completeCurrentProduction(c.id).kind,'completed'); }
  assert.equal(h.air.usage({kind:'city',id:c.id}),2);
  assert.ok(h.units.getAllUnits().every(u=>u.airBase?.id===c.id));
  h.production.enqueue(c.id,item); assert.equal(h.production.getQueue(c.id).length,0);
  assert.match(getCityUnitProductionBlockReason(c,GREAT_WAR_BOMBER,h.map,h.grid,{aircraftProductionReason:c=>h.air.productionBlockReason(c)})!,/slot/);
  h.units.removeUnit(h.units.getAllUnits()[0].id); h.production.enqueue(c.id,item);
  h.cities.getBuildings(c.id).setBroken(AIRFIELD.id,true);
  assert.equal(h.production.completeCurrentProduction(c.id).kind,'blocked');
});
test('aircraft share base without collision or ordinary movement; helicopter stays mobile', () => {
  const h=harness(); h.city(); const ground=h.spawn(WARRIOR), a=h.spawn(), b=h.spawn(TRIPLANE); h.air.reconcile();
  assert.equal(h.units.getUnitAt(2,10),ground); assert.equal(h.units.getUnitsAt(2,10).length,3);
  assert.equal(h.units.moveUnit(a.id,3,10),false); assert.equal(h.units.moveUnit(b.id,3,10),false);
  const helicopter=h.spawn(HELICOPTER_GUNSHIP,4,10); assert.equal(h.units.moveUnit(helicopter.id,5,10),true);
});
test('mission uses base range, damages ground then emits outbound/return visual route atomically', () => {
  const h=harness(); h.city(); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b'); h.air.reconcile();
  assert.equal(h.combat.tryAttack(a,9,10),false); assert.equal(a.movementPoints,a.maxMovementPoints);
  assert.equal(h.combat.tryAttack(a,8,10),true); assert.equal(target.health,50); assert.equal(a.movementPoints,0);
  assert.deepEqual([a.tileX,a.tileY],[2,10]); assert.equal(h.events[0].kind,'strike');
  assert.equal(h.events[0].origin.x,2); assert.equal(h.events[0].destination.x,8);
  assert.equal(h.combat.tryAttack(a,8,10),false,'one mission per turn');
});
test('fighter strikes use simple weaker ground modifier and preserve quality', () => {
  const h=harness(); h.city(); const a=h.spawn(TRIPLANE), target=h.spawn(WARRIOR,7,10,'b'); a.qualityLevel=2;
  assert.equal(h.combat.tryAttack(a,7,10),true); assert.equal(target.health,100-Math.round(35*1.2*0.35)); assert.equal(a.qualityLevel,2);
});
test('garrison absorbs bomb damage and ranged missions never capture cities', () => {
  const h=harness(); h.city(); const enemy=h.city(6,10,'b',false), a=h.spawn(), defender=h.spawn(WARRIOR,6,10,'b');
  const health=enemy.health; h.combat.tryAttack(a,6,10); assert.equal(enemy.health,health); assert.equal(defender.health,50);
  h.units.removeUnit(defender.id); a.resetMovement(); h.combat.tryAttack(a,6,10); assert.equal(enemy.health,health-50); assert.equal(enemy.ownerId,'b');
});
for (const type of [TRIPLANE,ANTI_AIRCRAFT_GUN,MOBILE_SAM]) {
  test(`${type.name}: successful interception damages, aborts before bombing, and leaves defender at base/tile`, () => {
    const h=harness(); h.city(); h.city(5,10,'b'); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b');
    const defender=h.spawn(type,5,10,'b',interceptionId(a,0.2,true)); h.air.reconcile();
    assert.equal(h.combat.tryAttack(a,8,10),true); assert.equal(target.health,100); assert.ok(a.health<50);
    assert.equal(h.events[0].kind,'intercepted'); assert.equal(h.events[0].interceptor,defender);
    assert.deepEqual([defender.tileX,defender.tileY],[5,10]);
  });
}
test('failed interception allows attack; quality table includes independent Level 0 entries', () => {
  assert.deepEqual(FIGHTER_INTERCEPTION.map(p=>[p.radius,p.chance]),[[2,.1],[3,.2],[4,.3],[4,.4],[5,.5],[6,.6]]);
  assert.notEqual(FIGHTER_INTERCEPTION,GROUND_INTERCEPTION);
  const h=harness(); h.city(); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b'); h.spawn(MOBILE_SAM,5,10,'b',interceptionId(a,.2,false));
  assert.equal(h.combat.tryAttack(a,8,10),true); assert.equal(target.health,50); assert.equal(h.events[0].kind,'strike');
});
test('destroyed attacker frees capacity and emits no return', () => {
  const h=harness(); const c=h.city(), a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b');
  h.spawn(MOBILE_SAM,5,10,'b',interceptionId(a,.2,true)); h.combat.tryAttack(a,8,10);
  assert.equal(h.units.getUnit(a.id),undefined); assert.equal(target.health,100); assert.equal(h.air.usage({kind:'city',id:c.id}),0); assert.equal(h.events[0].destroyed,true);
});
test('overlapping coverage selects best quality once; failed best roll cannot cascade', () => {
  const h=harness(); h.city(); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b');
  const best=h.spawn(MOBILE_SAM,5,10,'b',interceptionId(a,.6,false)); best.qualityLevel=5;
  for(let i=0;i<10;i++) h.spawn(ANTI_AIRCRAFT_GUN,4+i%3,9,'b',`other${i}`);
  assert.equal(h.combat.tryAttack(a,8,10),true); assert.equal(target.health,50); assert.equal(h.events[0].kind,'strike');
});
test('Carrier has three slots, moves basing origin, permits missions at sea, resets aircraft turns', () => {
  const h=harness(); h.city(); h.cities.getBuildings(h.cities.getAllCities()[0].id).add(AIR_BASE);
  h.map.tiles[10][5].type=TileType.Ocean; h.map.tiles[10][6].type=TileType.Ocean;
  const carrier=h.spawn(CARRIER,5,10), aircraft=[h.spawn(),h.spawn(),h.spawn(),h.spawn()]; h.air.reconcile();
  for (const a of aircraft.slice(0,3)) assert.equal(h.air.rebase(a,{kind:'carrier',id:carrier.id}),true);
  assert.equal(h.air.rebase(aircraft[3],{kind:'carrier',id:carrier.id}),false); assert.equal(carrier.cargoUnitIds.length,3);
  h.units.moveUnit(carrier.id,6,10); assert.equal(h.air.baseFor(aircraft[0])?.x,6); assert.equal(aircraft[0].tileX,6);
  h.units.resetMovementForOwner('a'); const target=h.spawn(WARRIOR,12,10,'b'); assert.equal(h.combat.tryAttack(aircraft[0],12,10),true); assert.equal(target.health,50);
  assert.equal(h.units.unboardUnit(aircraft[0].id,7,10),false);
  for(const weapon of [ATOMIC_BOMB,GUIDED_MISSILE,NUCLEAR_MISSILE,HELICOPTER_GUNSHIP]) assert.equal(canCarryUnitType(CARRIER,weapon),false);
});
test('Rebase requires own capacity, turn/action and transfer range, consumes a turn without attacking', () => {
  const h=harness(); h.city(); const near=h.city(7,10), far=h.city(20,10), enemy=h.city(4,10,'b'), a=h.spawn(); h.air.reconcile();
  assert.deepEqual(h.air.rebaseDestinations(a).map(site=>site.base.id),[near.id]);
  assert.equal(h.air.rebase(a,{kind:'city',id:far.id}),false); assert.equal(h.air.rebase(a,{kind:'city',id:enemy.id}),false);
  assert.equal(h.air.rebase(a,{kind:'city',id:near.id}),true); assert.equal(a.airBase?.id,near.id); assert.equal(a.movementPoints,0); assert.equal(h.events[0].kind,'rebase');
});
for (const kind of ['sabotage','capture','remove'] as const) test(`${kind}: invalid city base diverts aircraft, with explicit loss if no slot`, () => {
  const h=harness(), home=h.city(), next=h.city(6,10), a=h.spawn(), b=h.spawn(); h.air.reconcile();
  h.spawn(TRIPLANE,6,10); h.air.reconcile();
  if(kind==='sabotage') h.cities.getBuildings(home.id).setBroken(AIRFIELD.id,true);
  if(kind==='capture') h.cities.transferOwnership(home.id,'b');
  if(kind==='remove') h.cities.removeCity(home.id);
  assert.equal(h.air.usage({kind:'city',id:next.id}),2); assert.equal([a,b].filter(u=>h.units.getUnit(u.id)).length,1);
});
test('carrier destruction diverts cargo; bomber payload follows rebase', () => {
  const h=harness(); h.city(); const carrier=h.spawn(CARRIER,5,10), a=h.spawn(BOMBER), payload=h.spawn(ATOMIC_BOMB);
  assert.equal(h.units.boardUnit(payload.id,a.id,0),true); h.air.reconcile(); h.air.rebase(a,{kind:'carrier',id:carrier.id});
  assert.equal(payload.tileX,5); h.units.removeUnit(carrier.id); assert.ok(h.units.getUnit(a.id)); assert.equal(a.airBase?.kind,'city'); assert.equal(a.tileX,2); assert.equal(payload.tileX,2);
});
test('aircraft upgrades retain permanent quality and one base slot', () => {
  const h=harness(), home=h.city(), a=h.spawn(TRIPLANE); a.qualityLevel=4; h.air.reconcile();
  h.units.upgradeUnitType(a.id,FIGHTER); assert.equal(a.qualityLevel,4); assert.equal(a.airBase?.id,home.id); assert.equal(h.air.usage({kind:'city',id:home.id}),1);
});
test('save/load restores city and carrier assignments and safely migrates legacy metadata', () => {
  const h=harness(); h.city(); const carrier=h.spawn(CARRIER,5,10), a=h.spawn(), b=h.spawn(TRIPLANE); h.air.reconcile(); h.air.rebase(a,{kind:'carrier',id:carrier.id});
  const saved: SavedUnit[]=JSON.parse(JSON.stringify(h.units.getAllUnits().map(u=>({ ...u,unitTypeId:u.unitType.id }))));
  const apply=(SaveLoadService as unknown as {applyUnits(saved:SavedUnit[],units:UnitManager):void}).applyUnits;
  apply(saved,h.units); assert.equal(h.units.getUnit(a.id)?.airBase?.id,carrier.id); assert.equal(h.units.getUnit(b.id)?.airBase?.kind,'city');
  for(const u of saved) delete u.airBase;
  apply(saved,h.units); assert.equal(h.units.getUnit(a.id)?.airBase?.kind,'carrier'); assert.equal(h.units.getUnit(b.id)?.airBase?.kind,'city');
});
test('AI attacks, rebases toward fronts including carriers, and autorun resolves without animation waits', () => {
  const h=harness(); h.city(); const forward=h.spawn(CARRIER,7,10), a=h.spawn(), target=h.spawn(WARRIOR,12,10,'b'); h.air.reconcile();
  h.air.runAI('a'); assert.equal(a.airBase?.id,forward.id); assert.equal(target.health,100);
  h.units.resetMovementForOwner('a'); h.air.runAI('a'); assert.equal(target.health,50); assert.equal(a.movementPoints,0);
  assert.equal(h.events.length,2,'synchronous resolution emits presentation without waiting');
});
test('peace, ceasefire, foreign turns and combat permission block air missions', () => {
  const h=harness(); h.city(); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b');
  h.diplomacy.setCombatSuppressor(()=>true); assert.equal(h.combat.tryAttack(a,8,10),false);
  h.diplomacy.setCombatSuppressor(()=>false); h.combat.setMissionAttackPermission(()=>false); assert.equal(h.air.mission(a,8,10),false); assert.equal(target.health,100);
});

test('AI plans infrastructure before aircraft, expands full bases and values fighters against enemy air', () => {
  const context={capacity:0,used:0,cityCount:3,enemyAir:false,unitUnlocked:()=>true};
  assert.deepEqual(planAirProduction(context).map(p=>p.id),['airfield']);
  assert.deepEqual(planAirProduction({...context,capacity:2,used:2}).map(p=>p.id),['air_base']);
  const open=planAirProduction({...context,capacity:2,enemyAir:true});
  assert.ok(open.some(p=>p.id==='jet_fighter' && p.score>open.find(p=>p.id==='stealth_bomber')!.score));
  assert.ok(open.some(p=>p.id==='mobile_sam'));
  assert.deepEqual(planAirProduction({...context,unitUnlocked:()=>false}),[]);
});
test('ground air defense chooses exposed friendly cities and stays on station', () => {
  const h=harness(); h.city(); h.city(8,10,'b'); h.spawn(BOMBER,8,10,'b');
  const sam=h.spawn(MOBILE_SAM,1,10); h.air.reconcile();
  assert.deepEqual(h.air.defensePost(sam),{x:1,y:10});
  assert.equal(h.air.defensePost(sam,()=>false),undefined);
});
test('AI does not attack unknown targets or rebase using unknown fronts', () => {
  const h=harness(); h.city(); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b');
  h.air.runAI('a',()=>false); assert.equal(target.health,100); assert.equal(a.movementPoints,a.maxMovementPoints);
});
test('carrier-based fighter projects interception from its moved carrier', () => {
  const h=harness(); h.city(); h.city(20,10,'b'); const a=h.spawn(), target=h.spawn(WARRIOR,8,10,'b');
  const carrier=h.spawn(CARRIER,18,10,'b');
  const fighter=h.spawn(TRIPLANE,18,10,'b',interceptionId(a,.2,true));
  fighter.airBase={kind:'carrier',id:carrier.id}; h.air.reconcile();
  h.units.moveUnit(carrier.id,5,10);
  assert.equal(h.air.baseFor(fighter)?.x,5); h.combat.tryAttack(a,8,10);
  assert.equal(target.health,100); assert.equal(h.events[0].interceptorOrigin?.x,5);
});
test('queued aircraft pause production when their last available slot is filled', () => {
  const h=harness(), c=h.city(), item={kind:'unit' as const,unitType:GREAT_WAR_BOMBER};
  h.production.enqueue(c.id,item);
  h.spawn(); h.spawn(); h.air.reconcile();
  h.turns.start(); h.turns.endCurrentTurn(); h.turns.endCurrentTurn();
  const entry=h.production.getQueue(c.id)[0];
  assert.equal(entry.progress,0); assert.match(entry.blockedReason!,/slot/);
});
test('captured Carrier evacuates aircraft under their original owner', () => {
  const h=harness(); const home=h.city(), carrier=h.spawn(CARRIER,5,10), a=h.spawn(); h.air.reconcile();
  h.air.rebase(a,{kind:'carrier',id:carrier.id}); h.units.transferOwnership(carrier.id,'b');
  assert.equal(a.ownerId,'a'); assert.equal(a.airBase?.id,home.id); assert.deepEqual(carrier.cargoUnitIds,[]);
});
