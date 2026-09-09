/** Reproducible, hand-authored Baltic geography. Run with node --import tsx scripts/generateScandinaviaScenario.ts. */
import fs from 'node:fs';
import { getNationDefinitionById } from '../src/data/nations';
import { NATURAL_RESOURCES } from '../src/data/naturalResources';
import { connectRiver, riverLine } from '../src/systems/geography/Rivers';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';

type Point = [number, number];
const width = 150, height = 75;
// Compensate for the axial grid's horizontal shear so north stays visually up.
const geo = (q: number, r: number): Point => [(q + r / 2 - 28) / 3.5 + 3, 72 - r * .28];
const hex = ([lon, lat]: Point) => { const r = Math.round((72 - lat) / .28); return { q: Math.round((lon - 3) * 3.5 + 28 - r / 2), r }; };
const inside = ([x,y]: Point, polygon: Point[]) => {
  let yes = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [a,b]=polygon[i], [c,d]=polygon[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) yes=!yes;
  }
  return yes;
};
// One continuous mainland: Norway -> Arctic -> Russia -> Poland/Jutland ->
// Baltic states -> Gulf of Finland -> Bothnia -> Sweden -> southern Norway.
const mainland: Point[] = [
 [5,58],[5.4,59],[4.8,59.6],[5.3,60.3],[4.8,61],[5.7,61.6],[5.2,62.2],
 [7,63],[8.4,63.6],[9.5,64],[10.5,64.8],[12,65.5],[12.5,66.2],[13.8,67],
 [15,67.7],[16,68.4],[18,69.1],[19,69.8],[22,70.5],[25,71.2],[28,71.1],[31,70],
 [34,70],[38,73],[65,74],[65,45],[-10,45],[-10,53.5],[7.5,53.5],
 [8.3,54.5],[8.1,55.5],[8.2,56.6],[9,57.1],[10.6,57.8],[10.6,57],
 [10,56.3],[10.7,56],[9.8,55.5],[9.7,54.5],[10.8,54.3],[12,54.4],[13.4,54.5],
 [14.3,53.9],[16,54.3],[18,54.8],[18.8,54.4],[20,54.9],[21,55.3],[21,56.3],
 [21.1,57.4],[22,57.8],[23,57.3],[24.2,57.1],[24.3,58.3],[23.5,58.5],
 [23.5,59.2],[25,59.5],[27,59.5],[28.2,59.8],[30.2,59.9],[29.4,60.4],
 [28,60.7],[27,60.5],[25,60.15],[23,59.85],[22,60],[21,60.5],[21.4,61.5],
 [21,62.5],[21.6,63.2],[23,63.9],[24.5,64.6],[25.3,65.1],[24.5,65.8],
 [23.5,65.9],[22,65.7],[21,65.2],[21,64.5],[20,63.8],[19,63.4],[18.4,62.6],
 [17.5,62.1],[17.2,61.2],[18.5,60.5],[18.8,59.8],[18.5,59.1],[17.3,58.6],
 [16.7,57.8],[16.5,56.7],[15.8,56.2],[14.5,56.1],[14.3,55.5],[13.3,55.35],
 [13.2,56],[12.4,56.5],[12,57.3],[11.6,58],[11.3,58.9],[10.7,59.2],
 [10.5,59.7],[10,59.1],[9,58.7],[8,58.2],[7,58],[6,58]
];
const islands: Point[][] = [
 // Zealand and Funen widened modestly; the Sound and Great Belt remain water.
 [[11,55],[11.7,54.9],[12.6,55.2],[12.65,55.9],[12.3,56.3],[11.3,56.2],[10.95,55.6]],
 [[10,55],[10.6,55.1],[10.65,55.65],[10.1,55.85],[9.95,55.4]],
 [[14.7,55],[15.2,55],[15.2,55.35],[14.7,55.35]],
 [[18,56.95],[18.7,57.1],[19.25,57.8],[19.1,58],[18.5,57.8],[18,57.3]],
 [[16.5,56.25],[16.8,56.2],[17.2,57.3],[16.95,57.4]],
 [[19.5,60],[20.4,60],[20.5,60.45],[19.7,60.5]],
 [[21.8,58.05],[22.7,58.05],[23.2,58.5],[22.3,58.7],[21.8,58.4]],
 [[22.2,58.8],[22.8,58.75],[23,59.1],[22.3,59.15]],
];
const lakes: Point[][] = [
 [[12.3,58.5],[13.2,58.35],[13.7,58.8],[13.4,59.35],[12.5,59.4]],
 [[14.4,57.8],[14.8,57.8],[14.95,58.6],[14.55,58.6]],
 [[30.5,60],[31.5,60],[32.8,60.8],[32.7,61.6],[31.5,61.8],[30.4,61.2]],
 [[34.4,60.9],[35.8,61],[36.4,62.2],[35.3,62.8],[34.5,62.2]],
 [[27.3,57.9],[28,57.9],[28.2,58.9],[27.4,58.9]],
 [[27,61.5],[28,61.4],[28.5,62],[27.7,62.3]],
];
let seed=9042026;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const tiles: ScenarioData['map']['tiles']=[];
for(let r=0;r<height;r++) for(let q=0;q<width;q++) {
 const p=geo(q,r),[lon,lat]=p;
 const land=(inside(p,mainland)||islands.some(poly=>inside(p,poly)))&&!lakes.some(poly=>inside(p,poly));
 let type='ocean';
 if(land){
  const ridge=lat<63 ? 7.5+(lat-59)*.55 : 9.7+(lat-63)*1.9;
  const mountains=lat>59&&lat<70.8&&Math.abs(lon-ridge)<1.4;
  type=mountains&&random()<.77?'mountain':random()<(lat>57?.69:.24)?'forest':random()<.6?'meadow':'plains';
 }
 tiles.push({q,r,type});
}
const tile=(q:number,r:number)=>q>=0&&q<width&&r>=0&&r<height?tiles[r*width+q]:undefined;
const land=(q:number,r:number)=>!!tile(q,r)&&!['coast','ocean'].includes(tile(q,r)!.type);
for(const t of tiles) if(t.type==='ocean') {
 for(let dr=-2;dr<=2;dr++) for(let dq=-2;dq<=2;dq++)
  if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))<=2&&land(t.q+dq,t.r+dr)) t.type='coast';
}
const starts: [string,Point,string?][]=[
 ['sweden',[18,59.3],'leader_gustav_vasa'],['denmark',[12.1,55.6]],
 ['finland',[24.8,60.4]],['novgorod',[31.3,58.5]],
 ['lithuania',[25.3,54.7]],['poland',[21,52.3],'leader_donald_tusk'],
];
const nations=starts.map(([id,p,leaderId],i)=>{
 const def=getNationDefinitionById('nation_'+id)!;
 const startTerritoryCenter=hex(p), t=tile(startTerritoryCenter.q,startTerritoryCenter.r)!;
 if(!land(t.q,t.r)) throw Error(`${id} start is water`);
 t.type='meadow';
 return {id:def.id,name:def.name,color:def.color,secondaryColor:def.secondaryColor,isHuman:i===0,startTerritoryCenter,...(leaderId?{leaderId}:{})};
});
// Existing reciprocal river encoding; simplified major drainage corridors.
const rivers: Point[][]=[
 [[14,61.4],[15,60.8],[16.5,60.5],[17.7,60.5]],
 [[18,67],[19,66],[20,65.5],[22,65.6]],
 [[25.6,67],[26,66],[25.5,65.5],[24.7,65.5]],
 [[28,62],[27,61.4],[26.6,60.6]],
 [[32,59.8],[31,59.3],[31.3,58.5],[31.5,58]],
 [[19,51.5],[21,52.3],[19,53.2],[18.7,54.3]],
 [[26.5,53.5],[25.3,54.7],[24,54.9],[23,55],[21.5,55.3]],
 [[11.5,62],[11.2,61],[11.1,60],[11,59.2]],
];
const grid={width,height,get:(q:number,r:number)=>tile(q,r)?.riverConnections,set:(q:number,r:number,mask:number)=>{tile(q,r)!.riverConnections=mask;}};
for(const points of rivers) for(let i=1;i<points.length;i++) {
 const line=riverLine(hex(points[i-1]),hex(points[i]));
 for(let j=1;j<line.length;j++) {
  const a=line[j-1],b=line[j];
  if([a,b].every(p=>land(p.q,p.r)&&tile(p.q,p.r)!.type!=='mountain'))connectRiver(grid,a,b);
 }
}
const ids=['wheat','cattle','horses','deer','timber','fish','crabs','iron','niter','coal','oil','aluminum','uranium','stone','copper','silver','gold'];
const resources=NATURAL_RESOURCES.filter(res=>ids.includes(res.id));
for(const t of tiles) {
 if(random()>.13)continue;
 const choices=resources.filter(res=>res.allowedTileTypes.includes(t.type as TileType));
 if(choices.length)t.resourceId=choices[Math.floor(random()*choices.length)].id;
}
// Guarantee public strategic deposits in each capital's wider expansion region.
// These are ordinary, unowned map resources, never a nation's starting inventory.
for(const n of nations) for(const id of ['horses','iron','coal']) {
 const p=n.startTerritoryCenter;
 const distance=(t:{q:number;r:number})=>Math.max(Math.abs(t.q-p.q),Math.abs(t.r-p.r),Math.abs(t.q+t.r-p.q-p.r));
 if(tiles.some(t=>t.resourceId===id&&distance(t)<=12))continue;
 const res=resources.find(res=>res.id===id)!;
 const candidates=tiles.filter(t=>!t.resourceId&&distance(t)>=3&&distance(t)<=12&&res.allowedTileTypes.includes(t.type as TileType));
 candidates.sort((a,b)=>distance(a)-distance(b));
 if(!candidates.length)throw Error(`No legal ${id} deposit near ${n.name}`);
 candidates[0].resourceId=id;
}
const scenario: ScenarioData={
 meta:{name:'Scandinavia',version:1,description:'Six nations begin around the Baltic Sea. Explore the Scandinavian forests and mountains, Finnish lakes, Danish straits and southern Baltic plains.',startYear:4000,startYearIsBC:true,timeProgression:{mode:'auto'}},
 map:{width,height,tileSize:32,tiles},nations,cities:[],
 units:nations.map(n=>({nationId:n.id,unitTypeId:'settler',...n.startTerritoryCenter})),
 nationDetails:{},initialDiplomacy:[],worldMarkers:[],historicalEvents:[],
};
fs.writeFileSync('public/assets/maps/scandinavia.json',JSON.stringify(scenario,null,2)+'\n');
console.log(nations.map(n=>({nation:n.name,...n.startTerritoryCenter})));
