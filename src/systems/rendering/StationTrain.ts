import type Phaser from 'phaser';

export const STATION_TRAIN_PERIOD = 24;
// Texture-space anchors shared by the locomotive wheels and the painted rails.
export const STATION_TRACK_Y = .689;

/** Stateless ambient clock: six-second arrival, four-second stop, six-second
 * departure, eight seconds empty. Wheel rotation derives from distance, so it
 * stops with the engine and never slides while accelerating. */
export function stationTrainPose(t: number, seed: number) {
  const phase = ((t + seed * STATION_TRAIN_PERIOD) % STATION_TRAIN_PERIOD + STATION_TRAIN_PERIOD) % STATION_TRAIN_PERIOD;
  let x: number;
  if (phase < 6) {
    const q = phase / 6;
    x = -.28 + .80 * (2 * q - q * q);
  } else if (phase < 10) x = .52;
  else if (phase < 16) x = .52 + .80 * ((phase - 10) / 6) ** 2;
  else x = 1.32;
  return { x, y: STATION_TRACK_Y, visible: phase < 16, wheelAngle: (x + .28) / .021 };
}

/** A small living-world overlay, using the same Graphics layer, alpha, world
 * transform, visibility and clock as the other building activities. */
export function drawStationTrain(g: Phaser.GameObjects.Graphics, s: Phaser.GameObjects.Image, t: number, seed: number, detail: number): void {
  const m = s.getWorldTransformMatrix();
  const size = Math.min(Math.abs(s.width * m.scaleX), Math.abs(s.height * m.scaleY));
  const at = (x: number, y: number) => m.transformPoint((x - s.originX) * s.width, (y - s.originY) * s.height);
  drawSteamLocomotive(g, at, size, t, seed, s.alpha * detail);
}

/** Shared normalized locomotive artwork for station and urban streetscapes. */
export function drawSteamLocomotive(g: Phaser.GameObjects.Graphics,
  at: (x: number, y: number) => {x: number; y: number}, size: number,
  t: number, seed: number, opacity: number): void {
  const pose = stationTrainPose(t, seed);
  if (!pose.visible) return;
  // Fade only at the track ends; no reset is visible during the empty interval.
  const fade = Math.max(0, Math.min(1, (pose.x + .12) / .16, (1.16 - pose.x) / .16));
  const alpha = opacity * fade;
  if (alpha <= 0) return;
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    const a=at(pose.x+x,pose.y+y), b=at(pose.x+x+w,pose.y+y), c=at(pose.x+x+w,pose.y+y+h), d=at(pose.x+x,pose.y+y+h);
    g.fillStyle(color,alpha).fillTriangle(a.x,a.y,b.x,b.y,c.x,c.y).fillTriangle(a.x,a.y,c.x,c.y,d.x,d.y);
  };
  // Coal tender, cab, brass-trimmed boiler and smokestack, facing right.
  rect(-.21,-.079,.073,.049,0x303d3b);
  rect(-.21,-.083,.073,.012,0x202529);
  rect(-.135,-.121,.062,.091,0x344c43);
  rect(-.146,-.131,.082,.012,0x202c2e);
  rect(-.124,-.109,.037,.035,0xc7bc88);
  rect(-.072,-.088,.142,.058,0x303b3c);
  rect(-.072,-.088,.142,.010,0x56605a);
  rect(.047,-.130,.019,.048,0x242e31);
  rect(.038,-.139,.036,.012,0x303b3c);
  rect(.019,-.088,.008,.058,0xb39658);
  rect(-.218,-.033,.304,.014,0x794b35);
  const nose=at(pose.x+.096,pose.y-.018), upper=at(pose.x+.07,pose.y-.05), lower=at(pose.x+.07,pose.y-.018);
  g.fillStyle(0x555d58,alpha).fillTriangle(nose.x,nose.y,upper.x,upper.y,lower.x,lower.y);
  for (const [x,r] of [[-.194,.014],[-.151,.014],[-.097,.021],[-.044,.021],[.009,.021],[.060,.014]]) {
    const p=at(pose.x+x,pose.y-r);
    g.fillStyle(0x20282b,alpha).fillCircle(p.x,p.y,size*r);
    g.lineStyle(Math.max(.5,size*.003),0xaaa58e,alpha).strokeCircle(p.x,p.y,size*r*.8);
    const spoke=at(pose.x+x+Math.cos(pose.wheelAngle)*r*.75,pose.y-r+Math.sin(pose.wheelAngle)*r*.75);
    g.lineBetween(p.x,p.y,spoke.x,spoke.y);
  }
  const rodA=at(pose.x-.097+Math.cos(pose.wheelAngle)*.012,pose.y-.021+Math.sin(pose.wheelAngle)*.012);
  const rodB=at(pose.x+.009+Math.cos(pose.wheelAngle)*.012,pose.y-.021+Math.sin(pose.wheelAngle)*.012);
  g.lineStyle(Math.max(.6,size*.005),0xb5ae98,alpha).lineBetween(rodA.x,rodA.y,rodB.x,rodB.y);
  // Emitted puffs remain anchored to the engine's position at birth, trailing
  // naturally during travel and rising above the chimney during the stop.
  for(let n=0;n<5;n++) {
    const age=((t+seed*7+n*.36)%1.8+1.8)%1.8;
    const birth=stationTrainPose(t-age,seed);
    if(!birth.visible) continue;
    const p=at(birth.x+.055-age*.027,pose.y-.15-age*.065);
    g.fillStyle(0xc8c9bc,alpha*(1-age/1.8)*.45).fillCircle(p.x,p.y,size*(.012+age*.014));
  }
}
