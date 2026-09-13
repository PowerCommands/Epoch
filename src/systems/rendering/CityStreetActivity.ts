import type Phaser from 'phaser';
import { CITY_STREETS, cityContains, type CityPoint } from './OrganicCityArtwork';

// Arc-length sampling keeps each team at a steady pace around crooked streets.
const routes = CITY_STREETS.slice(0, 3).map(points => {
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

/** Three small horse teams share the City's Graphics batch; no game entities. */
export function drawCityWagons(ink: Phaser.GameObjects.Graphics, size: number, time: number, phase: number, land: CityPoint[][]): void {
  routes.forEach((route, i) => {
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
      land.some(poly => cityContains(poly, {x:(p.x+x)*size,y:(p.y+y)*size}))))) return;
    const stroke = Math.max(.35, size * .006);
    ink.fillStyle(0x34452c, .28);
    ink.fillEllipse(cart.x * size, cart.y * size + size * .01, size * .10, size * .05);
    ink.fillEllipse(horse.x * size, horse.y * size + size * .01, size * .065, size * .03);
    ink.lineStyle(stroke, 0x72533a, .95);
    ink.lineBetween(cart.x * size, cart.y * size - size * .014, horse.x * size, horse.y * size - size * .014);
    ink.save();ink.translateCanvas(cart.x * size, cart.y * size);ink.rotateCanvas(angle);
    // Wheels, rotating spokes, plank bed, cargo and a seated driver.
    for (const side of [-1, 1]) {
      const x = -size * .004, y = side * size * .027, radius = size * .016;
      ink.fillStyle(0x493b2b, 1);ink.fillCircle(x, y, radius);
      ink.lineStyle(stroke, 0xc3a675, 1);ink.strokeCircle(x, y, radius * .75);
      const spin = time / 220 * direction;
      ink.lineBetween(x - Math.cos(spin) * radius, y - Math.sin(spin) * radius,
        x + Math.cos(spin) * radius, y + Math.sin(spin) * radius);
    }
    ink.fillStyle(0x765239, 1);ink.fillRect(-size * .039, -size * .023, size * .08, size * .046);
    ink.fillStyle(i === 1 ? 0xb8ad86 : 0xb89058, 1);ink.fillRect(-size * .032, -size * .018, size * .055, size * .036);
    ink.lineStyle(stroke, 0xdec18b, .9);
    ink.lineBetween(-size * .035, -size * .023, size * .04, -size * .023);
    ink.lineBetween(-size * .035, size * .023, size * .04, size * .023);
    ink.fillStyle(0x50696a, 1);ink.fillEllipse(size * .027, 0, size * .025, size * .027);
    ink.fillStyle(0xe0bd94, 1);ink.fillCircle(size * .035, -size * .003, size * .009);
    ink.restore();
    ink.save();ink.translateCanvas(horse.x * size, horse.y * size);ink.rotateCanvas(horseAngle);
    const coat = i === 1 ? 0xa99473 : i === 2 ? 0x65452f : 0x8b5935;
    ink.lineStyle(stroke, 0x493b2c, 1);
    for (const end of [-1, 1]) for (const side of [-1, 1]) {
      const stride = Math.sin(time / 160 + (end === side ? 0 : Math.PI)) * size * .01;
      ink.lineBetween(end * size * .017, side * size * .008,
        end * size * .017 + stride, side * size * .021);
    }
    ink.fillStyle(coat, 1);ink.fillEllipse(0, 0, size * .058, size * .025);
    ink.fillEllipse(size * .025, 0, size * .025, size * .018);
    ink.fillStyle(0x3d352b, 1);ink.fillEllipse(size * .005, 0, size * .033, size * .006);
    ink.lineStyle(stroke, 0x3d352b, 1);ink.lineBetween(-size * .025, 0, -size * .042, Math.sin(time / 450) * size * .005);
    ink.lineStyle(stroke, 0xc2ac80, 1);ink.lineBetween(size * .016, -size * .012, size * .016, size * .012);
    ink.fillStyle(coat, 1);ink.fillTriangle(size * .025, -size * .004, size * .019, -size * .015, size * .017, -size * .003);
    ink.restore();
  });
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
