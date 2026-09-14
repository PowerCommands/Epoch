/** Rebuild the single World scenario: node --import tsx scripts/generateWorldScenario.ts.
 * Hand-simplified coastlines in longitude/latitude; no downloaded data required.
 */
import fs from 'node:fs';
import { getNationDefinitionById } from '../src/data/nations';
import { getLeadersByNationId } from '../src/data/leaders';
import { getNaturalResourceById } from '../src/data/naturalResources';
import { connectRiver, riverLine, RIVER_DIRECTIONS } from '../src/systems/geography/Rivers';
import type { ScenarioData } from '../src/types/scenario';
import type { TileType } from '../src/types/map';
import type { GeographicMarkerCategory } from '../src/types/geographicMarker';

type Point = [number, number];
const width = 150, height = 100;
// Undo axial shear and fit the globe to a landscape canvas. Longitude and
// latitude scales give recognizable continent proportions in the flat view.
const geo = (q: number, r: number): Point => [(q + r / 2 - 95) / .34, (50 - r) / .48];
const hex = ([lon, lat]: Point) => { const r = Math.round(50 - lat * .48); return { q: Math.round(95 + lon * .34 - r / 2), r }; };
const inside = ([x,y]: Point, polygon: Point[]) => {
 let yes=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
  const [a,b]=polygon[i],[c,d]=polygon[j];
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;
 }
 return yes;
};
const continents: Record<string, Point[][]> = {
 northAmerica: [[[-168,71],[-151,72],[-140,69],[-130,70],[-115,73],[-98,73],[-82,70],[-65,60],[-56,52],[-66,45],[-75,40],[-80,32],[-80,25],[-84,25],[-85,30],[-96,28],[-97,23],[-88,21],[-86,16],[-82,10],[-77,8],[-78,6],[-84,9],[-91,15],[-103,20],[-110,24],[-116,30],[-124,41],[-125,50],[-135,57],[-148,60],[-162,55],[-168,59],[-158,64],[-168,66]],
 [[-96,80],[-78,83],[-65,77],[-79,71],[-95,74]],
 [[-85,22],[-76,22],[-73,20],[-81,20]], [[-73,19],[-67,19],[-67,17],[-73,17]]],
 southAmerica: [[[-81,12],[-71,12],[-61,8],[-51,4],[-49,-1],[-35,-6],[-35,-12],[-39,-19],[-44,-23],[-50,-29],[-54,-35],[-62,-40],[-65,-48],[-68,-56],[-74,-52],[-75,-40],[-72,-30],[-70,-18],[-77,-9],[-81,-2]]],
 europe: [[[-10,36],[-10,43],[-3,44],[-5,48],[2,50],[7,54],[8,58],[5,59],[5,63],[13,68],[26,71],[37,69],[43,60],[40,49],[29,41],[24,37],[21,36],[19,40],[14,45],[17,40],[16,38],[12,42],[7,44],[3,42],[0,38]],
 // Britain widened westwards for usable island development; Channel remains open.
 [[-18,50],[-18,54],[-18,58],[-11,62],[-4,59],[-3,55],[1,53],[1,50]],
 [[-30,51],[-30,55],[-25,56],[-25,52]], [[-25,63],[-25,66],[-15,67],[-13,64]]],
 africa: [[[-17,15],[-17,22],[-10,30],[-6,36],[10,37],[23,33],[32,31],[34,25],[43,12],[51,12],[49,5],[42,-2],[40,-12],[35,-20],[32,-29],[27,-34],[18,-35],[12,-27],[11,-18],[8,-5],[9,3],[2,5],[-5,4],[-14,8]],
 [[43,-12],[49,-13],[50,-20],[45,-26],[43,-22]]],
 asia: [[[30,41],[40,49],[43,60],[37,69],[60,74],[90,77],[113,73],[140,72],[169,68],[177,64],[169,59],[161,60],[157,51],[151,47],[143,49],[141,54],[136,54],[135,44],[130,42],[129,35],[126,34],[124,39],[120,39],[122,31],[119,25],[111,21],[109,17],[109,11],[105,8],[102,13],[100,7],[104,1],[100,0],[97,8],[94,16],[89,22],[85,20],[81,14],[78,7],[75,9],[72,19],[67,24],[60,25],[57,21],[52,16],[44,12],[40,19],[35,29],[33,33],[26,36],[26,40]],
 // Japan broadened eastwards, with a clear Sea of Japan and Korea Strait.
 [[140,46],[150,45],[152,42],[148,40],[149,36],[145,33],[138,31],[132,32],[132,34],[137,37],[140,41]],
 [[80,10],[83,9],[83,6],[80,6]], [[120,25],[124,25],[124,21],[121,21]],
 [[119,18],[123,18],[126,8],[122,6],[120,11]],
 [[95,5],[100,2],[106,-5],[103,-6],[98,-1]], [[108,7],[118,7],[119,0],[114,-4],[108,-2]],
 [[105,-6],[116,-7],[116,-10],[107,-9]], [[119,1],[124,2],[125,-4],[120,-5]], [[126,-3],[131,-3],[132,-6],[127,-6]]],
 oceania: [[[113,-22],[114,-30],[116,-35],[129,-32],[137,-35],[145,-39],[151,-34],[154,-26],[151,-20],[145,-14],[143,-10],[138,-12],[136,-16],[130,-12],[123,-15],[120,-19]],
 [[131,-3],[141,-2],[151,-6],[149,-10],[139,-9],[134,-6]],
 [[144,-40],[149,-40],[149,-44],[145,-44]],
 [[171,-34],[177,-38],[176,-41],[172,-40]], [[172,-40],[175,-43],[168,-47],[165,-45]],
 [[176,-17],[179,-17],[179,-20],[176,-20]]],
 greenland: [[[-58,60],[-46,60],[-39,65],[-20,75],[-24,82],[-43,84],[-60,79],[-66,69]]],
};
let seed=14092026;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const tiles: ScenarioData['map']['tiles']=[];
const regionByTile=new Map<string,string>();
for(let r=0;r<height;r++)for(let q=0;q<width;q++) {
 const p=geo(q,r),[lon,lat]=p;
 const region=Object.keys(continents).find(k=>continents[k].some(poly=>inside(p,poly)));
 let type='ocean';
 if(region){
  regionByTile.set(`${q},${r}`,region);
  const desert=(region==='africa'&&lat>15&&lat<31)||(lon>35&&lon<65&&lat>15&&lat<36)||(lon>80&&lon<112&&lat>38&&lat<46)||(region==='oceania'&&lon<140&&lat<-20&&lat>-31)||(lon<-105&&lat>25&&lat<38)||(region==='africa'&&lat<-20&&lon<25);
  const mountain=(lon<-110&&lon>-140&&lat>35&&lat<61)||(region==='southAmerica'&&Math.abs(lon-(-75+Math.max(0,-lat)*.12))<4)||(lon>70&&lon<100&&lat>28&&lat<34)||(lon>6&&lon<17&&lat>45&&lat<48)||(lon>5&&lon<18&&lat>60&&lat<68)||(region==='africa'&&lon>35&&lon<40&&lat>1&&lat<13)||(lon>48&&lon<63&&lat>28&&lat<36)||(lon>58&&lon<64&&lat>50&&lat<67)||(region==='oceania'&&lon>146&&lat<-22);
  type=region==='greenland'||lat>73?'ice':mountain&&random()<.8?'mountain':desert?'desert':Math.abs(lat)<13?'jungle':lat>52?(random()<.78?'forest':'plains'):random()<.30?'forest':random()<.5?'plains':'meadow';
 }
 // Compact caps centred in axial columns: Globe navigation maps q to longitude
 // and r to latitude, so these sit at the visual poles without a huge ice belt.
 if(((q-74.5)/20)**2+((r-3)/3.5)**2<1||((q-74.5)/25)**2+((r-96)/3.5)**2<1)type='ice';
 tiles.push({q,r,type});
}
const tile=(q:number,r:number)=>q>=0&&q<width&&r>=0&&r<height?tiles[r*width+q]:undefined;
const water=(t:typeof tiles[number]|undefined)=>!!t&&['ocean','coast'].includes(t.type);
const neighbors=(t:{q:number;r:number})=>RIVER_DIRECTIONS.map(([dq,dr])=>tile(t.q+dq,t.r+dr)).filter(t=>!!t);
const distance=(a:{q:number;r:number},b:{q:number;r:number})=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
// Hudson Bay, Mediterranean/Black/Caspian Seas and the Great Lakes.
const inlandWaters: Point[][]=[
 [[-94,60],[-91,65],[-79,64],[-77,57],[-83,52],[-89,56]],
 [[-5,36],[1,40],[7,43],[12,39],[20,35],[28,36],[34,32],[23,32],[10,35]],
 [[28,41],[33,45],[40,46],[42,42],[36,41]],
 [[48,47],[53,47],[54,38],[50,36],[48,42]],
 [[-92,48],[-84,49],[-78,44],[-83,42],[-88,44]],
];
for(const t of tiles)if(inlandWaters.some(p=>inside(geo(t.q,t.r),p)))t.type='ocean';
// One full hex of water in the Channel/North Sea prevents Britain joining France.
for(const t of tiles){const [lon,lat]=geo(t.q,t.r);if((lat>49&&lat<51&&lon>-16&&lon<5)||(lat>=51&&lat<58&&lon>1&&lon<6))t.type='ocean';}
for(const t of tiles)if(t.type==='ocean'&&neighbors(t).some(n=>!water(n)))t.type='coast';
for(const t of tiles){
 const [lon,lat]=geo(t.q,t.r);
 if(!water(t)&&!['ice','mountain'].includes(t.type)&&Math.abs(lat)<56&&neighbors(t).some(water)&&random()<.3)t.type='beach';
}
const starts: [string,string,Point,string][]=[
 ['usa','leader_donald_j_trump',[-77,38.9],'Washington'],
 ['brazil','leader_jair_bolsonaro',[-47.9,-15.8],'Brasília'],
 ['england','leader_boris_johnson',[-.1,51.5],'London'],
 ['germany','leader_angela_merkel',[13.4,52.5],'Berlin'],
 ['nigeria','leader_bola_tinubu',[7.5,9.1],'Abuja'],
 ['south_africa','leader_nelson_mandela',[28.2,-25.7],'Pretoria'],
 ['china','leader_mao_zedong',[116.4,39.9],'Beijing'],
 ['india','leader_narendra_modi',[77.2,28.6],'Delhi'],
 ['japan','leader_oda-nobunaga',[139.7,35.7],'Tokyo'],
 ['australia','leader_john_howard',[149.1,-35.3],'Canberra'],
];
const nations=starts.map(([id,leaderId,p],i)=>{
 const def=getNationDefinitionById('nation_'+id);
 if(!def||!getLeadersByNationId(def.id).some(l=>l.id===leaderId))throw Error(`Unknown nation/leader: ${id} / ${leaderId}`);
 const center=hex(p),t=tile(center.q,center.r)!;
 if(water(t))throw Error(`Start on water: ${id} ${JSON.stringify(center)}`);
 t.type='meadow';
 // Keep existing land traversable at the start without bridging any straits.
 for(const n of neighbors(t))if(!water(n)&&n.type==='mountain')n.type='plains';
 return {id:def.id,name:def.name,color:def.color,secondaryColor:def.secondaryColor,isHuman:i===0,leaderId,startTerritoryCenter:center};
});
// Major river corridors. Routes end at their first coastal water tile. This
// preserves continuous reciprocal links without rivers running across oceans.
const rivers: [string,Point[]][]=[
 ['Mississippi',[[-94,47],[-91,43],[-90,38],[-91,33],[-90,29],[-89,27]]],
 ['Missouri',[[-112,46],[-104,47],[-99,43],[-95,40],[-90,38]]],
 ['St Lawrence',[[-80,44],[-75,45],[-70,48],[-62,49]]],
 ['Mackenzie',[[-121,60],[-125,65],[-135,69],[-138,72]]],
 ['Amazon',[[-74,-5],[-69,-4],[-62,-3],[-55,-2],[-49,-1],[-46,1]]],
 ['Paraná',[[-48,-18],[-52,-23],[-55,-27],[-59,-31],[-58,-35],[-55,-37]]],
 ['Orinoco',[[-67,3],[-69,7],[-65,8],[-60,9]]],
 ['Thames',[[-9,53],[-5,52],[-.1,51.5],[5,51]]],
 ['Rhine',[[9,47],[8,49],[7,51],[4,53],[2,54]]],
 ['Danube',[[10,48],[16,48],[20,45],[25,44],[30,45]]],
 ['Volga',[[34,57],[43,56],[49,53],[45,49],[49,46]]],
 ['Nile',[[31,-1],[31,7],[32,15],[31,22],[31,30],[31,33]]],
 ['Niger',[[-10,10],[-6,14],[-3,17],[1,15],[5,11],[7,7],[6,4],[6,1]]],
 ['Congo',[[27,-10],[25,-4],[22,1],[18,1],[16,-3],[12,-6],[9,-7]]],
 ['Zambezi',[[23,-12],[25,-17],[30,-16],[35,-18],[38,-20]]],
 ['Orange',[[29,-29],[24,-29],[19,-28],[16,-29],[13,-30]]],
 ['Tigris',[[40,38],[43,34],[47,30],[49,28]]],
 ['Indus',[[76,32],[72,33],[70,29],[68,25],[67,23]]],
 ['Ganges',[[78,29],[80,27],[85,25],[89,24],[91,22],[91,19]]],
 ['Yangtze',[[100,29],[105,28],[110,30],[116,30],[122,31],[125,31]]],
 ['Yellow River',[[102,36],[106,40],[111,40],[111,35],[116,36],[121,38]]],
 ['Mekong',[[98,27],[100,22],[102,18],[105,13],[106,10],[108,8]]],
 ['Ob',[[85,50],[80,57],[70,64],[73,70],[73,74]]],
 ['Yenisei',[[95,51],[92,58],[88,65],[84,71],[82,75]]],
 ['Lena',[[108,54],[115,60],[125,63],[128,70],[128,74]]],
 ['Amur',[[112,49],[121,52],[132,48],[138,51],[142,52]]],
 ['Tone',[[140,38],[140,36],[145,35]]],
 ['Murray–Darling',[[148,-28],[145,-31],[142,-34],[139,-35],[137,-37]]],
];
const grid={width,height,get:(q:number,r:number)=>tile(q,r)?.riverConnections,set:(q:number,r:number,mask:number)=>{tile(q,r)!.riverConnections=mask;}};
for(const [,points]of rivers){
 let finished=false;
 for(let i=1;i<points.length&&!finished;i++){
  const line=riverLine(hex(points[i-1]),hex(points[i]));
  for(let j=1;j<line.length;j++){
   const a=tile(line[j-1].q,line[j-1].r),b=tile(line[j].q,line[j].r);
   if(!a||!b||water(a)){finished=true;break;}
   // Carve a narrow valley through simplified mountain ridges.
   for(const t of [a,b])if(t.type==='mountain')t.type='plains';
   connectRiver(grid,a,b);
   if(water(b)){finished=true;break;}
  }
 }
}
// Region-weighted ordinary resources; intentionally much richer on productive
// land/coasts than in the open ocean. Archaeology is authored separately below.
for(const t of tiles){
 const [lon,lat]=geo(t.q,t.r),region=regionByTile.get(`${t.q},${t.r}`);
 if(nations.some(n=>distance(t,n.startTerritoryCenter)===0))continue;
 let ids:string[]=[];
 if(t.type==='ice')continue;
 if(water(t))ids=t.type==='coast'?['fish','fish','fish','crabs',...(Math.abs(lat)<30?['pearls']:['whales'])]:['fish','whales'];
 else {
  ids=['stone','iron','copper','aluminum'];
  if(t.type==='forest')ids.push('deer','deer','coal');
  if(t.type==='mountain')ids.push('silver','gems','coal','iron');
  if(t.type==='jungle')ids.push('bananas','bananas','spices','gems');
  if(['plains','meadow','beach'].includes(t.type))ids.push('cattle','wheat','sheep','horses');
  if(region==='asia'&&lon>65&&lat<40)ids.push('rice','rice','silk','spices');
  if(region==='africa'&&lat<15&&lat>-25)ids.push('ivory','gems');
  if(region==='oceania')ids.push('uranium','aluminum','iron','sheep');
  if(region==='northAmerica'&&lat>48||region==='africa'&&lat>10&&lat<20||lon>55&&lon<80&&lat>40&&lat<54)ids.push('uranium');
  if(Math.abs(lat)>25&&Math.abs(lat)<48)ids.push('wine','niter');
  if(t.type==='desert')ids.push('niter','horses');
 }
 const choices=ids.filter(id=>getNaturalResourceById(id)!.allowedTileTypes.includes(t.type as TileType));
 if(choices.length&&random()<(t.type==='ocean'?.022:t.type==='coast'?.23:.28))t.resourceId=choices[Math.floor(random()*choices.length)];
}
function place(id:string,p:Point,radius=4){
 const resource=getNaturalResourceById(id)!;
 const center=hex(p);
 const candidates=tiles.filter(t=>!t.resourceId&&distance(t,center)<=radius&&resource.allowedTileTypes.includes(t.type as TileType)&&!nations.some(n=>distance(t,n.startTerritoryCenter)===0));
 candidates.sort((a,b)=>distance(a,center)-distance(b,center));
 if(!candidates.length)throw Error(`No compatible ${id} near ${p}`);
 candidates[0].resourceId=id;
}
// Petroleum basins, industrial belts and major mining regions.
for(const p of [[48,28],[52,25],[45,32],[50,40],[68,59],[76,63],[-101,32],[-94,28],[-112,55],[-65,8],[6,5],[13,-8],[3,58],[113,-21],[55,22]] as Point[])for(const id of ['oil','natural_gas'])place(id,p);
for(const p of [[-80,38],[-105,43],[-2,54],[7,51],[22,50],[86,23],[112,37],[119,-24],[29,-26],[87,54],[-44,-20]] as Point[])for(const id of ['iron','coal'])place(id,p);
for(const p of [[-106,57],[67,48],[135,-27],[116,-29],[8,17],[17,-23],[29,-26]] as Point[])place('uranium',p);
// Each start has useful food, production and early strategic deposits reachable
// over land. Avoid placing support resources on another island across a strait.
function reachable(center:{q:number;r:number},radius:number){
 const seen=new Set<string>(),queue=[tile(center.q,center.r)!];
 for(let i=0;i<queue.length;i++)for(const t of neighbors(queue[i])){
  const key=`${t.q},${t.r}`;
  if(!seen.has(key)&&distance(t,center)<=radius&&!water(t)&&!['ice','mountain'].includes(t.type)){seen.add(key);queue.push(t);}
 }
 return queue;
}
for(const n of nations)for(const id of ['wheat','cattle','horses','iron','coal']){
 const nearby=reachable(n.startTerritoryCenter,6);
 if(nearby.some(t=>t.resourceId===id))continue;
 const res=getNaturalResourceById(id)!;
 const candidate=nearby.filter(t=>!t.resourceId&&distance(t,n.startTerritoryCenter)>0&&res.allowedTileTypes.includes(t.type as TileType)).sort((a,b)=>distance(a,n.startTerritoryCenter)-distance(b,n.startTerritoryCenter))[0];
 if(!candidate)throw Error(`Insufficient viable start resources: ${n.name} ${id}`);
 candidate.resourceId=id;
}
// Bears in the Arctic only; Antarctica remains geographically credible.
for(const [q,r] of [[62,3],[68,4],[75,2],[82,4],[88,3]] as Point[])place('polar_bear',geo(q,r),1);
for(const p of [[-45,76],[-80,78]] as Point[])place('polar_bear',p);
// Globally distributed common archaeology, with distinctly fewer valuable finds.
for(const region of ['northAmerica','southAmerica','europe','africa','asia','oceania']){
 const candidates=tiles.filter(t=>regionByTile.get(`${t.q},${t.r}`)===region&&!t.resourceId&&!nations.some(n=>distance(t,n.startTerritoryCenter)===0));
 for(const id of ['ancient_pottery','ancient_pottery','ancient_pottery','ancient_pottery','ancient_coins','ancient_coins','ancient_weapons','ancient_weapons','royal_relics']){
  const legal=candidates.filter(t=>!t.resourceId&&getNaturalResourceById(id)!.allowedTileTypes.includes(t.type as TileType));
  if(!legal.length)throw Error(`No archaeology site in ${region}`);
  legal[Math.floor(random()*legal.length)].resourceId=id;
 }
}
for(const p of [[31,26],[44,32],[23,38],[73,28],[-90,17],[-72,-13],[109,34],[131,-25]] as Point[])place('ancient_pottery',p);
for(const p of [[31,25],[44,33],[-72,-14],[109,34]] as Point[])place('ancient_treasure',p);
for(const p of [[-66,26],[-29,46],[18,-38],[61,-5],[119,2],[-100,-15]] as Point[])place('shipwreck',p,6);
const labels: [string,GeographicMarkerCategory,Point][]=[
 ['Pacific Ocean','ocean',[-135,5]],['Atlantic Ocean','ocean',[-30,12]],['Indian Ocean','ocean',[76,-25]],
 ['Arctic Ocean','ocean',[10,83]],['Southern Ocean','ocean',[10,-62]],
 ['Mediterranean Sea','sea',[15,35]],['Caribbean Sea','sea',[-72,16]],
 ['Sahara','desert',[10,23]],['Gobi','desert',[99,43]],['Australian Outback','desert',[130,-25]],
 ['Rocky Mountains','mountain_range',[-120,47]],['Andes','mountain_range',[-72,-22]],['Himalayas','mountain_range',[87,32]],
 ['Amazon Basin','region',[-61,-6]],['Siberia','region',[104,62]],['Antarctica','region',geo(75,96)],
];
const scenario:ScenarioData={
 meta:{name:'World',version:2,description:'Ten nations begin at true start locations on a resource-rich globe. Follow great rivers, explore remote continents and polar seas, and let world history grow from discovery, expansion and diplomacy.'},
 map:{width,height,tileSize:48,tiles},nations,cities:[],units:nations.map(n=>({nationId:n.id,unitTypeId:'settler',...n.startTerritoryCenter})),
 nationDetails:{},initialDiplomacy:[],historicalEvents:[],turningPointEventsConfigured:true,
 worldMarkers:labels.map(([name,category,p],i)=>{const h=hex(p);return {id:`world_geographic_${i}`,type:'geographic',name,category,x:h.q,y:h.r};}),
};
fs.writeFileSync('public/assets/maps/world.json',JSON.stringify(scenario,null,2)+'\n');
console.log(JSON.stringify({starts:nations.map((n,i)=>({nation:n.name,site:starts[i][3],...n.startTerritoryCenter,reachable:reachable(n.startTerritoryCenter,8).length})),resources:tiles.filter(t=>t.resourceId).length,riverTiles:tiles.filter(t=>t.riverConnections).length,terrain:tiles.reduce((c,t)=>(c[t.type]=(c[t.type]??0)+1,c),{} as Record<string,number>)},null,2));
