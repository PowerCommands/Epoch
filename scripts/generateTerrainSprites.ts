import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(__dirname, '..', 'public', 'assets', 'sprites', 'terrain');
const SIZE = 48;

function save(name: string, canvas: ReturnType<typeof createCanvas>) {
  const path = join(OUT, name);
  writeFileSync(path, canvas.toBuffer('image/png'));
  console.log(`wrote ${path}`);
}

function makeCanvas() {
  return createCanvas(SIZE, SIZE);
}

// --- OCEAN ---
function generateOcean() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a3a5c';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle darker circle patterns for depth
  ctx.fillStyle = 'rgba(10, 30, 50, 0.25)';
  ctx.beginPath(); ctx.arc(14, 16, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(36, 32, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(24, 40, 6, 0, Math.PI * 2); ctx.fill();

  save('ocean.png', c);
}

// --- COAST ---
function generateCoast() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  // Water top
  ctx.fillStyle = '#2e6da4';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Sandy bottom strip
  ctx.fillStyle = '#c8a96e';
  ctx.fillRect(0, SIZE - 12, SIZE, 12);
  // Transition — wavy edge
  ctx.strokeStyle = '#a08850';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 36);
  ctx.quadraticCurveTo(12, 33, 24, 36);
  ctx.quadraticCurveTo(36, 39, 48, 36);
  ctx.stroke();

  save('coast.png', c);
}

// --- PLAINS ---
function generatePlains() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Lighter green horizontal stripes
  ctx.fillStyle = 'rgba(106, 170, 95, 0.35)';
  for (let y = 6; y < SIZE; y += 10) {
    ctx.fillRect(0, y, SIZE, 3);
  }

  save('plains.png', c);
}

// --- FOREST ---
function generateForest() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2d5a1b';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 3 triangle trees
  ctx.fillStyle = '#1a3d0f';
  const trees = [
    { cx: 12, bot: 40, w: 14, h: 20 },
    { cx: 24, bot: 36, w: 16, h: 24 },
    { cx: 36, bot: 40, w: 14, h: 20 },
  ];
  for (const t of trees) {
    ctx.beginPath();
    ctx.moveTo(t.cx, t.bot - t.h);
    ctx.lineTo(t.cx - t.w / 2, t.bot);
    ctx.lineTo(t.cx + t.w / 2, t.bot);
    ctx.closePath();
    ctx.fill();
  }
  // Small trunks
  ctx.fillStyle = '#4a3520';
  for (const t of trees) {
    ctx.fillRect(t.cx - 1.5, t.bot, 3, 4);
  }

  save('forest.png', c);
}

// --- MOUNTAIN ---
function generateMountain() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 2 mountain peaks
  ctx.fillStyle = '#5a5a5a';
  // Left peak
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.lineTo(2, 42);
  ctx.lineTo(30, 42);
  ctx.closePath();
  ctx.fill();
  // Right peak
  ctx.beginPath();
  ctx.moveTo(34, 14);
  ctx.lineTo(22, 42);
  ctx.lineTo(46, 42);
  ctx.closePath();
  ctx.fill();

  // Snow caps
  ctx.fillStyle = '#eeeeee';
  // Left snow
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.lineTo(11, 20);
  ctx.lineTo(21, 20);
  ctx.closePath();
  ctx.fill();
  // Right snow
  ctx.beginPath();
  ctx.moveTo(34, 14);
  ctx.lineTo(29, 23);
  ctx.lineTo(39, 23);
  ctx.closePath();
  ctx.fill();

  save('mountain.png', c);
}

// --- ICE ---
function generateIce() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d6eaf8';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // White hexagon pattern overlay
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  const drawHex = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  };
  drawHex(16, 16, 10);
  drawHex(36, 16, 10);
  drawHex(26, 34, 10);
  drawHex(6, 34, 10);
  drawHex(46, 34, 10);

  save('ice.png', c);
}

// --- JUNGLE ---
function generateJungle() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a4a1a';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Dense overlapping circles (foliage)
  ctx.fillStyle = '#2d6b2d';
  const circles = [
    { x: 10, y: 12, r: 8 },
    { x: 26, y: 8, r: 9 },
    { x: 40, y: 14, r: 7 },
    { x: 8, y: 28, r: 7 },
    { x: 22, y: 24, r: 10 },
    { x: 38, y: 28, r: 8 },
    { x: 14, y: 40, r: 8 },
    { x: 30, y: 38, r: 9 },
    { x: 44, y: 40, r: 6 },
  ];
  for (const ci of circles) {
    ctx.beginPath();
    ctx.arc(ci.x, ci.y, ci.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Darker accents
  ctx.fillStyle = 'rgba(15, 50, 15, 0.4)';
  ctx.beginPath(); ctx.arc(18, 20, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(34, 34, 6, 0, Math.PI * 2); ctx.fill();

  save('jungle.png', c);
}

// --- DESERT ---
function generateDesert() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8a84b';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Wavy lines
  ctx.strokeStyle = '#b8943b';
  ctx.lineWidth = 1.5;
  for (let y = 10; y < SIZE; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(12, y - 4, 24, y);
    ctx.quadraticCurveTo(36, y + 4, 48, y);
    ctx.stroke();
  }

  // Small dune shape
  ctx.fillStyle = '#b89840';
  ctx.beginPath();
  ctx.moveTo(8, 38);
  ctx.quadraticCurveTo(24, 22, 40, 38);
  ctx.lineTo(8, 38);
  ctx.fill();

  save('desert.png', c);
}

// --- RUN ---
generateOcean();
generateCoast();
generatePlains();
generateForest();
generateMountain();
generateIce();
generateJungle();
generateDesert();
console.log('done — 8 terrain sprites generated');
