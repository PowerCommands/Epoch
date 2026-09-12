import type { AmbientProfile, ArtPart, Point } from './AmbientProfiles';

export type WeaponRhythm = 'thrust' | 'slash' | 'draw' | 'recoil' | 'aim';
export interface WeaponShot { kind: 'arrow' | 'rifle' | 'rocket'; part: number; muzzle: Point; direction: Point; }
export const WEAPON_PERIOD = 2.6;
export const WEAPON_RELEASE = .45;
export function weaponPhase(t: number, seed: number): number {
  const phase=(t / WEAPON_PERIOD + seed) % 1;
  return phase<0?phase+1:phase;
}
const ease = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x*x*(3-2*x); };
export function weaponMotion(t: number, seed: number, rhythm: WeaponRhythm): number {
  const phase = weaponPhase(t, seed);
  const q = Math.abs(phase-WEAPON_RELEASE)<1e-10?WEAPON_RELEASE:phase;
  const kick = q < WEAPON_RELEASE ? 0 : (1-ease((q-WEAPON_RELEASE)/.19));
  if (rhythm === 'recoil') return q < WEAPON_RELEASE ? -.18*ease(q/.35) : kick;
  if (rhythm === 'aim') return ease(q/.32)*(1-ease((q-.66)/.30)) - kick*.07;
  // A readable preparation, fast strike/release and deliberate recovery.
  if (q < .34) return -.45*ease(q/.34);
  if (q < WEAPON_RELEASE) return -.45+1.45*ease((q-.34)/.11);
  return 1-ease((q-WEAPON_RELEASE)/.42);
}

function part(feature: string, polygon: Point[], pivot: Point, angle: number,
  rhythm: WeaponRhythm, dx = 0, dy = 0): ArtPart {
  return {feature,polygon,pivot,angle,rhythm,dx,dy};
}
function profile(parts: ArtPart[], shots: WeaponShot[] = []): AmbientProfile {
  return {effects:[],parts,shots,note:'Continuous weapon practice: visible preparation, attack and recovery every 2.6 seconds; original-art rigid parts and synchronized projectiles.'};
}
const shot = (kind: WeaponShot['kind'], muzzle: Point, direction: Point, part = 0): WeaponShot => ({kind,muzzle,direction,part});
const waist = (p: ArtPart, x: number, y: number, width: number): ArtPart => ({...p,
  repairs:[{polygon:[[x-width,y-.025],[x+width,y-.025],[x+width,y+.035],[x-width,y+.035]],offset:[0,-.035]}]});

const warrior = profile([part('spear and gripping forearm thrust from the elbow',
  [[.389,.14],[.432,.14],[.455,.235],[.432,.35],[.436,.43],[.479,.40],[.48,.49],[.439,.535],[.439,.823],[.401,.823],[.397,.54],[.382,.50]],
  [.443,.477],.48,'thrust',.018,-.018)]);
const spearman = profile([part('long spear and hand driving a diagonal thrust',
  [[.222,.012],[.260,.013],[.300,.197],[.319,.441],[.35,.462],[.347,.535],[.328,.554],[.365,.822],[.328,.836],[.291,.56],[.278,.517],[.278,.465],[.257,.233]],
  [.313,.510],.62,'thrust',.028,-.025)]);
const pikeman = profile([part('upright pike and gauntlet making a pronounced forward strike',
  [[.384,.012],[.412,.012],[.421,.386],[.442,.396],[.443,.46],[.421,.483],[.419,.84],[.39,.84],[.386,.48],[.373,.458],[.374,.408]],
  [.412,.43],.58,'thrust',.024,-.02)]);
const sword = profile([part('sword blade, gripping hand and sword arm swinging from the shoulder',
  [[.438,.292],[.462,.310],[.456,.366],[.446,.400],[.429,.430],[.423,.449],
    [.451,.465],[.450,.493],[.413,.504],[.395,.520],[.34,.584],[.29,.642],
    [.248,.676],[.205,.691],[.210,.666],[.272,.606],[.330,.538],[.370,.481],
    [.373,.447],[.399,.420],[.416,.394],[.412,.351]],
  [.445,.327],-.95,'slash')]);
sword.parts![0].angleOffset=.70;
sword.brightness=2;
sword.shadowLift=32;
sword.parts![0].repairs=[{polygon:[[.418,.316],[.452,.316],[.452,.407],[.418,.407]],offset:[-.035,0]}];
sword.note='Sword and weapon arm cut from the original art swing from the shoulder; head, chest, waist and feet stay still. Original lighting lifted for readable clothing and equipment.';
const lancer = profile([part('horizontal polearm and both gripping hands thrusting to the left',
  [[.111,.448],[.151,.441],[.232,.461],[.393,.461],[.441,.446],[.479,.467],[.504,.452],[.54,.466],[.551,.494],[.529,.522],[.477,.516],[.435,.499],[.156,.486],[.112,.474]],
  [.456,.48],.12,'thrust',-.10,-.012)]);
const archer = profile([waist(part('archer upper body, drawing hand and full bow releasing an arrow',
  [[.31,.244],[.362,.214],[.429,.227],[.435,.18],[.47,.124],[.52,.162],[.53,.245],[.587,.304],[.595,.095],[.621,.088],[.645,.179],[.676,.32],[.692,.391],[.721,.412],[.72,.438],[.686,.441],[.686,.531],[.648,.662],[.614,.669],[.643,.526],[.639,.456],[.593,.414],[.585,.506],[.532,.544],[.411,.539],[.398,.442],[.407,.338],[.347,.317],[.315,.28]],
  [.488,.535],.12,'draw',.024,0),.488,.535,.065)], [shot('arrow',[.704,.421],[1,.23])]);
const composite = profile([waist(part('bowman upper body and full bow drawing and releasing together',
  [[.296,.241],[.379,.217],[.421,.191],[.43,.115],[.477,.076],[.518,.103],[.542,.211],[.618,.262],[.692,.136],[.707,.049],[.734,.05],[.732,.124],[.776,.246],[.798,.368],[.795,.424],[.832,.434],[.852,.463],[.807,.465],[.798,.554],[.761,.671],[.728,.687],[.759,.542],[.758,.471],[.672,.445],[.597,.402],[.576,.519],[.518,.556],[.432,.54],[.401,.471],[.39,.349],[.32,.315]],
  [.49,.531],.13,'draw',.024,0),.49,.531,.062)], [shot('arrow',[.831,.453],[1,.24])]);
const chariot = profile([part('chariot archer torso, hands and bow releasing above the fixed carriage',
  [[.39,.18],[.465,.182],[.465,.153],[.497,.153],[.52,.181],[.532,.23],[.573,.26],[.582,.17],[.585,.134],[.604,.138],[.634,.257],[.634,.306],[.686,.314],[.683,.338],[.638,.329],[.628,.413],[.604,.467],[.583,.45],[.609,.35],[.564,.326],[.525,.348],[.53,.45],[.45,.447],[.445,.301],[.394,.259]],
  [.489,.415],.14,'draw',.016)], [shot('arrow',[.674,.323],[1,.20])]);
const rifleman = profile([waist(part('rifleman upper body, both arms and rifle recoiling together',
  [[.346,.346],[.409,.244],[.439,.234],[.431,.155],[.465,.103],[.528,.109],[.552,.153],[.534,.228],[.59,.27],[.635,.343],[.643,.386],[.751,.455],[.75,.494],[.708,.477],[.626,.438],[.621,.567],[.528,.609],[.432,.578],[.421,.456],[.35,.413]],
  [.51,.57],-.12,'recoil',-.028,-.018),.51,.57,.065)], [shot('rifle',[.741,.476],[.86,.51])]);
const paratrooper = profile([waist(part('paratrooper torso and rifle with a strong shoulder recoil',
  [[.30,.445],[.334,.296],[.388,.236],[.425,.23],[.434,.125],[.48,.08],[.542,.097],[.581,.18],[.571,.235],[.616,.277],[.644,.379],[.663,.452],[.654,.557],[.716,.62],[.699,.64],[.632,.574],[.578,.587],[.456,.61],[.401,.577],[.359,.535],[.30,.512]],
  [.486,.57],-.13,'recoil',-.024,-.023),.486,.57,.055)], [shot('rifle',[.704,.631],[.70,.71])]);
const launcher = profile([waist(part('launcher soldier upper body, gripping hands and complete rocket tube',
  [[.247,.133],[.285,.10],[.329,.128],[.423,.197],[.424,.124],[.459,.066],[.529,.057],[.581,.099],[.593,.171],[.561,.224],[.614,.27],[.648,.358],[.742,.417],[.775,.443],[.776,.494],[.747,.527],[.712,.511],[.636,.455],[.62,.596],[.536,.637],[.443,.606],[.399,.512],[.324,.437],[.315,.345],[.354,.268],[.261,.186]],
  [.509,.595],-.13,'recoil',-.027,-.022),.509,.595,.063)], [shot('rocket',[.755,.475],[.80,.60])]);

// In dense portraits, animate the foreground weapon and its hands instead of
// moving a rectangular crop of several overlapping soldiers.
function foregroundRifle(rebel: boolean): AmbientProfile {
  const result = profile([part('foreground rifle and both hands recoiling over the fixed uniform',
    rebel ? [[.326,.386],[.381,.423],[.433,.515],[.474,.548],[.521,.578],[.566,.653],[.586,.661],[.624,.623],[.661,.626],[.686,.675],[.644,.716],[.623,.748],[.669,.832],[.675,.872],[.659,.887],[.599,.803],[.55,.729],[.528,.708],[.496,.695],[.47,.627],[.442,.595],[.394,.594],[.371,.57],[.409,.543],[.354,.445]]
      : [[.312,.374],[.368,.415],[.411,.474],[.457,.51],[.483,.558],[.523,.603],[.574,.669],[.614,.67],[.64,.638],[.684,.644],[.703,.692],[.669,.725],[.637,.741],[.704,.85],[.725,.867],[.717,.902],[.687,.887],[.601,.788],[.55,.724],[.524,.717],[.498,.683],[.474,.615],[.439,.588],[.393,.592],[.372,.566],[.399,.532],[.357,.456]],
    [.445,.545],-.12,'recoil',-.025,-.024)],
    [shot('rifle',rebel?[.663,.867]:[.714,.885],[.60,.80])]);
  result.parts![0].repairs=[{polygon:[[.35,.40],[.51,.48],[.68,.84],[.57,.86],[.38,.61]],offset:[.09,-.015]}];
  return result;
}
const infantry = profile([part('front infantry rifle and gripping hands recoiling against the vest',
  [[.349,.539],[.383,.534],[.438,.59],[.458,.623],[.505,.655],[.556,.714],[.583,.75],[.625,.807],[.646,.81],[.673,.787],[.699,.802],[.708,.837],[.684,.863],[.651,.882],[.682,.946],[.707,.984],[.674,1],[.638,.963],[.572,.867],[.541,.814],[.492,.76],[.442,.747],[.409,.756],[.36,.714],[.373,.675],[.401,.66],[.37,.611]],
  [.45,.67],-.13,'recoil',-.03,-.028)], [shot('rifle',[.687,.982],[.55,.83])]);
infantry.parts![0].repairs=[
  {polygon:[[.37,.55],[.48,.62],[.61,.81],[.64,.95],[.54,.92],[.39,.72]],offset:[-.07,-.025]},
  {polygon:[[.61,.79],[.71,.79],[.71,.87],[.61,.89]],offset:[0,-.075]},
];

// Formation weapons are authored per visible rifle, with independent timing.
function formation(rifles: {hand: Point; muzzle: Point; upright?: boolean}[]): AmbientProfile {
  const parts: ArtPart[] = [], shots: WeaponShot[] = [];
  for (const {hand:[x,y],muzzle:[mx,my],upright} of rifles) {
    const vx=mx-x,vy=my-y,len=Math.hypot(vx,vy),nx=-vy/len*.012,ny=vx/len*.012;
    parts.push(part('individual formation rifle and gripping hands',
      [[x-vx*.32+nx*1.7,y-vy*.32+ny*1.7],[mx+nx,my+ny],[mx-nx,my-ny],[x-vx*.32-nx*1.7,y-vy*.32-ny*1.7]],
      [x,y],upright?1.05:-.16,upright?'aim':'recoil',upright?0:-.022,upright?0:-.014));
    parts[parts.length-1].repairs=[{polygon:[[x-.025,y-.025],[x+.025,y-.025],[x+.025,y+.03],[x-.025,y+.03]],offset:[-.027,0]}];
    shots.push(shot('rifle',[mx,my],[vx/len,vy/len],parts.length-1));
  }
  return profile(parts,shots);
}
const muskets = formation([
  {hand:[.145,.207],muzzle:[.151,.023],upright:true},
  {hand:[.391,.295],muzzle:[.398,.112],upright:true},
  {hand:[.638,.378],muzzle:[.652,.189],upright:true},
  {hand:[.878,.487],muzzle:[.907,.296],upright:true},
  {hand:[.147,.751],muzzle:[.152,.551],upright:true},
  {hand:[.526,.619],muzzle:[.548,.424],upright:true},
  {hand:[.415,.894],muzzle:[.437,.693],upright:true},
  {hand:[.786,.745],muzzle:[.813,.55],upright:true},
]);
const mechanized = formation([
  {hand:[.495,.281],muzzle:[.568,.31]}, {hand:[.334,.392],muzzle:[.386,.444]},
  {hand:[.678,.376],muzzle:[.743,.414]}, {hand:[.139,.483],muzzle:[.194,.529]},
  {hand:[.502,.473],muzzle:[.586,.518]}, {hand:[.88,.483],muzzle:[.952,.515]},
  {hand:[.297,.616],muzzle:[.365,.659]}, {hand:[.704,.604],muzzle:[.795,.659]},
  {hand:[.504,.751],muzzle:[.609,.827]},
]);
const xcom = formation([
  {hand:[.305,.357],muzzle:[.352,.419]}, {hand:[.508,.339],muzzle:[.573,.38]},
  {hand:[.611,.306],muzzle:[.639,.35]}, {hand:[.731,.357],muzzle:[.794,.406]},
  {hand:[.391,.536],muzzle:[.434,.575]}, {hand:[.603,.5],muzzle:[.671,.556]},
  {hand:[.515,.635],muzzle:[.575,.681]},
]);

// Broad transparent margins keep antialiased silhouette pixels with the body.
// The lower boundary follows the waist, leaving feet and legs grounded.
function upperBody(p: AmbientProfile, y: number, pivot: Point, angle?: number): void {
  const a=p.parts![0];a.polygon=[[0,0],[1,0],[1,y],[0,y]];a.pivot=pivot;
  if(angle!==undefined)a.angle=angle;
  a.repairs=[{polygon:[[pivot[0]-.07,y-.025],[pivot[0]+.07,y-.025],[pivot[0]+.07,y+.025],[pivot[0]-.07,y+.025]],offset:[0,-.04]}];
}
upperBody(rifleman,.59,[.50,.565]);
upperBody(paratrooper,.61,[.49,.585]);
upperBody(launcher,.625,[.51,.60]);
// Bow limbs extend below the belt into transparent space.
for(const p of [archer,composite]) {
  p.parts![0].polygon=[[0,0],[1,0],[1,.72],[.60,.72],[.60,.54],[0,.54]];
}
// Include the complete long spear tip and shaft, including its edge pixels.
spearman.parts![0].polygon=[[.215,0],[.27,0],[.304,.21],[.323,.44],[.365,.45],[.365,.545],[.337,.56],[.377,.85],[.32,.85],[.283,.56],[.264,.52],[.267,.46],[.243,.23]];

export const FOOT_SOLDIER_PROFILES: Record<string, AmbientProfile> = {
  warrior,spearman,pikeman,swordsman:sword,longswordsman:sword,lancer,
  archer,composite_bowman:composite,crossbowman:composite,chariot_archer:chariot,
  rifleman,paratrooper,infantry,partisans:foregroundRifle(false),rebels:foregroundRifle(true),
  musketman:muskets,great_war_infantry:muskets,mechanized_infantry:mechanized,xcom_squad:xcom,
  anti_tank_gun:launcher,bazooka:launcher,
};
