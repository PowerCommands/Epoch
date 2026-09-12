/** Artwork coordinates are normalized, with (0,0) at the top-left of the PNG.
 * Deliberately explicit: stored goods and stone do not inherit a living idle.
 */
export type AmbientKind = 'resource' | 'improvement' | 'unit' | 'building' | 'wonder' | 'city';
export type Activity = 'smoke' | 'steam' | 'dust' | 'fire' | 'light' | 'beacon' | 'water' | 'birds' | 'people' | 'leaves' | 'sparks' | 'flag' | 'bubbles' | 'wheel' | 'clock' | 'propeller';
export interface Emitter { kind: Activity; x: number; y: number; size?: number; color?: number; period?: number; flicker?: number; }
export interface Joint { x: number; y: number; radius: number; dx: number; dy: number; angle?: number; rhythm?: 'wind' | 'work' | 'sea' | 'idle' | 'machine'; }
export interface Rotor { x: number; y: number; radius: number; blades: number; period: number; color: number; tips: [number, number][]; }
export type Point = [number, number];
/** Original-art cutout. Every pixel in a part receives the same rigid transform.
 * Repairs are restricted to explicitly painted surfaces behind the moving part. */
export interface ArtPart {
  feature: string; polygon: Point[]; pivot: Point; angle: number;
  rhythm: Joint['rhythm']; dx?: number; dy?: number;
  positive?: boolean;
  link?: { part: number; hand: Point; root: Point; elbow: Point; bone: 0 | 1 }; // Two fixed-length arm bones follow the tool grip.
  repairs?: { polygon: Point[]; offset: Point }[];
}
export interface AmbientProfile { effects: Emitter[]; joints?: Joint[]; rotors?: Rotor[]; parts?: ArtPart[]; float?: number; note?: string; }
const e = (kind: Activity, x: number, y: number, size = 1, color?: number, period?: number): Emitter => ({kind,x,y,size,color,period});
const j = (x: number, y: number, radius: number, dx: number, dy: number, rhythm: Joint['rhythm'] = 'idle'): Joint => ({x,y,radius,dx,dy,rhythm});
const p = (...effects: Emitter[]): AmbientProfile => ({effects});
const still: AmbientProfile = {effects: [], note: 'Inert material / stored goods: no self-propelled activity.'};
const foliage = (x: number, y: number, radius = .2): Joint => j(x,y,radius,.009,0,'wind');

export const RESOURCE_AMBIENT: Record<string, AmbientProfile> = {
  cattle: {effects: [], parts: [{feature:'horns, face and muzzle; neck hinge above the fixed forelegs',
    polygon:[[.145,.28],[.21,.36],[.32,.34],[.42,.35],[.52,.32],[.50,.42],[.43,.46],[.41,.58],[.375,.65],[.31,.65],[.285,.58],[.28,.48],[.22,.46],[.175,.415]],
    pivot:[.38,.40],angle:-.18,dy:.018,rhythm:'idle',
    repairs:[{polygon:[[.30,.35],[.50,.35],[.47,.56],[.34,.58]],offset:[-.08,0]}]}],
    note:'Horned head nods at the neck. Hooves, legs and ribcage are untouched.'},
  deer: {effects: [], joints: [j(.64,.24,.135,.014,-.009)]},
  horses: {effects: [], joints: [j(.73,.31,.12,.009,.012),j(.22,.45,.1,-.016,0)]},
  ivory: {effects: [], joints: [j(.23,.64,.12,.015,.005),j(.39,.38,.11,.008,0)]},
  sheep: {effects: [], joints: [j(.45,.73,.15,.008,.014),j(.66,.47,.14,-.008,.014),j(.3,.4,.13,.006,.012)]},
  crabs: {effects: [], joints: [j(.28,.22,.13,-.014,.013),j(.75,.23,.13,.01,-.014)]},
  fish: {effects: [e('water',.5,.7,.6)], joints: [j(.25,.68,.17,.018,.012,'sea')]},
  whales: {effects: [e('water',.52,.75,.8)], joints: [j(.23,.25,.15,.009,.018,'sea')]},
  wheat: {effects: [], joints: [foliage(.3,.35,.3),foliage(.62,.34,.3),foliage(.5,.62,.25)]},
  wine: {effects: [], joints: [foliage(.3,.4,.25),foliage(.6,.5,.3)]},
  natural_gas: p(e('fire',.5,.38,1.5,0x62bfff)),
  shipwreck: p(e('bubbles',.52,.63,.6)),
  aluminum: still, ancient_coins: still, ancient_pottery: still, ancient_treasure: still,
  ancient_weapons: still, bananas: still, coal: still, copper: still, gems: still, iron: still,
  niter: still, oil: still, pearls: still, rice: still, royal_relics: still, silk: still,
  silver: still, spices: still, stone: still, uranium: still,
};
export const IMPROVEMENT_AMBIENT: Record<string, AmbientProfile> = {
  farm: {effects: [], joints: [j(.28,.62,.13,.022,0,'wind'),j(.48,.74,.13,.022,0,'wind'),j(.61,.62,.11,.018,0,'wind')]},
  plantation: {effects: [], joints: [foliage(.52,.19,.095),foliage(.81,.39,.105),foliage(.29,.64,.14)]},
  lumber_mill: {effects: [e('dust',.51,.64,.55,0xc7aa76,8)], joints: [foliage(.25,.26,.17)]},
  mine: p(e('dust',.47,.68,.7,0xb4a38a,11)),
  pasture: {effects: [], joints: [j(.60,.65,.045,.01,.012),j(.28,.57,.045,0,.012)]},
  oil_well: {effects: [], parts:[{feature:'walking beam and horsehead above the fixed A-frame',
    polygon:[[.391,.16],[.704,.205],[.70,.145],[.728,.119],[.76,.125],[.79,.19],[.819,.31],[.814,.40],[.79,.428],[.764,.398],[.755,.29],[.384,.229]],
    pivot:[.545,.218],angle:.16,rhythm:'machine'}],note:'Rigid walking beam rocks on its bearing; foundation, tanks and A-frame stay fixed.'},
  fishing_boats: {effects: [e('water',.42,.75,.8),e('water',.73,.52,.5)],
    parts:[{feature:'foreground sailboat, including rigid mast and hull',polygon:[[.12,.07],[.25,.04],[.40,.12],[.47,.35],[.57,.56],[.56,.69],[.45,.76],[.27,.67],[.16,.51]],pivot:[.36,.62],angle:.013,dy:.01,rhythm:'sea'},
    {feature:'background fishing boat',polygon:[[.55,.035],[.84,.08],[.89,.19],[.84,.42],[.88,.46],[.74,.52],[.61,.45],[.53,.32]],pivot:[.72,.4],angle:.014,dy:.009,rhythm:'sea'}],note:'Two independent rigid boats; painted water and wakes remain behind.'},
  offshore_platform: p(e('water',.49,.78,.7),e('light',.56,.29,.65,0xff9a63)),
  archaeological_dig: p(e('dust',.48,.56,.45,0xcbbb99,13),e('dust',.62,.58,.35,0xcbbb99,19)),
  underwater_archaeological_site: p(e('bubbles',.55,.77,.65),e('water',.5,.8,.65),e('flag',.64,.16,.5,0xe9d9b9)),
};

export const BUILDING_AMBIENT: Record<string, AmbientProfile> = {
  airfield: p(e('light',.3,.74,.45,0xffd6a1,7),e('light',.68,.31,.45,0xffd6a1,7)),
  air_base: p(e('light',.3,.74,.5,0xffd6a1,7),e('light',.68,.31,.5,0xffd6a1,7),e('light',.47,.14,.5,0xff7661,9)),
  aqueduct: p(e('water',.64,.25,.35)), armory: p(e('people',.40,.71,.4)), arsenal: p(e('people',.55,.74,.55)),
  bank: p(e('people',.59,.76,.5)), 'barbarian-camp': p(e('fire',.62,.74,.65),e('smoke',.22,.23,.6)),
  barracks: p(e('people',.51,.56,.65)), bomb_shelter: p(e('light',.44,.63,.35,0xd8b882,15)),
  broadcast_tower: p(e('light',.51,.2,.4,0xff7359,8)), castle: p(e('birds',.48,.35,.6)),
  circus: p(e('flag',.49,.15,.65,0xd45338),e('people',.52,.83,.65)),
  coal_power_plant: p(e('smoke',.57,.19,1.05,0x706d64),e('smoke',.65,.24,.85,0x80786a)),
  colosseum: p(e('people',.52,.6,.85)), courthouse: p(e('people',.56,.77,.45)),
  csp: p(e('light',.5,.24,.75,0xffdb8e,11)), factory: p(e('smoke',.57,.137,.8),e('smoke',.645,.195,.65)),
  forge: p(e('fire',.43,.64,.55),e('sparks',.43,.64,.65),e('smoke',.43,.12,.6)),
  garden: p(e('leaves',.32,.49,.5),e('leaves',.65,.48,.45)),
  gas_power_plant: p(e('steam',.50,.15,.55),e('steam',.62,.24,.45)),
  granary: p(e('birds',.5,.48,.5)), grand_stadium: p(e('people',.45,.63,.9),e('flag',.39,.2,.4,0xecc972)),
  harbor: p(e('water',.49,.8,.55),e('water',.72,.65,.45)), hospital: p(e('light',.4,.54,.35,0xffdeb5,17)),
  hotel: p(e('light',.5,.65,.45,0xffda94,19)), hydro_plant: p(e('water',.41,.73,.65),e('steam',.43,.7,.5)),
  library: p(e('people',.49,.77,.45)), lighthouse: p(e('beacon',.5,.27,.7)), market: p(e('people',.5,.78,.7)),
  medical_lab: p(e('light',.45,.56,.4,0xbbdbe2,17)), military_academy: p(e('people',.53,.79,.55)),
  military_base: p(e('light',.5,.39,.4,0xc6d0ac,11),e('people',.46,.64,.45)), mint: p(e('people',.42,.70,.35)),
  monument: p(e('birds',.58,.42,.5)), museum: p(e('people',.53,.7,.55)),
  nuclear_plant: p(e('steam',.49,.30,1.05),e('steam',.63,.40,.8)),
  observatory: p(e('light',.5,.58,.3,0xc59663,23)),
  offshore_wind_farm: {effects: [e('water',.5,.79,.7)], rotors: [
    {x:.509,y:.246,radius:.22,blades:3,period:8,color:0xd0d8d6,tips:[[.477,.018],[.356,.346],[.667,.345]]},
    {x:.258,y:.481,radius:.21,blades:3,period:9,color:0xd0d8d6,tips:[[.211,.27],[.123,.58],[.407,.584]]},
    {x:.795,y:.518,radius:.2,blades:3,period:7.5,color:0xd0d8d6,tips:[[.749,.32],[.671,.637],[.942,.596]]}]},
  oil_power_plant: p(e('smoke',.49,.23,.75,0x93958e)), opera_house: p(e('people',.48,.74,.7),e('light',.45,.55,.4,0xffd49b,21)),
  police_station: p(e('light',.52,.57,.35,0xffd4a0,18)), public_school: p(e('people',.5,.79,.6)),
  recycling_center: p(e('steam',.68,.27,.45),e('people',.53,.76,.45)),
  research_lab: p(e('light',.53,.17,.3,0xd48375,13)), seaport: p(e('water',.51,.74,.85),e('light',.79,.57,.45,0xe9bb71,9),e('people',.32,.65,.6)),
  sewers: p(e('water',.43,.66,.6)), shrine: p(e('light',.59,.66,.4,0xffc482,17)),
  solar_panels: p(e('light',.72,.73,.25,0xa0c6b8,19)), solar_plant: p(e('light',.64,.61,.3,0xa0c6b8,19)),
  spaceship_factory: p(e('steam',.55,.47,.55),e('light',.53,.26,.35,0xd1c18b,13)),
  stable: p(e('people',.44,.7,.45)), stadium: p(e('people',.49,.49,.8),e('people',.57,.54,.6)),
  stock_exchange: p(e('people',.5,.78,.6)), stone_works: p(e('dust',.53,.65,.6,0xc3b59b,9)),
  temple: p({...e('fire',.503,.533,1.35),flicker:2.4},e('sparks',.503,.515,.75),e('fire',.258,.675,.38),e('fire',.756,.675,.38)), university: p(e('people',.53,.78,.6)), walls: p(e('birds',.5,.41,.4)),
  water_mill: p(e('water',.24,.69,.4),e('wheel',.335,.378,1)),
  wind_turbine: {effects: [], rotors: [{x:.492,y:.41,radius:.38,blades:3,period:7,color:0xd4d9d6,tips:[[.436,.04],[.266,.545],[.77,.61]]}]},
  windmill: {effects: [], rotors: [{x:.5,y:.422,radius:.29,blades:4,period:13,color:0x9e7c3f,tips:[[.354,.203],[.646,.203],[.646,.605],[.354,.605]]}]},
  workshop: p(e('dust',.45,.66,.55,0xc9aa77,7)),
  zoo: p(e('people',.5,.68,.65),e('birds',.56,.4,.5)), nuclear_silo: {effects:[],note:'Open hatch and stored missile; no operational lamp in the SVG.'},
};

/** Each landmark was reviewed independently; anchors follow the actual art.
 * The Colossus sprite has no sea pedestal, so its signature is passing birds.
 */
export const WONDER_AMBIENT: Record<string, AmbientProfile> = {
  pyramids: p(e('dust',.46,.79,1,0xd4bb87,16)),
  great_lighthouse: p(e('beacon',.503,.222,1.1)),
  colossus: p(e('birds',.69,.37,.85)),
  hanging_gardens: p(e('leaves',.39,.57,.55),e('leaves',.67,.46,.55),e('leaves',.51,.32,.4)),
  great_wall: p(e('people',.45,.54,.65),e('birds',.64,.24,.6)),
  oracle: p(e('birds',.58,.32,.6),e('people',.39,.65,.5)),
  stonehenge: p(e('birds',.51,.35,.7),e('leaves',.38,.77,.4)),
  'angkor-wat': p(e('water',.48,.78,.8),e('birds',.6,.27,.55)),
  'hagia-sophia': p(e('birds',.48,.25,.8),e('people',.53,.78,.45)),
  'machu-picchu': p(e('steam',.81,.47,.5),e('leaves',.4,.73,.5)),
  'forbidden-city': p(e('people',.47,.64,.75),e('people',.55,.71,.5)),
  'taj-mahal': p(e('water',.5,.85,.6),e('birds',.69,.32,.65)),
  eiffel_tower: p(e('light',.5,.34,.4,0xf1ce8b,23),e('light',.45,.62,.4,0xf1ce8b,23),e('light',.55,.62,.4,0xf1ce8b,23)),
  statue_of_liberty: p(e('fire',.463,.062,.3),e('birds',.66,.43,.6)),
  'big-ben': p(e('clock',.503,.347,1),e('light',.503,.347,.35,0xffe3ac,31)),
  'brandenburg-gate': p(e('people',.5,.68,.75)),
  'sydney-opera-house': p(e('water',.53,.66,.65),e('light',.57,.67,.4,0xffd59b,29)),
  'empire-state-building': p(e('light',.5,.24,.4,0xffe0b0,29),e('light',.47,.64,.35,0xffe0b0,19)),
  'panama-canal': p(e('water',.48,.62,.85),e('people',.73,.66,.5)),
  'hoover-dam': p(e('water',.53,.7,.9),e('steam',.49,.69,.7)),
};

export const CITY_AMBIENT: Record<string, AmbientProfile> = {
  default:p(e('people',.43,.73,.7),e('light',.67,.65,.35,0xe9b674,23)),
  ancient:p(e('people',.43,.73,.7),e('light',.67,.65,.35,0xe9b674,23)),
  classical:p(e('people',.45,.73,.7),e('light',.70,.64,.35,0xe9b674,23)),
  medieval:p(e('smoke',.47,.22,.42),e('light',.36,.66,.35,0xe8b574,23)),
  renaissance:p(e('people',.44,.73,.65),e('light',.70,.64,.4,0xeac289,23)),
  industrial:p(e('smoke',.60,.28,.9,0x999a91),e('smoke',.63,.25,.7),e('light',.34,.64,.4,0xffd19a,19)),
  modern:p(e('light',.32,.63,.45,0xffdeb7,23),e('light',.65,.71,.4,0xffdeb7,17),e('people',.48,.77,.6)),
  atomic:p(e('steam',.60,.27,.9),e('light',.35,.64,.4,0xf4d8a0,23)),
  information:p(e('light',.5,.39,.5,0xa2dce7,13),e('light',.31,.65,.45,0xc5e3ee,23),e('light',.65,.68,.45,0xc5e3ee,17)),
  future:p(e('light',.5,.28,.5,0x80dae6,17),e('light',.30,.62,.45,0xabead9,23),e('light',.69,.56,.45,0xabead9,19)),
};

/** Shared entries below are restricted to artwork with the same pose/model. */
export const UNIT_AMBIENT: Record<string, AmbientProfile> = {
  worker: {effects:[],parts:[{feature:'pickaxe and both gripping hands',
    polygon:[[.359,.603],[.62,.43],[.627,.4],[.66,.392],[.68,.40],[.735,.375],[.74,.424],[.678,.465],[.423,.665],[.265,.778],[.242,.799],[.30,.975],[.205,.90],[.157,.798],[.162,.735],[.205,.704],[.358,.602]],
    pivot:[.65,.412],angle:.24,rhythm:'work',positive:true,
    repairs:[{polygon:[[.39,.49],[.64,.44],[.62,.61],[.40,.68]],offset:[-.035,-.035]}]},
    {feature:'left upper arm, hinged at shoulder',polygon:[[.345,.305],[.42,.323],[.408,.435],[.405,.462],[.338,.463],[.321,.407]],
    pivot:[.376,.326],angle:0,rhythm:'work',link:{part:0,hand:[.392,.623],root:[.376,.326],elbow:[.37,.455],bone:0}},
    {feature:'left forearm, hinged at elbow',polygon:[[.338,.446],[.405,.446],[.418,.554],[.422,.599],[.411,.63],[.38,.64],[.351,.54]],
    pivot:[.37,.455],angle:0,rhythm:'work',link:{part:0,hand:[.392,.623],root:[.376,.326],elbow:[.37,.455],bone:1}}],
    note:'Pickaxe pivots at the right grip; two fixed-length left arm segments follow it. Head, torso, trousers and boots have no deformation.'},
  warrior:{effects:[],joints:[j(.59,.43,.11,.008,.002)],note:'Small adjustment of the round shield; spear and feet grounded.'},
  spearman:{effects:[],joints:[j(.63,.38,.10,.006,.002)],note:'Shield-side wrist adjustment, outside the legs.'},
  pikeman:{effects:[],joints:[j(.46,.43,.07,.005,.002)],note:'Gauntlet on upright pike; no bending the pole.'},
  swordsman:{effects:[],joints:[j(.41,.42,.08,.006,.003)],note:'Sword hand adjustment; silhouette grounded.'},
  longswordsman:{effects:[],joints:[j(.40,.42,.08,.006,.003)],note:'Sword-side wrist; boots and torso fixed.'},
  archer:{effects:[],joints:[j(.67,.43,.085,.011,.006)],note:'Extended bow hand, not head or legs.'},
  composite_bowman:{effects:[],joints:[j(.75,.48,.085,.009,.004)],note:'Extended bow grip in the dark archer artwork.'},
  crossbowman:{effects:[],joints:[j(.75,.48,.085,.009,.004)],note:'Same shipped bow-archer artwork as composite bowman.'},
  scout:{effects:[],joints:[j(.41,.4,.075,.006,.003)],note:'Hands inspecting the painted compass.'},
  settler:{effects:[],joints:[j(.61,.45,.07,.005,.003)],note:'Hand at belt, fixed pack and legs.'},
  archaeologist:{effects:[],joints:[j(.71,.6,.065,.006,.002)],note:'Gloved hand, fixed hat and grounded boots.'},
  horseman:{effects:[],joints:[j(.30,.43,.105,.008,.012)],note:'Horse muzzle in left-facing mount; rider unchanged.'},
  knight:{effects:[],joints:[j(.30,.43,.105,.008,.012)],note:'Same left-facing mount art; no rider deformation.'},
  cavalry:{effects:[],joints:[j(.71,.46,.10,.009,.013)],note:'Right-facing horse head; reins and rider remain coherent.'},
  caravan:{effects:[],joints:[j(.20,.58,.09,.009,.01)],note:'Left ox muzzle; wagon, wheels and cargo stay rigid.'},
  chariot_archer:{effects:[],joints:[j(.64,.29,.07,.005,.003)],note:'No horse is painted: only the archer hand adjusts above the fixed chariot.'},
  lancer:{effects:[],joints:[j(.62,.48,.065,.006,.003)],note:'Standing armored soldier, hand on horizontal polearm; no horse.'},
  rifleman:{effects:[],joints:[j(.52,.42,.065,.006,.003)],note:'Hand on rifle stock; weapon not bent.'},
  paratrooper:{effects:[],joints:[j(.58,.42,.065,.005,.003)],note:'Supporting hand at rifle grip, boots anchored.'},
  infantry:{effects:[],joints:[j(.56,.59,.06,.004,.003)],note:'Front soldier glove only; other soldiers remain fixed.'},
  partisans:{effects:[],joints:[j(.52,.63,.055,.004,.003)],note:'Central rifle grip; three-person group never warped as one body.'},
  rebels:{effects:[],joints:[j(.53,.60,.055,.004,.003)],note:'Central hand on the separate rebel group artwork.'},
  tank:p(e('smoke',.71,.62,.25,0xb2ada0,17)),
  modern_armor:p(e('smoke',.76,.44,.25,0xb2ada0,17)),
  landship:p(e('smoke',.30,.38,.25,0xb2ada0,17)),
  mobile_sam:p(e('light',.55,.63,.25,0xc89b69,19)),
  giant_death_robot:p(e('light',.53,.24,.3,0xbdd6ce,17)),
  fighter:p(e('propeller',.33,.59,.6)),
  great_war_bomber:p(e('propeller',.32,.65,.55),e('propeller',.43,.49,.4)),
  triplane:p(e('propeller',.49,.72,.65)),
  bomber:p(e('propeller',.32,.68,.45),e('propeller',.54,.50,.45)),
  jet_fighter:p(e('light',.77,.50,.25,0xe4907c,11)),
  helicopter_gunship:p(e('propeller',.49,.32,1.3)),
};
function units(ids: string, profile: AmbientProfile): void { for (const id of ids.split(' ')) UNIT_AMBIENT[id] = profile; }
units('anti_tank_gun bazooka',{effects:[],joints:[j(.51,.40,.06,.004,.003)],note:'Same soldier holding a shoulder launcher; grip-only adjustment.'});
units('musketman great_war_infantry mechanized_infantry xcom_squad',{effects:[],joints:[j(.42,.52,.045,.005,.003),j(.63,.54,.045,-.005,.003)],note:'Shipped formation artwork: two individual weapon hands, fixed legs and formation.'});
units('cannon catapult trebuchet artillery anti_aircraft_gun gatling_gun machine_gun rocket_artillery',{
  effects:[],note:'Uncrewed equipment at rest. No painted crew or running engine; barrels, frames and wheels remain solid.'});
for(const [id,y] of Object.entries({trireme:.77,archer_galley:.78,galleass:.80,caravel:.82,frigate:.83,privateer:.82,ironclad:.76,battleship:.77,destroyer:.77,carrier:.78,missile_cruiser:.77,submarine:.73,nuclear_submarine:.74,cargo_ship:.8,transport_ship:.8,scout_boat:.76,work_boat:.76,workboat:.76})){
  UNIT_AMBIENT[id]={effects:[e('water',.51,y,.65)],float:.008,note:'Rigid vessel heave: identical translation of every hull/mast pixel; no bending. Ripple at painted waterline.'};
}
units('worker_action worker_action_improvement workboat_action work_boat_action_improvement',{
  effects:[],note:'These files depict construction signs, not workers/boats. Keep the sign stationary.'});
units('agent spy stealth_bomber atomic_bomb guided_missile nuclear_missile leaders', {effects: [], note: 'Covert portraits, parked stealth airframe, stored ordnance and UI symbol remain still.'});

export const AMBIENT_PROFILES: Record<AmbientKind, Record<string, AmbientProfile>> = {
  resource: RESOURCE_AMBIENT, improvement: IMPROVEMENT_AMBIENT, unit: UNIT_AMBIENT,
  building: BUILDING_AMBIENT, wonder: WONDER_AMBIENT, city: CITY_AMBIENT,
};
export function ambientSeed(key: string): number {
  let h = 2166136261;
  for (let i=0;i<key.length;i++) h = Math.imul(h ^ key.charCodeAt(i),16777619);
  h = Math.imul(h ^ h >>> 16, 0x45d9f3b);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
/** Rest occupies most of an organic cycle. Independent cycle hashes vary both
 * the interval and the gesture, without touching the simulation RNG. */
export function ambientMotion(t: number, seed: number, rhythm: Joint['rhythm']): number {
  if (rhythm === 'machine') return Math.sin(t*1.15+seed*23);
  if (rhythm === 'sea') return Math.sin(t*.91+seed*23)*.65 + Math.sin(t*.57+seed*11)*.35;
  if (rhythm === 'wind') return Math.sin(t*1.1+seed*23)*(.55+.25*Math.sin(t*.23+seed*41));
  const period = rhythm === 'work' ? 5+seed*3 : 9+seed*11;
  const cycle = Math.floor(t/period+seed*13);
  const phase = (t/period+seed*13)-cycle;
  const active = rhythm === 'work' ? .62 : .28;
  if (phase > active) return 0;
  const variation = ambientSeed(`${seed}:${cycle}`);
  return Math.sin(phase/active*Math.PI)**2 * Math.sin(phase/active*Math.PI*(rhythm === 'work' ? 4 : 1)) * (.65+variation*.35);
}
