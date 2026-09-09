import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { computeGameDate } from '../src/systems/GameDate';
import { resolveScenarioMeta } from '../src/data/scenarioMeta';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { RIVER_DIRECTIONS, riverNeighbors } from '../src/systems/geography/Rivers';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { getLeadersByNationId, getDefaultLeaderByNationId } from '../src/data/leaders';
import { orderScenarios } from '../public/shared/scenario-order.js';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';
const s: ScenarioData=JSON.parse(fs.readFileSync('public/assets/maps/middle-east.json','utf8'));
const expected=[['iran','ruhollah_khomeini','Tehran',3],['iraq','saddam_hussein','Baghdad',2],['egypt','abdel_fattah_el_sisi','Cairo',3],['israel','benjamin_netanyahu','Jerusalem',1],['turkey','recep_tayyip_erdogan','Ankara',3],['saudi_arabia','mohammed_bin_salman','Riyadh',3],['usa','donald_j_trump','Washington',1],['russia','vladimir_putin','Moscow',1]] as const;
const key=(p:{q:number;r:number})=>`${p.q},${p.r}`;
const tile=(q:number,r:number)=>s.map.tiles[r*125+q];
const inBounds=(q:number,r:number)=>q>=0&&q<125&&r>=0&&r<75;
const water=(q:number,r:number)=>['ocean','coast'].includes(tile(q,r).type);
function flood(start:{q:number;r:number},allowed:(q:number,r:number)=>boolean){const seen=new Set([key(start)]),queue=[start];for(let i=0;i<queue.length;i++)for(const[dq,dr]of RIVER_DIRECTIONS){const q=queue[i].q+dq,r=queue[i].r+dr,k=`${q},${r}`;if(inBounds(q,r)&&!seen.has(k)&&allowed(q,r)){seen.add(k);queue.push({q,r});}}return seen;}
test('Middle East is third by default and respects personal ordering',()=>{
 const entries=JSON.parse(fs.readFileSync('public/assets/maps/manifest.json','utf8')).maps;
 assert.equal(entries.find((e:any)=>e.key==='map_middle_east').order,3);
 assert.equal(orderScenarios(entries,{getItem:()=>null})[2].key,'map_middle_east');
 assert.equal(orderScenarios(entries,{getItem:()=>JSON.stringify(['map_world','map_middle_east'])})[1].key,'map_middle_east');
});
test('eight intended modern leaders, 17 correct cities and eight capital Settlers survive loading',()=>{
 const parsed=ScenarioLoader.parse(s);
 assert.equal(computeGameDate(resolveScenarioMeta(s.meta),1).year,2025);
 assert.deepEqual([s.map.width,s.map.height],[125,75]);assert.equal(s.nations.length,8);assert.equal(s.cities.length,17);assert.equal(s.units.length,8);
 assert.equal(new Set(s.cities.map(key)).size,17);
 for(const[id,leader,capital,count]of expected){
  const nation=parsed.nations.find(n=>n.id==='nation_'+id)!;assert.ok(nation);assert.equal(nation.leaderId ?? getDefaultLeaderByNationId(nation.id)?.id,'leader_'+leader);assert.ok(getLeadersByNationId(nation.id).some(l=>l.id==='leader_'+leader));
  const cities=parsed.cities.filter(c=>c.nationId===nation.id);assert.equal(cities.length,count);assert.deepEqual(cities.filter(c=>c.isCapital).map(c=>c.name),[capital]);
  const city=cities.find(c=>c.isCapital)!;assert.deepEqual(nation.startTerritoryCenter,{q:city.q,r:city.r});
  assert.deepEqual(parsed.units.filter(u=>u.nationId===nation.id),[{nationId:nation.id,unitTypeId:'settler',q:city.q,r:city.r}]);
  assert.ok(nation.researchedTechIds?.includes('biology'));
 }
 assert.deepEqual(s.initialDiplomacy,[]);assert.deepEqual(s.historicalEvents,[]);
});
test('connected canonical city territories, traversable regional capitals and detached external powers',()=>{
 const all=new Set<string>(),sizes:Record<string,number>={};
 for(const c of s.cities){const owned=new Set(c.ownedTileCoords!.map(key));assert.ok(owned.has(key(c)));assert.equal(flood(c,(q,r)=>owned.has(`${q},${r}`)).size,owned.size,c.name);for(const p of c.ownedTileCoords!){assert.ok(inBounds(p.q,p.r));assert.ok(!water(p.q,p.r));assert.ok(!all.has(key(p)));all.add(key(p));}sizes[c.nationId]=(sizes[c.nationId]??0)+owned.size;}
 for(const n of s.nations){const owned=new Set(s.cities.filter(c=>c.nationId===n.id).flatMap(c=>c.ownedTileCoords!.map(key)));assert.equal(flood(n.startTerritoryCenter,(q,r)=>owned.has(`${q},${r}`)).size,owned.size,n.name);}
 const walkable=(q:number,r:number)=>!water(q,r)&&tile(q,r).type!=='mountain';
 const mainland=flood(s.nations[0].startTerritoryCenter,walkable);
 for(const n of s.nations.slice(0,6))assert.ok(mainland.has(key(n.startTerritoryCenter)),n.name);
 for(const n of s.nations.slice(6)){const island=flood(n.startTerritoryCenter,(q,r)=>!water(q,r));assert.ok(island.size>=100&&island.size<200);assert.ok(!mainland.has(key(n.startTerritoryCenter)));assert.equal(island.size,sizes[n.id]);assert.ok(flood(n.startTerritoryCenter,walkable).size>=100);}
 assert.ok(sizes.nation_iran>sizes.nation_iraq*3);assert.ok(sizes.nation_saudi_arabia>sizes.nation_iraq*3);assert.ok(sizes.nation_israel<25);
 const land=s.map.tiles.filter(t=>!water(t.q,t.r)).length;assert.ok(land-all.size>500);
 for(const size of Object.values(sizes))assert.ok(size/land*100<s.meta.dominationLandPercent!);
});
test('all resources are legal and all river links survive the loader reciprocally',()=>{
 const parsed=ScenarioLoader.parse(s);assert.equal(s.map.tiles.length,9375);assert.equal(new Set(s.map.tiles.map(key)).size,9375);
 for(const t of s.map.tiles){assert.ok(inBounds(t.q,t.r));const loaded=parsed.mapData.tiles[t.r][t.q];assert.equal(loaded.type,t.type);assert.equal(loaded.resourceId,t.resourceId);assert.equal(loaded.riverConnections,t.riverConnections);
 if(t.resourceId)assert.ok(getNaturalResourceById(t.resourceId)?.allowedTileTypes.includes(t.type as TileType),`${t.resourceId} ${key(t)}`);
 if(t.riverConnections){assert.notEqual(t.type,'mountain');for(const p of riverNeighbors(t.q,t.r,t.riverConnections)){assert.ok(inBounds(p.q,p.r));assert.ok(riverNeighbors(p.q,p.r,tile(p.q,p.r).riverConnections??0).some(n=>key(n)===key(t)));if(water(t.q,t.r))assert.ok(!water(p.q,p.r));}}
 }
 for(const id of ['horses','iron','niter','coal','oil','natural_gas','aluminum','uranium'])assert.ok(s.map.tiles.some(t=>t.resourceId===id));
 assert.ok(s.map.tiles.filter(t=>t.riverConnections).length>50);
 for(const id of ['oil','natural_gas']){const count=s.map.tiles.filter(t=>t.resourceId===id).length;assert.ok(count>=10&&count<=16);}
 for(const n of s.nations){const coords=new Set(s.cities.filter(c=>c.nationId===n.id).flatMap(c=>c.ownedTileCoords!.map(key)));const resources=s.map.tiles.filter(t=>coords.has(key(t))&&t.resourceId).map(t=>t.resourceId);for(const id of ['wheat','stone','iron','wine'])assert.ok(resources.includes(id),`${n.name}: ${id}`);}
});
