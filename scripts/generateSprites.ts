import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = join(__dirname, '..', 'public', 'assets', 'sprites');
const SIZE = 48;
const CX = SIZE / 2;
const CY = SIZE / 2;

function save(name: string, canvas: ReturnType<typeof createCanvas>) {
  const path = join(OUT, name);
  writeFileSync(path, canvas.toBuffer('image/png'));
  console.log(`wrote ${path}`);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeTintableGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  light = '#ffffff',
  mid = '#d9d9d9',
  dark = '#969696',
) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.55, mid);
  gradient.addColorStop(1, dark);
  return gradient;
}

function unitToken(): [ReturnType<typeof createCanvas>, CanvasRenderingContext2D] {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');

  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = makeTintableGradient(ctx, 12, 10, 36, 38);
  ctx.beginPath();
  ctx.arc(CX, CY, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = '#707070';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(CX - 2, CY - 2, 12, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();

  return [c, ctx];
}

function fillSymbol(ctx: CanvasRenderingContext2D, color = '#3d3d3d') {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function generateCity() {
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');

  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = makeTintableGradient(ctx, 11, 10, 37, 40, '#ffffff', '#dedede', '#a9a9a9');
  roundedRect(ctx, 12, 21, 24, 15, 4);
  ctx.fill();

  roundedRect(ctx, 8, 25, 12, 12, 3);
  ctx.fill();

  roundedRect(ctx, 28, 18, 12, 18, 3);
  ctx.fill();

  roundedRect(ctx, 18, 13, 12, 23, 3);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = '#747474';
  ctx.lineWidth = 1.6;
  for (const rect of [
    [12, 21, 24, 15, 4],
    [8, 25, 12, 12, 3],
    [28, 18, 12, 18, 3],
    [18, 13, 12, 23, 3],
  ] as const) {
    roundedRect(ctx, ...rect);
    ctx.stroke();
  }

  ctx.fillStyle = '#f8f8f8';
  for (const [x, y] of [[14, 25], [22, 25], [31, 22], [22, 17]]) {
    ctx.fillRect(x, y, 3, 4);
  }

  ctx.fillStyle = '#7f7f7f';
  roundedRect(ctx, 21, 28, 7, 8, 2);
  ctx.fill();

  save('city_default.png', c);
}

function generateWarrior() {
  const [c, ctx] = unitToken();
  fillSymbol(ctx);

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(CX + 6, CY - 13);
  ctx.lineTo(CX - 5, CY + 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CX + 4, CY - 14);
  ctx.lineTo(CX + 9, CY - 15);
  ctx.lineTo(CX + 8, CY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CX - 9, CY + 2);
  ctx.lineTo(CX + 1, CY + 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX - 7, CY + 8, 2.2, 0, Math.PI * 2);
  ctx.fill();

  save('unit_warrior.png', c);
}

function generateArcher() {
  const [c, ctx] = unitToken();
  fillSymbol(ctx);

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CX - 4, CY, 13, -Math.PI * 0.62, Math.PI * 0.62);
  ctx.stroke();

  ctx.strokeStyle = '#5f5f5f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX + 6, CY - 10);
  ctx.lineTo(CX + 6, CY + 10);
  ctx.stroke();

  ctx.strokeStyle = '#3d3d3d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(CX - 10, CY);
  ctx.lineTo(CX + 10, CY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CX + 13, CY);
  ctx.lineTo(CX + 7, CY - 4);
  ctx.lineTo(CX + 7, CY + 4);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX - 7, CY - 4);
  ctx.lineTo(CX - 3, CY);
  ctx.lineTo(CX - 7, CY + 4);
  ctx.stroke();

  save('unit_archer.png', c);
}

function generateCavalry() {
  const [c, ctx] = unitToken();
  fillSymbol(ctx);

  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(CX - 12, CY + 7);
  ctx.quadraticCurveTo(CX - 5, CY - 4, CX + 7, CY - 1);
  ctx.quadraticCurveTo(CX + 13, CY + 1, CX + 11, CY + 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(CX + 7, CY - 1);
  ctx.lineTo(CX + 12, CY - 10);
  ctx.lineTo(CX + 15, CY - 3);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 2.2;
  for (const x of [CX - 5, CX + 5]) {
    ctx.beginPath();
    ctx.moveTo(x, CY + 6);
    ctx.lineTo(x - 4, CY + 13);
    ctx.moveTo(x + 2, CY + 6);
    ctx.lineTo(x + 6, CY + 13);
    ctx.stroke();
  }

  ctx.strokeStyle = '#777777';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(CX - 12, CY + 6);
  ctx.quadraticCurveTo(CX - 17, CY + 3, CX - 14, CY - 2);
  ctx.stroke();

  save('unit_cavalry.png', c);
}

function generateSettler() {
  const [c, ctx] = unitToken();
  fillSymbol(ctx);

  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(CX + 8, CY - 12);
  ctx.lineTo(CX + 8, CY + 13);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX - 3, CY - 7, 4, 0, Math.PI * 2);
  ctx.fill();

  roundedRect(ctx, CX - 10, CY - 1, 13, 14, 3);
  ctx.fill();

  ctx.strokeStyle = '#777777';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX - 8, CY + 3);
  ctx.lineTo(CX + 2, CY + 3);
  ctx.moveTo(CX - 5, CY - 1);
  ctx.lineTo(CX - 8, CY - 8);
  ctx.stroke();

  ctx.fillStyle = '#4f4f4f';
  ctx.beginPath();
  ctx.moveTo(CX + 8, CY - 12);
  ctx.lineTo(CX + 14, CY - 8);
  ctx.lineTo(CX + 8, CY - 5);
  ctx.closePath();
  ctx.fill();

  save('unit_settler.png', c);
}

function generateTransportShip() {
  const [c, ctx] = unitToken();
  fillSymbol(ctx);

  ctx.beginPath();
  ctx.ellipse(CX, CY + 9, 16, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5b5b5b';
  roundedRect(ctx, CX - 9, CY + 2, 18, 7, 2);
  ctx.fill();

  ctx.strokeStyle = '#3d3d3d';
  ctx.lineWidth = 2;
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(CX + dx, CY + 4);
    ctx.lineTo(CX + dx, CY - 12);
    ctx.stroke();

    ctx.fillStyle = '#eeeeee';
    ctx.strokeStyle = '#6f6f6f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(CX + dx + 1, CY - 11);
    ctx.lineTo(CX + dx + 1, CY + 1);
    ctx.lineTo(CX + dx + 9, CY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#3d3d3d';
    ctx.lineWidth = 2;
  }

  save('unit_transport_ship.png', c);
}

generateCity();
generateWarrior();
generateArcher();
generateCavalry();
generateSettler();
generateTransportShip();
console.log('done - 6 sprites generated');
