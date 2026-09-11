import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { getDefaultLeaderByNationId, getLeadersByNationId } from '../src/data/leaders';
import { resolveScenarioMeta } from '../src/data/scenarioMeta';
import { RIVER_DIRECTIONS, riverNeighbors } from '../src/systems/geography/Rivers';
import type { ScenarioData } from '../src/types/scenario';
const s: ScenarioData = JSON.parse(fs.readFileSync('public/assets/maps/eastern-europe.json','utf8'));
const key = (p:{q:number;r:number})=>`${p.q},${p.r}`;
const tile = (q:number,r:number)=>s.map.tiles[r*170+q];
const bounds = (q:number,r:number)=>q>=0&&q<170&&r>=0&&r<70;
const water = (q:number,r:number)=>['ocean','coast'].includes(tile(q,r).type);
const owners = new Map(s.cities.flatMap(c=>c.ownedTileCoords!.map(p=>[key(p),c.nationId])));
function at(lon:number,lat:number) {const r=Math.round((71.8-lat)/.445);return {q:Math.round((lon+14)*2.7+23-r/2),r};}
const expected = [
 ['england','boris_johnson','London',-.13,51.51],['france','charles_de_gaulle','Paris',2.35,48.86],
 ['germany','angela_merkel','Berlin',13.405,52.52],['poland','donald_tusk','Warsaw',21.01,52.23],
 ['sweden','olof_palme','Stockholm',18.07,59.33],['finland','alexander_stubb','Helsinki',24.94,60.17],
 ['russia','vladimir_putin','Moscow',37.62,55.75],['ukraine','volodymyr_zelenskyy','Kyiv',30.52,50.45],
 ['denmark','mette_frederiksen','Copenhagen',12.57,55.68],
] as const;
function flood(start:{q:number;r:number},allowed:(q:number,r:number)=>boolean) {
 const seen=new Set([key(start)]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const [dq,dr] of RIVER_DIRECTIONS){
  const q=queue[i].q+dq,r=queue[i].r+dr,k=`${q},${r}`;
  if(bounds(q,r)&&!seen.has(k)&&allowed(q,r)){seen.add(k);queue.push({q,r});}
 }
 return seen;
}
test('registered 170×70 scenario uses exactly nine existing leaders and capital Settlers',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/assets/maps/manifest.json','utf8'));
 assert.deepEqual(manifest.maps.filter((m:any)=>m.key==='map_eastern_europe'),[{key:'map_eastern_europe',label:'Eastern Europe',file:'assets/maps/eastern-europe.json',order:10}]);
 const parsed=ScenarioLoader.parse(s);
 assert.deepEqual([s.map.width,s.map.height],[170,70]);assert.equal(s.map.tiles.length,11900);
 assert.equal(new Set(s.map.tiles.map(key)).size,11900);
 assert.deepEqual(s.nations.map(n=>n.id),expected.map(e=>'nation_'+e[0]));
 assert.equal(s.cities.length,9);assert.equal(s.units.length,9);
 for(const [id,leader,capital,lon,lat] of expected){
  const n=parsed.nations.find(n=>n.id==='nation_'+id)!;
  assert.equal(n.leaderId??getDefaultLeaderByNationId(n.id)?.id,'leader_'+leader);
  assert.ok(getLeadersByNationId(n.id).some(l=>l.id==='leader_'+leader));
  const c=s.cities.find(c=>c.nationId===n.id)!;assert.equal(c.name,capital);assert.ok(c.isCapital);
  assert.deepEqual(n.startTerritoryCenter,{q:c.q,r:c.r});
  assert.deepEqual(s.units.filter(u=>u.nationId===n.id),[{nationId:n.id,unitTypeId:'settler',q:c.q,r:c.r}]);
  const target=at(lon,lat);
  assert.ok(Math.max(Math.abs(c.q-target.q),Math.abs(c.r-target.r),Math.abs(c.q+c.r-target.q-target.r))<=2,capital);
  assert.equal(owners.get(key(c)),n.id);assert.ok(!water(c.q,c.r));assert.notEqual(tile(c.q,c.r).type,'mountain');
 }
});
test('default starting development and only the required domination exception',()=>{
 const landCount=s.map.tiles.filter(t=>!water(t.q,t.r)).length;
 assert.equal(s.meta.dominationLandPercent,50);
 for(const c of s.cities)assert.ok(c.ownedTileCoords!.length/landCount*100<50);
 assert.equal(s.turningPointEventsConfigured,true);
 const meta=resolveScenarioMeta(s.meta);assert.equal(meta.startYear,4000);assert.equal(meta.startYearIsBC,true);
 assert.equal(meta.timeProgression.mode,'auto');
 assert.deepEqual(s.initialDiplomacy,[]);assert.deepEqual(s.historicalEvents,[]);assert.deepEqual(s.nationDetails,{});
 for(const n of s.nations)for(const field of ['gold','researchedTechIds','unlockedCultureNodeIds','aiStrategyId'])assert.equal((n as any)[field],undefined);
 for(const field of ['dominationRequiredVassals','timeProgression','startYear'])assert.equal((s.meta as any)[field],undefined);
});
test('political geography keeps neighbors neutral and recognizable border positions',()=>{
 const landmarks:[string,number,number][]=[
  ['england',-2,53],['france',-1,47],['france',5,44],['germany',7,51],['germany',11.5,48.5],
  ['poland',17,52],['poland',23,51],['sweden',15,56.5],['sweden',18,64],['finland',27,63],
  ['russia',37.6,55.8],['russia',20.5,54.8],['ukraine',24,49.8],['ukraine',35,49],['ukraine',34,45.3],
  ['denmark',9.3,56],['denmark',11.6,55.55],
 ];
 for(const [id,lon,lat] of landmarks)assert.equal(owners.get(key(at(lon,lat))),'nation_'+id,`${id} at ${lon},${lat}`);
 for(const [lon,lat] of [[-4,57],[-3.7,52.3],[-8,53],[9,61],[5,52],[4.5,50.5],[8.5,47],[15,49],[26,54],[25,57],[26,58.5],[28,53],[27,47]]){
  const p=at(lon,lat);assert.ok(!water(p.q,p.r),`neutral land ${lon},${lat}`);assert.equal(owners.get(key(p)),undefined,`neutral ${lon},${lat}`);
 }
 const owned=new Set<string>();
 for(const c of s.cities)for(const p of c.ownedTileCoords!){assert.ok(bounds(p.q,p.r));assert.ok(!water(p.q,p.r));assert.ok(!owned.has(key(p)));owned.add(key(p));}
 const touches=(a:string,b:string)=>s.cities.find(c=>c.nationId==='nation_'+a)!.ownedTileCoords!.some(p=>RIVER_DIRECTIONS.some(([dq,dr])=>owners.get(`${p.q+dq},${p.r+dr}`)==='nation_'+b));
 for(const id of ['france','denmark','poland'])assert.ok(touches('germany',id),`Germany / ${id}`);
 for(const [a,b] of [['poland','ukraine'],['ukraine','russia'],['finland','russia']])assert.ok(touches(a,b));
});
test('British Isles are separated and major seas form navigable waterways',()=>{
 const mainland=flood(at(13,52),(q,r)=>!water(q,r));
 assert.ok(!mainland.has(key(s.nations[0].startTerritoryCenter)));
 const seas=[[-10,50],[0,56],[0,50],[19,56.5],[20,63],[27,60],[7,57]];
 const start=at(...seas[0] as [number,number]);assert.ok(water(start.q,start.r));
 const ocean=flood(start,water);
 for(const [lon,lat] of seas){const p=at(lon,lat);assert.ok(water(p.q,p.r),`sea ${lon},${lat}`);assert.ok(ocean.has(key(p)),`connected sea ${lon},${lat}`);}
 const copenhagen=s.nations.at(-1)!.startTerritoryCenter;
 assert.ok(!mainland.has(key(copenhagen)),'Copenhagen remains on Zealand');
});
test('all terrain and reciprocal major rivers survive loading',()=>{
 const parsed=ScenarioLoader.parse(s);
 assert.ok(s.map.tiles.filter(t=>t.riverConnections).length>200);
 for(const t of s.map.tiles){const loaded=parsed.mapData.tiles[t.r][t.q];assert.equal(loaded.type,t.type);assert.equal(loaded.riverConnections,t.riverConnections);
  for(const p of riverNeighbors(t.q,t.r,t.riverConnections??0)){assert.ok(bounds(p.q,p.r));assert.notEqual(t.type,'mountain');assert.ok(riverNeighbors(p.q,p.r,tile(p.q,p.r).riverConnections??0).some(n=>key(n)===key(t)));}
 }
});
