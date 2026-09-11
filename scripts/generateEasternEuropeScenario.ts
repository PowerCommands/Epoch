/** Offline, deterministic authoring tool. See docs/content/eastern-europe-scenario.md. */
import fs from 'node:fs';
import { getNationDefinitionById } from '../src/data/nations';
import { getDefaultLeaderByNationId } from '../src/data/leaders';
import { connectRiver, riverLine } from '../src/systems/geography/Rivers';
import type { ScenarioData } from '../src/types/scenario';

type Point = [number, number];
type Outline = { name: string; polygons: Point[][][] };
const outlines: Outline[] = JSON.parse(fs.readFileSync(new URL('./data/eastern-europe-outlines.json', import.meta.url), 'utf8'));
const width = 170, height = 70;
// North stays up on the axial grid. Wide longitude spacing gives small central
// European countries and the Danish straits enough tiles to remain legible.
export const geo = (q: number, r: number): Point => [(q + r / 2 - 23) / 2.7 - 14, 71.8 - r * .445];
export const hex = ([lon, lat]: Point) => {
  const r = Math.round((71.8 - lat) / .445);
  return { q: Math.round((lon + 14) * 2.7 + 23 - r / 2), r };
};
function inside([x, y]: Point, ring: Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [c, d] = ring[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) result = !result;
  }
  return result;
}
const polygons = outlines.flatMap(f => f.polygons.map(rings => ({
  name: f.name, rings,
  minX: Math.min(...rings[0].map(p => p[0])), maxX: Math.max(...rings[0].map(p => p[0])),
  minY: Math.min(...rings[0].map(p => p[1])), maxY: Math.max(...rings[0].map(p => p[1])),
})));
function country(p: Point): string | undefined {
  // Subunits appended last override their parent country. Crimea is assigned
  // to Ukraine; England alone is playable within the British Isles.
  const matches = polygons.filter(f => p[0] >= f.minX && p[0] <= f.maxX && p[1] >= f.minY && p[1] <= f.maxY
    && inside(p, f.rings[0]) && !f.rings.slice(1).some(ring => inside(p, ring)));
  return matches.at(-1)?.name;
}
const lakes: Point[][] = [
  [[12.3,58.5],[13.2,58.35],[13.7,58.8],[13.4,59.35],[12.5,59.4]], // Vänern
  [[14.4,57.8],[14.8,57.8],[14.95,58.6],[14.55,58.6]], // Vättern
  [[30.5,60],[31.5,60],[32.8,60.8],[32.7,61.6],[31.5,61.8],[30.4,61.2]], // Ladoga
  [[34.4,60.9],[35.8,61],[36.4,62.2],[35.3,62.8],[34.5,62.2]], // Onega
  [[27.3,57.9],[28,57.9],[28.2,58.9],[27.4,58.9]], // Peipus
  [[27.7,61.5],[28.4,61.6],[29,62.1],[28.5,62.3]], // Saimaa
  [[25.3,61.3],[25.7,61.3],[25.9,62.2],[25.5,62.2]], // Päijänne
  [[27.4,64.2],[28.3,64.2],[28.2,64.6],[27.4,64.6]], // Oulujärvi
];
const ridges: Point[][] = [
  [[5.5,58.8],[7.5,61],[9,63],[12.5,66],[17.5,69]], // Scandinavian mountains
  [[5.5,44.5],[6.7,45.5],[8,46.4],[10.5,46.8],[13.5,47.2],[15.5,47.5]], // Alps
  [[17,49.5],[20,49.4],[23.5,48],[25.5,47],[26,45.5],[23,45]], // Carpathians
  [[7.5,48],[8.3,49],[10,50.5],[12.5,50.2],[14.5,50.8],[16.5,50.2]],
  [[2.5,44.5],[3,46]], [[-4,43],[0,42.7],[2,42.5]],
  [[-3,54],[-2.3,55]], [[-5,56.5],[-3.5,58]],
];
function distance(p: Point, line: Point[]): number {
  return Math.min(...line.slice(1).map((b, i) => {
    const a = line[i], dx = (b[0] - a[0]) * .55, dy = b[1] - a[1];
    const px = (p[0] - a[0]) * .55, py = p[1] - a[1];
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - dx * t, py - dy * t);
  }));
}
let seed = 11092026;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const tiles: ScenarioData['map']['tiles'] = [];
const countries = new Map<string, string>();
const key = (p: {q: number; r: number}) => `${p.q},${p.r}`;
for (let r = 0; r < height; r++) for (let q = 0; q < width; q++) {
  const p = geo(q, r), [lon, lat] = p;
  const region = lakes.some(ring => inside(p, ring)) ? undefined : country(p);
  let type = 'ocean';
  if (region) {
    countries.set(`${q},${r}`, region);
    const ridge = Math.min(...ridges.map(line => distance(p, line)));
    const boreal = lat > 58, steppe = lat < 51 && lon > 26;
    const woodland = boreal ? .73 : steppe ? .12 : .32;
    type = ridge < .32 && random() < .85 ? 'mountain'
      : random() < woodland ? 'forest' : random() < .55 ? 'meadow' : 'plains';
  }
  tiles.push({q, r, type});
}
const tile = (q: number, r: number) => q >= 0 && q < width && r >= 0 && r < height ? tiles[r * width + q] : undefined;
const land = (q: number, r: number) => !!tile(q,r) && !['ocean','coast'].includes(tile(q,r)!.type);
// Tiny islands and narrow channels need deliberate sampling at this resolution.
// Place only named island interiors; water corrections preserve navigation.
for (const [region, points] of [
  ['Denmark', [[10.35,55.35],[11.6,55.55],[12.3,55.7],[11.8,54.8],[15,55.15]]],
  ['Sweden', [[18.5,57.5],[18.8,57.9],[16.7,56.7]]],
  ['Aland', [[20,60.2]]], ['England', [[-1.3,50.65]]],
] as [string, Point[]][]) for (const p of points) {
  const h = hex(p), t = tile(h.q,h.r)!;
  t.type = 'meadow'; countries.set(key(h),region);
}
// The Sound, Great Belt, Little Belt and Dover must not become hex land bridges.
const straits: Point[][] = [
 [[1.1,50.9],[1.7,51.1]],
 [[12.65,55.35],[12.7,55.8],[12.6,56.15]],
 [[10.9,54.9],[10.9,55.4],[10.95,55.9]],
 [[9.8,55.1],[9.85,55.5]],
];
for (const points of straits) for (let i=1;i<points.length;i++) for (const h of riverLine(hex(points[i-1]),hex(points[i]))) {
  tile(h.q,h.r)!.type='ocean'; countries.delete(key(h));
}
const starts: [string, string, string, Point][] = [
 ['england','boris_johnson','London',[-.13,51.51]],
 ['france','charles_de_gaulle','Paris',[2.35,48.86]],
 ['germany','angela_merkel','Berlin',[13.405,52.52]],
 ['poland','donald_tusk','Warsaw',[21.01,52.23]],
 ['sweden','olof_palme','Stockholm',[18.07,59.33]],
 ['finland','alexander_stubb','Helsinki',[24.94,60.17]],
 ['russia','vladimir_putin','Moscow',[37.62,55.75]],
 ['ukraine','volodymyr_zelenskyy','Kyiv',[30.52,50.45]],
 ['denmark','mette_frederiksen','Copenhagen',[12.57,55.68]],
];
const ownerFor: Record<string,string> = {England:'england',France:'france',Germany:'germany',Poland:'poland',Sweden:'sweden',Finland:'finland',Aland:'finland',Russia:'russia',Ukraine:'ukraine',Crimea:'ukraine',Denmark:'denmark'};
const nations = starts.map(([id, leader, , p], i) => {
  const def = getNationDefinitionById('nation_' + id)!;
  const target = hex(p);
  // Coastal capitals snap to the nearest tile in their own country, never fill
  // an inlet just to force a capital onto its raw rounded coordinate.
  const candidates = tiles.filter(t => ownerFor[countries.get(key(t)) ?? ''] === id);
  candidates.sort((a,b) => Math.hypot(a.q+a.r/2-target.q-target.r/2,(a.r-target.r)*.866)
    - Math.hypot(b.q+b.r/2-target.q-target.r/2,(b.r-target.r)*.866));
  const t = candidates[0];
  if (!t) throw Error(`No territory for ${id}`);
  t.type = 'meadow';
  const leaderId = 'leader_' + leader;
  return {id:def.id, name:def.name, color:def.color, secondaryColor:def.secondaryColor, isHuman:i===0,
    startTerritoryCenter:{q:t.q,r:t.r},
    ...(getDefaultLeaderByNationId(def.id)?.id === leaderId ? {} : {leaderId})};
});
for (const t of tiles) if (t.type === 'ocean') {
  for (let dr=-2;dr<=2;dr++) for (let dq=-2;dq<=2;dq++)
    if (Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))<=2 && land(t.q+dq,t.r+dr)) t.type='coast';
}
// Major drainage systems: Thames, Seine, Loire, Rhine, Elbe, Oder, Vistula,
// Danube, Dnieper, Don, Volga, Neva, Daugava, Dalälven, Torne and Kemijoki.
const rivers: Point[][] = [
 [[-2,51.7],[-1,51.6],[0,51.5],[.8,51.5]],
 [[4.7,47.5],[3.5,48.5],[2.35,48.86],[1.2,49.1],[.3,49.5]],
 [[4,45],[3.5,46],[2.5,47.3],[.5,47.4],[-1.5,47.3],[-2.2,47.25]],
 [[9,47],[7.6,47.6],[7.8,48.6],[8.2,49.8],[7,50.5],[6.6,51.6],[5.2,51.9],[4.2,51.9]],
 [[15.6,50.5],[14,50.1],[13.7,51],[12,52],[11.5,53],[9.7,53.6],[8.7,53.9]],
 [[18,49.8],[17,50.7],[15,51.8],[14.6,52.5],[14.4,53.5]],
 [[19,50],[20.6,50.6],[21.5,51.5],[21,52.3],[19,53.2],[18.7,54.3]],
 [[9,48],[12,49],[13.5,48.6],[16.4,48.2],[18.7,47.8],[19,46],[20.5,45],[22.7,44.7],[26,44.1],[28.8,45.2]],
 [[33,54.5],[30.4,53.8],[30.4,52.5],[30.5,50.5],[31.5,49.5],[33.5,49],[35.1,48.4],[35,47.5],[33.4,46.6],[32,46.5]],
 [[39,54],[39.5,52.8],[40.8,51.3],[42.8,49.5],[43.5,48.7],[41,47.5],[39.2,47.2]],
 [[33,57],[35.5,56.8],[37,56.8],[38.8,58],[40,57.7],[43,56.4],[46,56]],
 [[31.4,60],[30.7,59.8],[30.2,59.9]],
 [[29,55.6],[27,55.9],[25.5,56.5],[24.1,57]],
 [[14,61.4],[15,60.8],[16.5,60.5],[17.7,60.5]],
 [[20.2,68],[22,67],[23.7,66.2],[24.1,65.8]],
 [[27,67.5],[26,66.5],[25.5,65.8],[24.7,65.5]],
];
const grid = {width,height,get:(q:number,r:number)=>tile(q,r)?.riverConnections,
  set:(q:number,r:number,mask:number)=>{tile(q,r)!.riverConnections=mask;}};
for (const points of rivers) for (let i=1;i<points.length;i++) {
  const line=riverLine(hex(points[i-1]),hex(points[i]));
  for(let j=1;j<line.length;j++) {
    const a=line[j-1],b=line[j];
    if ([a,b].every(p=>tile(p.q,p.r)) && land(a.q,a.r) && land(b.q,b.r)) {
      for (const p of [a,b]) if (tile(p.q,p.r)!.type==='mountain') tile(p.q,p.r)!.type='plains';
      connectRiver(grid,a,b);
    }
  }
}
const cities = nations.map((n,i)=>({id:`city_${starts[i][0]}_capital`,name:starts[i][2],nationId:n.id,
  ...n.startTerritoryCenter,isCapital:true,originNationId:n.id,isOriginalCapital:true,isResidenceCapital:true,
  ownedTileCoords:tiles.filter(t=>land(t.q,t.r)&&'nation_'+ownerFor[countries.get(key(t))??'']===n.id).map(({q,r})=>({q,r}))}));
const scenario: ScenarioData = {
  meta:{name:'Eastern Europe',version:1,dominationLandPercent:50,description:'A geographic European sandbox: nine nations at their real capitals, with national borders, neutral neighbors, the British Isles, Scandinavia and the Baltic. Default starting development; the land-domination threshold is 50% to accommodate the painted borders.'},
  map:{width,height,tileSize:32,tiles},nations,cities,
  units:nations.map(n=>({nationId:n.id,unitTypeId:'settler',...n.startTerritoryCenter})),
  nationDetails:{},initialDiplomacy:[],historicalEvents:[],worldMarkers:[],turningPointEventsConfigured:true,
};
fs.writeFileSync('public/assets/maps/eastern-europe.json',JSON.stringify(scenario,null,2)+'\n');
console.log(cities.map(c=>({name:c.name,q:c.q,r:c.r,territory:c.ownedTileCoords.length})));
