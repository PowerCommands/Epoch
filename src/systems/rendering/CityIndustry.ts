import type Phaser from 'phaser';
import type { CityPoint } from './OrganicCityArtwork';

/** An exposed horizontal steam engine drives a factory line shaft. Coordinates
 * share the baked factory yard, so the belt actually enters its front wall. */
export function drawCitySteamWorks(g: Phaser.GameObjects.Graphics, origin: CityPoint, size: number, time: number): void {
  g.save(); g.translateCanvas(origin.x,origin.y); g.scaleCanvas(size,size);
  const spin=time/560, radius=.064, wheel={x:.075,y:-.063}, pulley={x:.26,y:-.094};
  // Cast-iron bed, copper boiler, riveted seams, piston housing and firebox.
  g.fillStyle(0x182e32,1).fillRect(-.095,-.023,.22,.022);
  g.fillStyle(0x395757,1).fillRect(-.104,-.065,.124,.045);
  g.fillStyle(0x748980,1).fillEllipse(-.041,-.061,.125,.021);
  g.fillStyle(0x233d41,1).fillEllipse(.020,-.043,.027,.044);
  g.fillStyle(0x4a5f57,1).fillEllipse(-.102,-.043,.022,.044);
  for(const x of [-.083,-.01]) {
    g.lineStyle(.005,0xb49857,1).lineBetween(x,-.064,x,-.022);
    for(const y of [-.056,-.037]) g.fillStyle(0xddc08b,1).fillCircle(x,y,.0025);
  }
  g.fillStyle(0x152d32,1).fillRect(-.095,-.040,.024,.019);
  g.fillStyle(0xdf772b,.8+.2*Math.sin(time/170)).fillRect(-.091,-.037,.015,.012);
  g.fillStyle(0xc2a465,1).fillRect(-.060,-.081,.026,.019);
  g.fillStyle(0xcbd1b9,1).fillCircle(-.045,-.077,.010);
  g.lineStyle(.002,0x263b3c,1).lineBetween(-.045,-.077,-.041,-.082);
  g.lineStyle(.007,0x8c9e8d,1).lineBetween(-.016,-.069,-.016,-.109);
  g.lineBetween(-.016,-.109,.003,-.109);
  // Two runs of the leather belt connect the wheel to the wall pulley.
  for(const side of [-1,1]) {
    const a={x:wheel.x,y:wheel.y+side*radius*.83},b={x:pulley.x,y:pulley.y+side*.022};
    g.lineStyle(.009,0x2c3029,1).lineBetween(a.x,a.y,b.x,b.y);
    g.lineStyle(.003,0xb69862,1).lineBetween(a.x,a.y-.002,b.x,b.y-.002);
    // Visible lacing follows both runs continuously.
    const t=((time/1400*side)%1+1)%1,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    g.lineStyle(.004,0xd3bc83,1).lineBetween(x-.002,y-.004,x+.002,y+.004);
  }
  g.fillStyle(0x1c363b,1).fillCircle(pulley.x,pulley.y,.025);
  g.lineStyle(.004,0x99a79b,1).strokeCircle(pulley.x,pulley.y,.024);
  g.lineBetween(pulley.x,pulley.y,pulley.x+Math.cos(spin*2.5)*.023,pulley.y+Math.sin(spin*2.5)*.023);
  // Heavy open flywheel, bright machined rim and six moving iron spokes.
  g.lineStyle(.011,0x182e34,1).strokeCircle(wheel.x,wheel.y,radius);
  g.lineStyle(.0035,0xb5c2b4,1).strokeCircle(wheel.x,wheel.y,radius+.003);
  for(let i=0;i<6;i++) {
    const a=spin+i*Math.PI/3;
    g.lineStyle(.006,0x526d69,1).lineBetween(wheel.x,wheel.y,wheel.x+Math.cos(a)*radius*.91,wheel.y+Math.sin(a)*radius*.91);
  }
  const crank={x:wheel.x+Math.cos(spin)*.033,y:wheel.y+Math.sin(spin)*.033};
  g.lineStyle(.008,0xc0b793,1).lineBetween(-.032+Math.cos(spin)*.02,-.031,crank.x,crank.y);
  g.fillStyle(0xd5c591,1).fillCircle(crank.x,crank.y,.006);
  g.fillStyle(0xc1aa70,1).fillCircle(wheel.x,wheel.y,.009);
  g.restore();
}

export function drawCitySteamExhaust(g: Phaser.GameObjects.Graphics, origin: CityPoint, size: number, time: number, phase: number): void {
  for(let j=0;j<6;j++) {
    const t=(time/2200+phase*.07+j/6)%1;
    const pulse=.55+.45*Math.sin((time/560-t*4)*2);
    g.fillStyle(0xf1f6e8,(1-t)*.38*pulse);
    g.fillEllipse(origin.x+size*(.004+t*.082),origin.y-size*(.11+t*.19),size*(.022+t*.067),size*(.015+t*.040));
  }
}

/** Thin local veils of coal smoke leave the saturated roof highlights visible.
 * Anchoring them to actual chimneys also respects missing coastal districts. */
export function drawCitySmog(g: Phaser.GameObjects.Graphics, smoke: CityPoint[], size: number, time: number): void {
  for(let i=0;i<smoke.length;i+=3) {
    const p=smoke[i],drift=Math.sin(time/17000+i)*.045;
    for(let j=0;j<3;j++) {
      g.fillStyle(0x45514b,.022-j*.005);
      g.fillEllipse(p.x+size*(.08+drift),p.y-size*(.085+j*.023),size*(.36+j*.13),size*(.07+j*.037));
    }
  }
}
