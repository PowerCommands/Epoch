import type Phaser from 'phaser';
import { CITY_STREETS, cityContains, cityOccluded, type CityPoint, type CityOccluder } from './OrganicCityArtwork';

// Arc-length sampling keeps each team at a steady pace around crooked streets.
const routes = CITY_STREETS.slice(0, 4).map(points => {
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, distances, length: distances[distances.length - 1] };
});
function streetPoint(route: typeof routes[number], distance: number): CityPoint {
  const i = Math.max(0, route.distances.findIndex((d, index) => index > 0 && d >= distance) - 1);
  const a = route.points[i], b = route.points[i + 1];
  const t = Math.max(0, Math.min(1, (distance - route.distances[i]) / (route.distances[i + 1] - route.distances[i])));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Town merchants use open timber carts; City adds hired cabs, freight and one
 * early brass-era motor carriage, all within the existing Graphics batch. */
export function drawCityWagons(ink: Phaser.GameObjects.Graphics, size: number, time: number, phase: number, land: CityPoint[][], industrial = false, occluders: CityOccluder[] = []): void {
  for(let i=0;i<(industrial?5:2);i++) {
    const route=routes[i%routes.length],motor=industrial&&i===4,carriage=industrial&&(i===1||i===2);
    const t = (time / (68000 + i * 9000) + phase * .019 + i * .37) % 2;
    const direction = t < 1 ? 1 : -1;
    const distance = .17 + (t < 1 ? t : 2 - t) * (route.length - .34);
    const cart = streetPoint(route, distance);
    const horse = streetPoint(route, distance + direction * .091);
    const ahead = streetPoint(route, distance + direction * .12);
    const angle = Math.atan2(horse.y - cart.y, horse.x - cart.x);
    const horseAngle = Math.atan2(ahead.y - horse.y, ahead.x - horse.x);
    // Check the whole team, including its outer wheels, at coast boundaries.
    if (![cart, horse, ahead].every(p => [[0,0],[0,.03],[0,-.03],[.04,0],[-.04,0]].every(([x,y]) =>
      land.some(poly => cityContains(poly, {x:(p.x+x)*size,y:(p.y+y)*size}))))) continue;
    if((motor?[cart]:[cart,horse]).some(p=>cityOccluded({x:p.x*size,y:(p.y-.015)*size},occluders)))continue;
    const stroke = Math.max(.35, size * .006);
    ink.fillStyle(0x183136, .32);
    ink.fillEllipse(cart.x * size, cart.y * size + size * .01, size * .10, size * .05);
    if(!motor) ink.fillEllipse(horse.x * size, horse.y * size + size * .01, size * .065, size * .03);
    ink.lineStyle(stroke, 0x72533a, .95);
    if(!motor) for(const side of [-1,1]) ink.lineBetween(cart.x*size,cart.y*size+side*size*.010,horse.x*size,horse.y*size+side*size*.010);
    ink.save();ink.translateCanvas(cart.x * size, cart.y * size);ink.rotateCanvas(angle);
    // Wheels, rotating spokes, plank bed, cargo and a seated driver.
    for (const axle of (industrial?[-.026,.031]:[-.004])) for (const side of [-1, 1]) {
      const x = size * axle, y = side * size * .028, radius = size * (motor?.014:.017);
      ink.fillStyle(0x202e2d, 1);ink.fillCircle(x, y, radius);
      ink.lineStyle(stroke, industrial?0xa2ab94:0xc99955, 1);ink.strokeCircle(x, y, radius * .8);
      const spin = time / 220 * direction;
      ink.lineBetween(x - Math.cos(spin) * radius, y - Math.sin(spin) * radius,
        x + Math.cos(spin) * radius, y + Math.sin(spin) * radius);
    }
    ink.fillStyle(0x68402a, 1);ink.fillRect(-size * .039, -size * .023, size * .08, size * .046);
    ink.fillStyle(i === 1 ? 0xbd9752 : 0xb7813e, 1);ink.fillRect(-size * .032, -size * .018, size * .055, size * .036);
    for(let x=-.027;x<.026;x+=.015) {
      ink.lineStyle(stroke*.65,0x694929,1).lineBetween(size*x,-size*.019,size*x,size*.019);
    }
    ink.lineStyle(stroke, 0xe2be75, 1);
    ink.lineBetween(-size * .035, -size * .023, size * .04, -size * .023);
    ink.lineBetween(-size * .035, size * .023, size * .04, size * .023);
    if(carriage) {
      ink.fillStyle(i===1?0x153f43:0x722d26,1).fillRect(-size*.043,-size*.026,size*.072,size*.052);
      ink.fillStyle(0x1a2c30,1).fillRoundedRect(-size*.041,-size*.027,size*.066,size*.040,size*.009);
      ink.lineStyle(stroke,0xba985b,1).lineBetween(-size*.039,size*.024,size*.026,size*.024);
      for(const side of [-1,1]) {
        ink.fillStyle(0x79aaa8,1).fillRect(-size*.024,side*size*.019,size*.030,size*.009);
        ink.fillStyle(0xecc275,1).fillCircle(size*.030,side*size*.027,size*.005);
      }
    } else if(motor) {
      ink.fillStyle(0x642b26,1).fillRect(-size*.045,-size*.022,size*.095,size*.044);
      ink.fillStyle(0x1c433f,1).fillRect(size*.006,-size*.023,size*.048,size*.046);
      ink.fillStyle(0xd1af62,1).fillRect(size*.048,-size*.022,size*.009,size*.044);
      for(let y=-.016;y<.020;y+=.007) ink.lineStyle(stroke*.6,0x453b27,1).lineBetween(size*.050,size*y,size*.056,size*y);
      ink.fillStyle(0x302b27,1).fillRect(-size*.037,-size*.019,size*.032,size*.038);
      ink.lineStyle(stroke,0xa9c8b8,1).lineBetween(size*.002,-size*.025,size*.002,size*.025);
      ink.lineStyle(stroke,0xe2d7b3,1).lineBetween(size*.004,-size*.025,size*.004,size*.009);
      for(const side of [-1,1]) ink.fillStyle(0xf3d989,1).fillCircle(size*.055,side*size*.025,size*.006);
      ink.lineStyle(stroke,0xb29a68,1).strokeCircle(-size*.007,0,size*.010);
    } else {
      for(let j=0;j<3;j++) {
        ink.fillStyle(j===2?0x7e542d:0xc9af70,1).fillEllipse(size*(-.022+j*.016),size*(j%2?.008:-.005),size*.025,size*.022);
        ink.lineStyle(stroke*.6,0x735530,1).lineBetween(size*(-.03+j*.016),-size*.008,size*(-.02+j*.016),size*.01);
      }
    }
    ink.fillStyle(industrial?0x253f4b:0x2b6872, 1);ink.fillEllipse(size * (motor?-.02:.027), 0, size * .025, size * .027);
    ink.fillStyle(0xe0bd94, 1);ink.fillCircle(size * (motor?-.015:.035), -size * .003, size * .009);
    if(industrial) ink.fillStyle(0x233334,1).fillRect(size*(motor?-.022:.027),-size*.014,size*.017,size*.011);
    ink.restore();
    if(motor) continue;
    ink.save();ink.translateCanvas(horse.x * size, horse.y * size);ink.rotateCanvas(horseAngle);
    const coat = i === 1 ? 0xb4a68a : i === 2 ? 0x49372d : 0x92502c;
    ink.lineStyle(stroke, 0x302d26, 1);
    for (const end of [-1, 1]) for (const side of [-1, 1]) {
      const stride = Math.sin(time / 160 + (end === side ? 0 : Math.PI)) * size * .01;
      ink.lineBetween(end * size * .017, side * size * .008,
        end * size * .017 + stride, side * size * .021);
    }
    ink.fillStyle(coat, 1);ink.fillEllipse(0, 0, size * .058, size * .025);
    ink.fillEllipse(size * .025, 0, size * .025, size * .018);
    ink.fillStyle(i===1?0xe0d5b5:0xbc7844,1).fillEllipse(-size*.006,-size*.005,size*.037,size*.011);
    ink.fillStyle(0x3d352b, 1);ink.fillEllipse(size * .005, 0, size * .033, size * .006);
    ink.lineStyle(stroke, 0x3d352b, 1);ink.lineBetween(-size * .025, 0, -size * .042, Math.sin(time / 450) * size * .005);
    ink.lineStyle(stroke, 0xc2ac80, 1);ink.lineBetween(size * .016, -size * .012, size * .016, size * .012);
    ink.lineStyle(stroke*.75,0x352d26,1).lineBetween(-size*.009,-size*.014,-size*.009,size*.014);
    ink.fillStyle(coat, 1);ink.fillTriangle(size * .025, -size * .004, size * .019, -size * .015, size * .017, -size * .003);
    ink.restore();
  }
}

export function drawCityFountain(ink: Phaser.GameObjects.Graphics, size: number, time: number, fountain: CityPoint): void {
  const x = fountain.x * size, y = (fountain.y - .006) * size;
  // Thin parabolic jets and travelling droplets fall back inside the basin.
  for (const side of [-1, 1]) {
    const point = (t: number) => ({x:x+side*size*.033*t,y:y-size*.051*(1-t)-size*.09*4*t*(1-t)});
    ink.lineStyle(Math.max(.35,size*.005), 0xa8e4e4, .60);
    ink.beginPath();
    for (let j=0;j<=10;j++) {const p=point(j/10);if(j===0)ink.moveTo(p.x,p.y);else ink.lineTo(p.x,p.y);}
    ink.strokePath();
    for(let j=0;j<3;j++){
      const t=(time/1050+j/3+(side===1?.16:0))%1,p=point(t);
      ink.fillStyle(0xe2faf3,.85);ink.fillCircle(p.x,p.y,size*.0055);
    }
  }
  for(let j=0;j<2;j++){
    const t=(time/1450+j/2)%1;
    ink.lineStyle(Math.max(.3,size*.004),0xd6f3df,(1-t)*.65);
    ink.strokeEllipse(x,y,size*(.014+t*.058),size*(.006+t*.023));
  }
  ink.fillStyle(0xe0f6ec,.55+.20*Math.sin(time/170));
  ink.fillEllipse(x-size*.033,y,size*.012,size*.007);
  ink.fillEllipse(x+size*.033,y,size*.012,size*.007);
}
