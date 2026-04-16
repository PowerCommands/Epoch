import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(__dirname, '..', 'public', 'assets', 'sprites');
const SIZE = 48;
const UNIT_RADIUS = 16;

function save(name: string, canvas: ReturnType<typeof createCanvas>) {
  const path = join(OUT, name);
  writeFileSync(path, canvas.toBuffer('image/png'));
  console.log(`wrote ${path}`);
}

// --- CITY ---
function generateCity() {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2 + 4; // shift down to make room for tower

  // main circle
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // tower on top
  const tw = 8, th = 10;
  const tx = cx - tw / 2;
  const ty = cy - 16 - th + 2; // sits on top of circle
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(tx, ty, tw, th);

  // tower battlement notches
  ctx.fillStyle = '#000000';
  ctx.fillRect(tx, ty, 2, 3);
  ctx.fillRect(tx + tw - 2, ty, 2, 3);

  save('city_default.png', c);
}

// --- UNIT BASE ---
function unitBase(): [ReturnType<typeof createCanvas>, CanvasRenderingContext2D] {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, UNIT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#cccccc';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  return [c, ctx];
}

// --- WARRIOR ---
function generateWarrior() {
  const [c, ctx] = unitBase();
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.fillStyle = '#333333';
  // sword blade (vertical)
  ctx.fillRect(cx - 2, cy - 10, 4, 20);
  // crossguard (horizontal)
  ctx.fillRect(cx - 5, cy - 1, 10, 3);
  // pommel
  ctx.beginPath();
  ctx.arc(cx, cy + 11, 2, 0, Math.PI * 2);
  ctx.fill();

  save('unit_warrior.png', c);
}

// --- ARCHER ---
function generateArcher() {
  const [c, ctx] = unitBase();
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2.5;

  // bow arc (left side)
  ctx.beginPath();
  ctx.arc(cx - 2, cy, 10, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.stroke();

  // bowstring
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  const startY = cy - 10 * Math.sin(Math.PI * 0.65);
  const endY = cy + 10 * Math.sin(Math.PI * 0.65);
  const startX = cx - 2 + 10 * Math.cos(Math.PI * 0.65);
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX, endY);
  ctx.stroke();

  // arrow shaft
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.stroke();

  // arrowhead
  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.moveTo(cx + 12, cy);
  ctx.lineTo(cx + 7, cy - 3);
  ctx.lineTo(cx + 7, cy + 3);
  ctx.closePath();
  ctx.fill();

  save('unit_archer.png', c);
}

// --- CAVALRY ---
function generateCavalry() {
  const [c, ctx] = unitBase();
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.fillStyle = '#333333';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2.5;

  // chevron/horse head shape — 3 thick angled lines pointing up
  const offsets = [-5, 0, 5];
  for (const dx of offsets) {
    ctx.beginPath();
    ctx.moveTo(cx + dx - 4, cy + 5);
    ctx.lineTo(cx + dx, cy - 7);
    ctx.lineTo(cx + dx + 4, cy + 5);
    ctx.stroke();
  }

  save('unit_cavalry.png', c);
}

// --- SETTLER ---
function generateSettler() {
  const [c, ctx] = unitBase();
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.fillStyle = '#333333';

  // backpack/bag — rounded rect
  const bw = 14, bh = 16;
  const bx = cx - bw / 2;
  const by = cy - bh / 2 + 1;
  const r = 3;

  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();

  // flap line
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + 2, by + 4);
  ctx.lineTo(bx + bw - 2, by + 4);
  ctx.stroke();

  // strap
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, by - 3, 5, Math.PI, 0);
  ctx.stroke();

  save('unit_settler.png', c);
}

// --- FISHING BOAT ---
function generateFishingBoat() {
  const [c, ctx] = unitBase();
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.fillStyle = '#333333';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;

  // small oval hull
  ctx.beginPath();
  ctx.ellipse(cx, cy + 7, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // mast
  ctx.beginPath();
  ctx.moveTo(cx, cy + 6);
  ctx.lineTo(cx, cy - 10);
  ctx.stroke();

  // sail
  ctx.beginPath();
  ctx.moveTo(cx + 1, cy - 9);
  ctx.lineTo(cx + 1, cy + 3);
  ctx.lineTo(cx + 9, cy + 3);
  ctx.closePath();
  ctx.fill();

  save('unit_fishing_boat.png', c);
}

// --- TRANSPORT SHIP ---
function generateTransportShip() {
  const [c, ctx] = unitBase();
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  ctx.fillStyle = '#333333';
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;

  // wider oval hull
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // masts
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy + 6);
    ctx.lineTo(cx + dx, cy - 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + dx + 1, cy - 9);
    ctx.lineTo(cx + dx + 1, cy + 3);
    ctx.lineTo(cx + dx + 8, cy + 3);
    ctx.closePath();
    ctx.fill();
  }

  save('unit_transport_ship.png', c);
}

// --- RUN ---
generateCity();
generateWarrior();
generateArcher();
generateCavalry();
generateSettler();
generateFishingBoat();
generateTransportShip();
console.log('done — 7 sprites generated');
