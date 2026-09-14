import type Phaser from 'phaser';

export const STATION_TRAIN_PERIOD = 24;
// Texture-space anchors shared by the locomotive wheels and the painted rails.
export const STATION_TRACK_Y = .689;
const DRIVING_WHEEL_RADIUS = .014;

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
  return { x, y: STATION_TRACK_Y, visible: phase < 16, wheelAngle: (x + .28) / DRIVING_WHEEL_RADIUS };
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
  const ellipse = (x: number, y: number, w: number, h: number, color: number) => {
    const p=at(pose.x+x,pose.y+y);
    g.fillStyle(color,alpha).fillEllipse(p.x,p.y,size*w,size*h);
  };
  // A long, low coal-fired engine: cylindrical boiler, a dark enclosed cab,
  // sprung underframe and separate tender instead of stacked toy-like blocks.
  rect(-.225,-.049,.080,.029,0x293a3b);
  rect(-.226,-.052,.082,.006,0x708078);
  rect(-.218,-.042,.064,.003,0x52645e);
  for(let i=0;i<12;i++) ellipse(-.219+(i%6)*.012,-.055-Math.floor(i/6)*.005,.015,.011,i%3?0x19282f:0x4b5960);
  rect(-.139,-.072,.061,.052,0x203e3b);
  rect(-.147,-.078,.077,.007,0x182c33);
  rect(-.143,-.079,.069,.002,0x82948a);
  rect(-.131,-.067,.021,.024,0x122931);
  rect(-.105,-.067,.019,.024,0x122931);
  rect(-.129,-.065,.017,.004,0x91b8b0);
  rect(-.103,-.065,.014,.004,0x91b8b0);
  rect(-.129,-.045,.015,.004,0xc58139);
  // Boiler top catches the light; its belly stays almost black.
  rect(-.078,-.056,.145,.036,0x253d44);
  rect(-.074,-.057,.137,.008,0x5f787b);
  rect(-.074,-.054,.137,.003,0x91a19b);
  rect(-.075,-.031,.141,.012,0x182f38);
  ellipse(.068,-.039,.019,.038,0x192c32);
  ellipse(.071,-.040,.010,.026,0x405558);
  for(const x of [-.058,-.008,.042]) {
    rect(x,-.055,.003,.034,0x8f8d72);
    rect(x+.003,-.054,.002,.031,0x192d32);
  }
  rect(-.018,-.066,.022,.010,0x8f7947);
  ellipse(-.007,-.066,.023,.009,0xc5b078);
  rect(.045,-.079,.014,.024,0x192c32);
  rect(.041,-.082,.022,.005,0x52635f);
  rect(.044,-.083,.017,.002,0x9da897);
  rect(.072,-.057,.009,.010,0xb49958);
  ellipse(.078,-.054,.008,.008,0xf4dda0);
  rect(-.231,-.022,.317,.008,0x202d32);
  rect(-.139,-.022,.222,.003,0x9b5a3a);
  rect(-.230,-.015,.030,.005,0x576763);
  // Visible suspension and buffers lend weight to the chassis.
  for(const x of [-.204,-.162,-.103,-.058,-.013,.055]) rect(x-.009,-.020,.018,.004,0x777c6a);
  rect(.078,-.025,.008,.017,0x323c3b);
  rect(.080,-.017,.014,.004,0xa09b7f);
  for (const [x,r] of [[-.209,.010],[-.165,.010],[-.104,DRIVING_WHEEL_RADIUS],[-.058,DRIVING_WHEEL_RADIUS],[-.012,DRIVING_WHEEL_RADIUS],[.054,.009]]) {
    const p=at(pose.x+x,pose.y-r);
    g.fillStyle(0x132931,alpha).fillCircle(p.x,p.y,size*r);
    g.lineStyle(Math.max(.35,size*.002),0x8b9993,alpha).strokeCircle(p.x,p.y,size*r*.88);
    for(let j=0;j<5;j++) {
      const angle=pose.wheelAngle+j*Math.PI*2/5;
      const spoke=at(pose.x+x+Math.cos(angle)*r*.75,pose.y-r+Math.sin(angle)*r*.75);
      g.lineStyle(Math.max(.25,size*.0015),0x6a7e78,alpha).lineBetween(p.x,p.y,spoke.x,spoke.y);
    }
    g.fillStyle(0xb2a57a,alpha).fillCircle(p.x,p.y,size*.0025);
  }
  const crankX=Math.cos(pose.wheelAngle)*.009,crankY=Math.sin(pose.wheelAngle)*.009;
  const rodA=at(pose.x-.104+crankX,pose.y-.014+crankY);
  const rodB=at(pose.x-.012+crankX,pose.y-.014+crankY);
  g.lineStyle(Math.max(.5,size*.0035),0xc0c1aa,alpha).lineBetween(rodA.x,rodA.y,rodB.x,rodB.y);
  const piston=at(pose.x+.031+crankX,pose.y-.019);
  g.lineStyle(Math.max(.4,size*.0025),0x95a7a0,alpha).lineBetween(rodB.x,rodB.y,piston.x,piston.y);
  rect(.023,-.025,.030,.011,0x4b6566);
  for(let i=0;i<7;i++) ellipse(-.066+i*.019,-.048,.002,.002,0xa7b1a1);
  // Coal exhaust is grey-black; low cylinder steam is white. Birth positions
  // keep both trails attached to the route as the engine slows and stops.
  for(let n=0;n<8;n++) {
    const age=((t+seed*7+n*.32)%2.56+2.56)%2.56;
    const birth=stationTrainPose(t-age,seed);
    if(!birth.visible) continue;
    const p=at(birth.x+.051-age*.026,pose.y-.091-age*.035);
    g.fillStyle(n%2?0x3e4e50:0x65716b,alpha*(1-age/2.56)*.36)
      .fillEllipse(p.x,p.y,size*(.018+age*.024),size*(.012+age*.015));
  }
  for(let n=0;n<3;n++) {
    const age=((t+n*.3)% .9+.9)%.9,birth=stationTrainPose(t-age,seed);
    if(!birth.visible) continue;
    const p=at(birth.x+.023-age*.03,pose.y-.018-age*.008);
    g.fillStyle(0xe6f0e5,alpha*(1-age/.9)*.4).fillEllipse(p.x,p.y,size*(.012+age*.020),size*(.007+age*.009));
  }
}
