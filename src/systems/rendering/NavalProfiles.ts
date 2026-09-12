import type { AmbientProfile, ArtPart, Joint, Point } from './AmbientProfiles';

// Coordinates follow the exposed shafts in each ship's original artwork.
// Cut out only the oars outside the gunwale, keeping the hull intact.
function oar(root: Point, tip: Point): ArtPart {
  const [x,y]=root,[tx,ty]=tip;
  const length=Math.hypot(tx-x,ty-y),nx=-(ty-y)/length,ny=(tx-x)/length;
  return {
    feature:'exposed oar shaft and blade pivoting at the gunwale',
    polygon:[[x+nx*.006,y+ny*.006],[tx+nx*.009,ty+ny*.009],
      [tx-nx*.009,ty-ny*.009],[x-nx*.006,y-ny*.006]],
    pivot:root,angle:.24,rhythm:'row',phase:0,
  };
}
const triremeOars: [Point,Point][] = [
  [[.258,.639],[.187,.712]],[[.302,.674],[.221,.753]],
  [[.346,.704],[.287,.779]],[[.393,.733],[.367,.805]],
  [[.441,.760],[.441,.833]],[[.492,.789],[.506,.859]],
  [[.544,.810],[.570,.875]],[[.594,.829],[.665,.883]],
];
const galleyOars: [Point,Point][] = [
  [[.221,.611],[.118,.696]],[[.268,.642],[.172,.735]],
  [[.326,.666],[.231,.762]],[[.379,.690],[.286,.792]],
  [[.439,.710],[.342,.822]],[[.505,.735],[.404,.850]],
  [[.566,.753],[.460,.872]],[[.628,.773],[.517,.894]],
];
function bowman(x: number,y: number): ArtPart {
  return {
    feature:'deck archer arms and bow drawing and releasing above the rail',
    polygon:[[x-.030,y-.025],[x+.011,y-.027],[x+.025,y-.068],
      [x+.045,y-.076],[x+.058,y-.039],[x+.076,y-.027],
      [x+.076,y-.010],[x+.048,y-.006],[x+.038,y+.029],
      [x+.020,y+.028],[x+.023,y+.006],[x-.030,y+.009]],
    pivot:[x-.022,y],angle:-.15,dx:.006,rhythm:'draw',
    repairs:[{polygon:[[x-.030,y-.025],[x+.011,y-.025],[x+.011,y+.01],[x-.030,y+.01]],offset:[0,.022]}],
  };
}
const archers: Point[] = [[.331,.457],[.426,.499],[.526,.538],[.641,.578],[.749,.608]];
function sail(x: number,y: number,radius: number,dx=.024): Joint {
  return {x,y,radius,dx,dy:.008,rhythm:'wind'};
}
function sailing(joints: Joint[],waterline: number): AmbientProfile {
  return {effects:[{kind:'water',x:.51,y:waterline,size:.65}],float:.008,joints,
    note:'Wind billows the painted sail panels; local cloth motion fades out before the hull and mast anchors.'};
}
export const NAVAL_PROFILES: Record<string,AmbientProfile> = {
  trireme:{effects:[{kind:'water',x:.51,y:.77,size:.65}],float:.008,
    parts:triremeOars.map(([root,tip])=>oar(root,tip)),
    note:'Exposed oars row in unison at the gunwale while the vessel gently heaves.'},
  archer_galley:{effects:[{kind:'water',x:.51,y:.78,size:.65}],float:.008,
    parts:[...galleyOars.map(([root,tip])=>oar(root,tip)),...archers.map(([x,y])=>bowman(x,y))],
    shots:archers.map(([x,y],i)=>({kind:'arrow',part:galleyOars.length+i,
      muzzle:[x+.072,y-.019],direction:[.55,-.13]})),
    note:'Synchronized rowing below the gunwale; deck archers draw and release visible arrows in staggered cycles.'},
  caravel:sailing([sail(.371,.14,.115),sail(.513,.075,.080),sail(.376,.437,.155),
    sail(.685,.231,.115),sail(.675,.570,.158)],.82),
  frigate:sailing([sail(.577,.262,.108),sail(.373,.390,.100),sail(.466,.485,.105),
    sail(.364,.647,.112),sail(.611,.565,.098)],.83),
  privateer:sailing([sail(.515,.329,.130),sail(.512,.563,.185),sail(.238,.665,.115)],.82),
  galleass:sailing([sail(.604,.259,.092),sail(.446,.346,.092),sail(.615,.431,.100),
    sail(.457,.522,.100),sail(.307,.529,.067)],.80),
};
