import type Phaser from 'phaser';

type Point = readonly [number, number];
const ease = (q: number): number => { const v = Math.max(0, Math.min(1, q)); return v * v * (3 - 2 * v); };
const cycle = (t: number, period: number): number => ((t % period) + period) % period;
export const PORT_CRANE_PERIOD = 18;
export const PORT_TRUCK_PERIOD = 20;

/** Source-space anchors on the two rigid booms in container_port.png, rear first. */
export const PORT_CRANES = [
  { yard: [.724, .256], ship: [.860, .315], yardDrop: .205, shipDrop: .185, color: 0x3f8090 },
  { yard: [.510, .363], ship: [.704, .449], yardDrop: .205, shipDrop: .150, color: 0xb95a3e },
] as const;

/** Hoist before traversing; release only at the destination, return empty.
 * Rendering clock only: no simulation state, timers or gameplay randomness. */
export function portCranePose(t: number, seed: number) {
  const q = cycle(t + seed * PORT_CRANE_PERIOD, PORT_CRANE_PERIOD);
  const travel = q < 3 ? 0 : q < 6 ? ease((q - 3) / 3) : q < 12 ? 1 : q < 15 ? 1 - ease((q - 12) / 3) : 0;
  const lift = q < 1 ? 0 : q < 3 ? ease((q - 1) / 2) : q < 6 ? 1 : q < 8 ? 1 - ease((q - 6) / 2)
    : q < 10 ? 0 : q < 12 ? ease((q - 10) / 2) : q < 15 ? 1 : q < 17 ? 1 - ease((q - 15) / 2) : 0;
  return { travel, lift, loaded: q < 9, delivered: q >= 9 && q < 12, cargoAlpha: q < 9 ? 1 : 1 - ease((q - 10) / 2) };
}

/** Separate lanes on the open road. Trucks pause inside the yard before leaving. */
export function portTruckPose(t: number, seed: number, outbound = false) {
  const q = cycle(t + seed * PORT_TRUCK_PERIOD, PORT_TRUCK_PERIOD);
  const progress = q < 7 ? .70 * ease(q / 7) : q < 9 ? .70 : .70 + .30 * ease((q - 9) / 4);
  const along = outbound ? 1 - progress : progress;
  return { x: .135 + along * .255 + (outbound ? .047 : 0), y: .600 - along * .147 + (outbound ? .025 : 0),
    alpha: Math.min(ease(q / .8), 1 - ease((q - 12) / 1)), visible: q < 13, outbound };
}

/** Small, bounded Graphics activity shares AmbientSprites visibility, clock,
 * reduced-motion, zoom, damage and shutdown handling in WebGL and Canvas. */
export function drawContainerPort(g: Phaser.GameObjects.Graphics, sprite: Phaser.GameObjects.Image, t: number, seed: number, detail: number): void {
  const matrix = sprite.getWorldTransformMatrix();
  const size = Math.min(Math.abs(sprite.width * matrix.scaleX), Math.abs(sprite.height * matrix.scaleY));
  const opacity = sprite.alpha * Math.max(.7, detail);
  const at = (p: Point) => matrix.transformPoint((p[0] - sprite.originX) * sprite.width, (p[1] - sprite.originY) * sprite.height);
  const line = (a: Point, b: Point, color: number, width = .003, alpha = opacity) => {
    const p = at(a), q = at(b);
    g.lineStyle(Math.max(.45, size * width), color, alpha).lineBetween(p.x, p.y, q.x, q.y);
  };
  const face = (points: Point[], color: number, alpha = opacity) => {
    const a = at(points[0]);
    g.fillStyle(color, alpha);
    for (let i = 1; i < points.length - 1; i++) {
      const b = at(points[i]), c = at(points[i + 1]);
      g.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
    }
  };
  // Consistent isometric axes: long container edges follow the ship, not screen X.
  const box = (x: number, y: number, length: number, width: number, height: number, color: number, alpha = opacity, ribs = false) => {
    const a: Point = [x - length / 2 - width / 2, y + length * .27 - width * .25];
    const b: Point = [a[0] + length, a[1] - length * .54];
    const c: Point = [b[0] + width, b[1] + width * .50];
    const d: Point = [a[0] + width, a[1] + width * .50];
    const up = (p: Point): Point => [p[0], p[1] - height];
    face([a, d, up(d), up(a)], shade(color, .64), alpha);
    face([d, c, up(c), up(d)], color, alpha);
    face([up(a), up(b), up(c), up(d)], shade(color, 1.22), alpha);
    if (ribs) for (let i = 1; i < 6; i++) {
      const x = d[0] + (c[0] - d[0]) * i / 6, y = d[1] + (c[1] - d[1]) * i / 6;
      line([x, y - height * .15], [x, y - height * .85], shade(color, .72), .0012, alpha * .8);
    }
  };

  // Trucks arrive and depart on the broad left-front road, below the gantries.
  for (let i = 0; i < 2; i++) {
    const p = portTruckPose(t, (seed + i * .48) % 1, i === 1);
    if (!p.visible || !p.alpha) continue;
    const alpha = opacity * p.alpha, direction = p.outbound ? -1 : 1;
    const cabX = p.x + direction * .034, cabY = p.y - direction * .018;
    // Wheel pairs, trailer, cargo and cream cab keep traffic legible at map scale.
    for (const n of [-1, 1]) {
      for (const side of [-1, 1]) {
        const wheel = at([p.x + n * .023 + side * .012, p.y - n * .012 + side * .006]);
        g.fillStyle(0x242d35, alpha).fillCircle(wheel.x, wheel.y, Math.max(.55, size * .004));
      }
    }
    box(p.x, p.y, .065, .026, .008, 0x424951, alpha);
    box(p.x, p.y - .008, .057, .026, .024, i ? 0x3f7286 : 0xb76343, alpha, true);
    box(cabX, cabY, .019, .027, .020, 0xdcd5b9, alpha);
    line([cabX - .006, cabY - .018], [cabX + .004, cabY - .023], 0x315164, .005, alpha);
  }

  for (let i = 0; i < PORT_CRANES.length; i++) {
    const crane = PORT_CRANES[i], pose = portCranePose(t, (seed + i * .43) % 1);
    const x = crane.yard[0] + (crane.ship[0] - crane.yard[0]) * pose.travel;
    const y = crane.yard[1] + (crane.ship[1] - crane.yard[1]) * pose.travel;
    const low = crane.yardDrop + (crane.shipDrop - crane.yardDrop) * pose.travel;
    const drop = low + (.065 - low) * pose.lift;
    // Trolley rides the underside of the painted boom; two cables stay taut.
    box(x, y + .008, .028, .020, .017, 0xe9b62e);
    for (const side of [-1, 1]) line([x + side * .017, y - side * .009 + .01], [x + side * .017, y + drop - side * .009], 0x344148, .0025);
    box(x, y + drop, .057, .028, .009, 0xe7ae29);
    if (pose.loaded) box(x, y + drop + .028, .064, .033, .028, crane.color, opacity, true);
    // Cargo rests on deck after release, then blends into the painted stacks.
    if (pose.delivered) box(crane.ship[0], crane.ship[1] + crane.shipDrop + .028, .064, .033, .028, crane.color, opacity * pose.cargoAlpha, true);
  }

  // Narrow wavelets track the visible outer hull, with no whole-ship deformation.
  for (let n = 0; n < 5; n++) {
    const q = cycle(t / 4 + seed + n / 5, 1);
    const x = .46 + n * .10 + q * .012, y = .816 - n * .058 + q * .016;
    line([x, y], [x + .036 + q * .015, y - .020 - q * .008], 0xbbe5dd, .0025, opacity * Math.sin(q * Math.PI) * .38);
  }
}

function shade(color: number, multiplier: number): number {
  const channel = (shift: number) => Math.min(255, Math.round(((color >> shift) & 255) * multiplier));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
