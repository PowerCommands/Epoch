import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { getLeaderById, getDefaultLeaderByNationId } from '../src/data/leaders';
import { RIVER_DIRECTIONS } from '../src/systems/geography/Rivers';
import { orderScenarios } from '../public/shared/scenario-order.js';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';
const s:ScenarioData=JSON.parse(fs.readFileSync('public/assets/maps/scandinavia.json','utf8'));
const key=(p:{q:number;r:number})=>`${p.q},${p.r}`;
const tile=(q:number,r:number)=>q>=0&&q<150&&r>=0&&r<75?s.map.tiles[r*150+q]:undefined;
const water=(q:number,r:number)=>!!tile(q,r)&&['ocean','coast'].includes(tile(q,r)!.type);
const walk=(q:number,r:number)=>!!tile(q,r)&&!['ocean','coast','mountain','ice'].includes(tile(q,r)!.type);
const dist=(a:{q:number;r:number},b:{q:number;r:number})=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
function flood(p:{q:number;r:number},allowed=walk){
 const seen=new Set([key(p)]),queue=[p];
 for(let i=0;i<queue.length;i++)for(const [dq,dr]of RIVER_DIRECTIONS){const next={q:queue[i].q+dq,r:queue[i].r+dr};if(!seen.has(key(next))&&allowed(next.q,next.r)){seen.add(key(next));queue.push(next);}}
 return seen;
}
test('one Scandinavia, fourth in default Game Setup order, with exactly six lone Settlers',()=>{
 const maps=JSON.parse(fs.readFileSync('public/assets/maps/manifest.json','utf8')).maps;
 assert.equal(maps.filter((m:any)=>m.label==='Scandinavia').length,1);
 assert.equal(orderScenarios(maps,{getItem:()=>null})[3].key,'map_scandinavia');
 assert.deepEqual([s.map.width,s.map.height],[150,75]);assert.equal(s.map.tiles.length,11250);assert.equal(new Set(s.map.tiles.map(key)).size,11250);
 assert.deepEqual(s.nations.map(n=>n.id),['sweden','denmark','finland','novgorod','lithuania','poland'].map(id=>'nation_'+id));
 assert.equal(s.units.length,6);assert.deepEqual(s.cities,[]);assert.deepEqual(s.nationDetails,{});assert.deepEqual(s.initialDiplomacy,[]);
 assert.equal(s.leaderConfiguration,undefined);
 assert.deepEqual(s.nations.map(n=>(n.leaderId?getLeaderById(n.leaderId):getDefaultLeaderByNationId(n.id))?.name),['Gustav Vasa','Christian IV','Alexander Stubb','Marfa Boretskaya','Vytautas the Great','Donald Tusk']);
 for(const n of s.nations){
  const p=n.startTerritoryCenter;
  assert.deepEqual(s.units.filter(u=>u.nationId===n.id),[{nationId:n.id,unitTypeId:'settler',...p}]);
  assert.ok(walk(p.q,p.r));
  assert.ok(s.map.tiles.filter(t=>walk(t.q,t.r)&&dist(t,p)<=2).length>=9,n.name+' first city');
  assert.ok(flood(p).size>=20,n.name+' expansion');
  assert.ok(Object.keys(n).every(k=>['id','name','color','secondaryColor','isHuman','startTerritoryCenter','leaderId'].includes(k)));
 }
 for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)assert.ok(dist(s.nations[i].startTerritoryCenter,s.nations[j].startTerritoryCenter)>6);
});
test('mainland is connected around Bothnia; Zealand remains an island; Baltic opens to the North Sea',()=>{
 const mainland=flood(s.nations[0].startTerritoryCenter);
 for(const n of s.nations.filter(n=>n.id!=='nation_denmark'))assert.ok(mainland.has(key(n.startTerritoryCenter)),n.name);
 const zealand=flood(s.nations[1].startTerritoryCenter);
 assert.ok(zealand.size>=20&&zealand.size<70,`Zealand size ${zealand.size}`);
 assert.ok(!mainland.has(key(s.nations[1].startTerritoryCenter)));
 const sea=flood({q:5,r:40},water);
 // Sample the North Sea, Kattegat, Baltic, Bothnia and Gulf of Finland.
 for(const [lon,lat] of [[7,57],[11.3,57],[16,55.5],[20,58],[22,64],[27,60]]){
  const r=Math.round((72-lat)/.28),q=Math.round((lon-3)*3.5+28-r/2);
  assert.ok(sea.has(`${q},${r}`),`navigable sea at ${lon},${lat}`);
 }
});
test('canonical loader preserves valid terrain, rivers and resources without authored advantages',()=>{
 const loaded=ScenarioLoader.parse(s);
 for(const t of s.map.tiles){
  const result=loaded.mapData.tiles[t.r][t.q];assert.equal(result.type,t.type);assert.equal(result.resourceId,t.resourceId);assert.equal(result.riverConnections,t.riverConnections);
  assert.equal(t.buildingId,undefined);assert.equal(t.improvementId,undefined);
  if(t.resourceId)assert.ok(getNaturalResourceById(t.resourceId)?.allowedTileTypes.includes(t.type as TileType));
 }
 for(const id of ['wheat','fish','horses','iron','niter','coal','oil','aluminum','uranium'])assert.ok(s.map.tiles.some(t=>t.resourceId===id),id);
 for(const n of s.nations)for(const id of ['horses','iron','coal'])assert.ok(s.map.tiles.some(t=>t.resourceId===id&&dist(t,n.startTerritoryCenter)<=14),`${n.name} nearby ${id}`);
 assert.equal(s.meta.startYear,4000);assert.equal(s.meta.startYearIsBC,true);assert.deepEqual(s.meta.timeProgression,{mode:'auto'});
});
