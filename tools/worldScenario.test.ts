import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { RIVER_DIRECTIONS, riverNeighbors } from '../src/systems/geography/Rivers';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { getLeadersByNationId } from '../src/data/leaders';
import { getNationDefinitionById } from '../src/data/nations';
import { resolveScenarioMeta } from '../src/data/scenarioMeta';
import { resolveScenarioTurningPointTriggerYears } from '../src/systems/scenarioTurningPoints';
import { orderScenarios } from '../public/shared/scenario-order.js';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';

const scenario:ScenarioData=JSON.parse(fs.readFileSync('public/assets/maps/world.json','utf8'));
const expected=[
 ['usa','leader_donald_j_trump',53,31],['brazil','leader_jair_bolsonaro',50,58],
 ['england','leader_boris_johnson',82,25],['germany','leader_angela_merkel',87,25],
 ['nigeria','leader_bola_tinubu',75,46],['south_africa','leader_nelson_mandela',74,62],
 ['china','leader_mao_zedong',119,31],['india','leader_narendra_modi',103,36],
 ['japan','leader_oda-nobunaga',126,33],['australia','leader_john_howard',112,67],
] as const;
const tile=(q:number,r:number)=>q>=0&&q<150&&r>=0&&r<100?scenario.map.tiles[r*150+q]:undefined;
const water=(t:ReturnType<typeof tile>)=>!!t&&['ocean','coast'].includes(t.type);
const walkable=(t:ReturnType<typeof tile>)=>!!t&&!['ocean','coast','ice','mountain'].includes(t.type);
const distance=(a:{q:number;r:number},b:{q:number;r:number})=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function flood(q:number,r:number,allowed:(t:ReturnType<typeof tile>)=>boolean){
 const seen=new Set<string>([`${q},${r}`]),queue=[tile(q,r)!];
 for(let i=0;i<queue.length;i++)for(const [dq,dr]of RIVER_DIRECTIONS){
  const t=tile(queue[i].q+dq,queue[i].r+dr);
  if(t&&!seen.has(`${t.q},${t.r}`)&&allowed(t)){seen.add(`${t.q},${t.r}`);queue.push(t);}
 }
 return queue;
}
const region=(t:{q:number;r:number})=>{
 const lon=(t.q+t.r/2-95)/.34,lat=(50-t.r)/.48;
 if(lon<-30)return lat>13?'northAmerica':'southAmerica';
 if(lon<55&&lat<36&&lat>-36)return 'africa';
 if(lon<45&&lat>=36&&lat<72)return 'europe';
 if(lon>105&&lat<-10&&lat>-50)return 'oceania';
 if(lon>=45&&lat>-10&&lat<74)return 'asia';
 return 'remote';
};

test('World replaces the old scenario, is first in base ordering and keeps the stable key',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/assets/maps/manifest.json','utf8'));
 assert.deepEqual(manifest.maps[0],{key:'map_world',label:'World',file:'assets/maps/world.json',order:1});
 assert.equal(orderScenarios(manifest.maps,{getItem:()=>null})[0].key,'map_world');
 assert.equal(manifest.maps.filter((m:any)=>m.key==='map_world'||m.label==='World').length,1);
 assert.ok(!fs.existsSync('public/assets/maps/worldScenario.json'));
 assert.equal(scenario.meta.name,'World');
 assert.deepEqual([scenario.map.width,scenario.map.height],[150,100]);
 assert.equal(scenario.map.tiles.length,15000);
 assert.equal(new Set(scenario.map.tiles.map(t=>`${t.q},${t.r}`)).size,15000);
});

test('all ten canonical nations and leaders start with exactly one capital-site Settler',()=>{
 assert.equal(scenario.nations.length,10);assert.equal(scenario.units.length,10);assert.deepEqual(scenario.cities,[]);
 assert.equal(scenario.nations.filter(n=>n.isHuman).length,1);
 for(const [id,leader,q,r]of expected){
  const nation=scenario.nations.find(n=>n.id==='nation_'+id)!;
  assert.ok(nation,id);assert.equal(nation.color,getNationDefinitionById(nation.id)!.color);
  assert.equal(nation.leaderId,leader);assert.ok(getLeadersByNationId(nation.id).some(l=>l.id===leader));
  assert.deepEqual(nation.startTerritoryCenter,{q,r});assert.equal(tile(q,r)!.type,'meadow');
  assert.deepEqual(scenario.units.filter(u=>u.nationId===nation.id),[{nationId:nation.id,unitTypeId:'settler',q,r}]);
  const nearby=flood(q,r,t=>walkable(t)&&distance(t!,{q,r})<=8);
  assert.ok(nearby.length>=25,`${id}: room to develop`);
  for(const resource of ['wheat','cattle','horses','iron','coal'])assert.ok(nearby.some(t=>t.resourceId===resource),`${id}: reachable ${resource}`);
 }
});

test('naval separation, connected oceans and Beach opportunities on all inhabited continents',()=>{
 const britain=flood(82,25,walkable),japan=flood(126,33,walkable);
 assert.ok(!britain.some(t=>t.q===87&&t.r===25),'Channel separates England from Germany');
 assert.ok(!japan.some(t=>t.q===119&&t.r===31),'Japan is separated from China');
 assert.ok(britain.length<80&&japan.length<80);
 const ocean=flood(0,0,water),seaCount=scenario.map.tiles.filter(water).length;
 assert.ok(ocean.length/seaCount>.97,'major oceans share navigable routes');
 for(const name of ['northAmerica','southAmerica','europe','africa','asia','oceania']){
  const beaches=scenario.map.tiles.filter(t=>region(t)===name&&t.type==='beach');
  assert.ok(beaches.length>=3,`${name}: selective hotel coastlines`);
  for(const t of beaches)assert.ok(RIVER_DIRECTIONS.some(([dq,dr])=>water(tile(t.q+dq,t.r+dr))));
 }
});

test('normal loader preserves every tile, legal resource and reciprocal river link',()=>{
 const parsed=ScenarioLoader.parse(scenario);
 assert.equal(parsed.nations.length,10);assert.equal(parsed.units.length,10);
 for(const t of scenario.map.tiles){
  assert.ok(tile(t.q,t.r));
  const loaded=parsed.mapData.tiles[t.r][t.q];
  assert.equal(loaded.type,t.type);assert.equal(loaded.resourceId,t.resourceId);assert.equal(loaded.riverConnections,t.riverConnections);
  if(t.resourceId)assert.ok(getNaturalResourceById(t.resourceId)?.allowedTileTypes.includes(t.type as TileType),`${t.resourceId}: ${t.q},${t.r}`);
  if(t.riverConnections){
   assert.ok(t.riverConnections>0&&t.riverConnections<=63);assert.notEqual(t.type,'mountain');
   for(const n of riverNeighbors(t.q,t.r,t.riverConnections)){
    const next=tile(n.q,n.r);assert.ok(next);
    assert.ok(riverNeighbors(n.q,n.r,next.riverConnections??0).some(p=>p.q===t.q&&p.r===t.r));
    if(water(t))assert.ok(!water(next),'sea tiles are mouths only');
   }
  }
 }
 assert.ok(scenario.map.tiles.filter(t=>t.riverConnections).length>=250);
 for(const name of ['northAmerica','southAmerica','europe','africa','asia','oceania'])assert.ok(scenario.map.tiles.some(t=>region(t)===name&&t.riverConnections),`${name}: rivers`);
});

test('plentiful regional resources, remote poles and globally distributed rare archaeology',()=>{
 assert.ok(scenario.map.tiles.filter(t=>t.resourceId).length>1100);
 const count=(id:string)=>scenario.map.tiles.filter(t=>t.resourceId===id).length;
 for(const id of ['oil','natural_gas','coal','iron','uranium','horses','rice','spices','silk','fish'])assert.ok(count(id)>=5,id);
 assert.ok(count('polar_bear')>=5);
 for(const t of scenario.map.tiles.filter(t=>t.resourceId==='polar_bear')){assert.equal(t.type,'ice');assert.ok(t.r<15);}
 assert.ok(scenario.map.tiles.some(t=>t.r>92&&t.type==='ice'));
 for(const name of ['northAmerica','southAmerica','europe','africa','asia','oceania'])assert.ok(scenario.map.tiles.filter(t=>region(t)===name&&t.resourceId&&getNaturalResourceById(t.resourceId)?.archaeological&&!water(t)).length>=5,name);
 assert.ok(count('ancient_pottery')>count('ancient_coins'));
 assert.ok(count('ancient_coins')>count('royal_relics'));
 assert.ok(count('royal_relics')>count('ancient_treasure'));
 assert.equal(count('shipwreck'),6);
 assert.ok(scenario.map.tiles.filter(t=>t.resourceId==='shipwreck'&&scenario.nations.every(n=>distance(t,n.startTerritoryCenter)>12)).length>=2);
});

test('open world has normal metadata defaults and no authored diplomatic or historical setup',()=>{
 assert.deepEqual(scenario.nationDetails,{});assert.deepEqual(scenario.initialDiplomacy,[]);assert.deepEqual(scenario.historicalEvents,[]);
 assert.equal(scenario.mutualFoeAgreements,undefined);assert.equal(scenario.leaderConfiguration,undefined);
 assert.ok(Object.values(resolveScenarioTurningPointTriggerYears(scenario)).every(v=>v===null));
 const resolved=resolveScenarioMeta(scenario.meta),defaults=resolveScenarioMeta(undefined);
 const {name,description,...rest}=resolved;
 const {name:unusedName,description:unusedDescription,...defaultRest}=defaults;
 assert.deepEqual(rest,defaultRest);
 assert.deepEqual(Object.keys(scenario.meta).sort(),['description','name','version']);
 assert.ok(scenario.worldMarkers!.every(m=>m.type==='geographic'));
 assert.ok(scenario.map.tiles.every(t=>!t.buildingId&&!t.improvementId));
});

test('compact central polar caps frame the landscape map and Globe navigation',()=>{
 const north=scenario.map.tiles.filter(t=>t.type==='ice'&&t.r<7);
 const south=scenario.map.tiles.filter(t=>t.type==='ice'&&t.r>92);
 assert.ok(north.length>100&&north.length<250);
 assert.ok(south.length>150&&south.length<300);
 for(const cap of [north,south]){
  assert.ok(Math.abs(cap.reduce((sum,t)=>sum+t.q,0)/cap.length-74.5)<1);
  assert.ok(cap.every(t=>t.q>48&&t.q<101),'small caps leave substantial ocean at the edges');
 }
 assert.ok(scenario.map.tiles.filter(t=>t.type==='ice').length<750,'less ice than the former portrait map');
 assert.equal(scenario.worldMarkers!.length,16);
 for(const marker of scenario.worldMarkers!)assert.ok(tile(marker.x,marker.y),marker.name);
 for(const name of ['Pacific Ocean','Atlantic Ocean','Indian Ocean','Arctic Ocean','Southern Ocean','Sahara','Andes','Himalayas','Antarctica'])assert.ok(scenario.worldMarkers!.some(m=>m.name===name),name);
});
