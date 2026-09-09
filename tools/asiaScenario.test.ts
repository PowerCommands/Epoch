import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { RIVER_DIRECTIONS, riverNeighbors } from '../src/systems/geography/Rivers';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { getDefaultLeaderByNationId } from '../src/data/leaders';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';
const s: ScenarioData = JSON.parse(fs.readFileSync('public/assets/maps/asia.json', 'utf8'));
const key = (p: {q:number;r:number}) => `${p.q},${p.r}`;
const tile = (q:number,r:number) => q>=0&&q<150&&r>=0&&r<75 ? s.map.tiles[r*150+q] : undefined;
const land = (q:number,r:number) => !!tile(q,r)&&!['ocean','coast'].includes(tile(q,r)!.type);
const walk = (q:number,r:number) => land(q,r)&&!['mountain','ice'].includes(tile(q,r)!.type);
function flood(p:{q:number;r:number},allowed=land) {
 const seen=new Set([key(p)]),queue=[p];
 for(let i=0;i<queue.length;i++) for(const [dq,dr] of RIVER_DIRECTIONS){const q=queue[i].q+dq,r=queue[i].r+dr,k=`${q},${r}`;if(!seen.has(k)&&allowed(q,r)){seen.add(k);queue.push({q,r});}}
 return seen;
}
const expected = [
 ['china',84,37],['india',41,48],['japan',106,41],['mongolia',79,29],['taiwan',82,52],['russia',16,21],['thailand',56,64],['south_korea',94,41],['north_korea',92,36],
] as const;
test('Asia replaces the existing entry with nine default nations and lone capital Settlers',()=>{
 const maps=JSON.parse(fs.readFileSync('public/assets/maps/manifest.json','utf8')).maps;
 assert.equal(maps.filter((m:any)=>m.key==='map_asia').length,1);
 assert.equal(maps.filter((m:any)=>m.label==='Asia').length,1);
 assert.deepEqual([s.map.width,s.map.height],[150,75]);assert.equal(s.map.tiles.length,11250);
 assert.equal(new Set(s.map.tiles.map(key)).size,11250);
 assert.deepEqual(s.nations.map(n=>n.id),expected.map(([id])=>'nation_'+id));
 assert.equal(s.units.length,9);assert.deepEqual(s.cities,[]);
 assert.deepEqual(s.nationDetails,{});assert.deepEqual(s.initialDiplomacy,[]);assert.deepEqual(s.historicalEvents,[]);assert.deepEqual(s.worldMarkers,[]);
 assert.equal(s.leaderConfiguration,undefined);
 for(const [id,q,r] of expected){
  const n=s.nations.find(n=>n.id==='nation_'+id)!;
  assert.deepEqual(n.startTerritoryCenter,{q,r});assert.ok(getDefaultLeaderByNationId(n.id));
  assert.deepEqual(Object.keys(n).sort(),['id','name','color','secondaryColor','isHuman','startTerritoryCenter'].sort());
  assert.deepEqual(s.units.filter(u=>u.nationId===n.id),[{nationId:n.id,unitTypeId:'settler',q,r}]);
  assert.ok(walk(q,r));
  const usable=s.map.tiles.filter(t=>Math.max(Math.abs(t.q-q),Math.abs(t.r-r),Math.abs(t.q-q+t.r-r))<=2&&walk(t.q,t.r));
  assert.ok(usable.length>=7,`${id}: ${usable.length} workable capital tiles`);
 }
});
test('mainland expansion, Japanese islands, Taiwan Strait and connected oceans',()=>{
 const mainland=flood(s.nations[0].startTerritoryCenter,walk);
 for(const i of [1,3,5,6,7,8]) assert.ok(mainland.has(key(s.nations[i].startTerritoryCenter)));
 assert.ok(mainland.size>3000);
 const japan=flood(s.nations[2].startTerritoryCenter);
 const taiwan=flood(s.nations[4].startTerritoryCenter);
 assert.ok(japan.size>=45&&japan.size<200,`Japan: ${japan.size}`);
 assert.ok(taiwan.size>=12&&taiwan.size<40,`Taiwan: ${taiwan.size}`);
 for(const island of [japan,taiwan]) for(const k of island) assert.ok(!mainland.has(k));
 assert.ok(flood(s.nations[2].startTerritoryCenter,walk).size>=25);
 const sea=flood({q:149,r:74},(q,r)=>!!tile(q,r)&&!land(q,r));
 for(const i of [1,2,4,6,7,8]) {
  const p=s.nations[i].startTerritoryCenter;
  assert.ok(s.map.tiles.some(t=>sea.has(key(t))&&Math.max(Math.abs(t.q-p.q),Math.abs(t.r-p.r),Math.abs(t.q-p.q+t.r-p.r))<20));
 }
});
test('canonical loader preserves terrain, legal resources and reciprocal editor rivers',()=>{
 const parsed=ScenarioLoader.parse(s);
 for(const t of s.map.tiles){
  const loaded=parsed.mapData.tiles[t.r][t.q];assert.equal(loaded.type,t.type);assert.equal(loaded.resourceId,t.resourceId);assert.equal(loaded.riverConnections,t.riverConnections);
  assert.equal(t.buildingId,undefined);assert.equal(t.improvementId,undefined);
  if(t.resourceId)assert.ok(getNaturalResourceById(t.resourceId)?.allowedTileTypes.includes(t.type as TileType),`${t.resourceId} on ${t.type}`);
  if(t.riverConnections){assert.notEqual(t.type,'mountain');for(const n of riverNeighbors(t.q,t.r,t.riverConnections))assert.ok(riverNeighbors(n.q,n.r,tile(n.q,n.r)?.riverConnections??0).some(p=>key(p)===key(t)));}
 }
 for(const id of ['wheat','fish','horses','iron','niter','coal','oil','aluminum','uranium'])assert.ok(s.map.tiles.some(t=>t.resourceId===id),id);
 assert.ok(s.map.tiles.filter(t=>t.riverConnections).length>150);
});

test('Korean starts are on one peninsula with disjoint initial claims',()=>{
 const south=s.nations.find(n=>n.id==='nation_south_korea')!.startTerritoryCenter;
 const north=s.nations.find(n=>n.id==='nation_north_korea')!.startTerritoryCenter;
 assert.ok(north.r<south.r);
 const distance=Math.max(Math.abs(south.q-north.q),Math.abs(south.r-north.r),Math.abs(south.q-north.q+south.r-north.r));
 assert.ok(distance>=7);
 assert.ok(flood(north,walk).has(key(south)));
 const claims=new Set<string>();
 for(const n of s.nations){const p=n.startTerritoryCenter;for(const [dq,dr]of [[0,0],...RIVER_DIRECTIONS]){const k=`${p.q+dq},${p.r+dr}`;assert.ok(!claims.has(k));claims.add(k);}}
 assert.equal(s.meta.startYear,4000);assert.equal(s.meta.startYearIsBC,true);assert.equal(s.meta.timeProgression?.mode,'auto');
});
