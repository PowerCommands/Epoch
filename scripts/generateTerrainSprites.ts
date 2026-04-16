import { createCanvas, CanvasGradient } from 'canvas';
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

function verticalGradient(
  ctx: CanvasRenderingContext2D,
  top: string,
  middle: string,
  bottom: string,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.55, middle);
  gradient.addColorStop(1, bottom);
  return gradient;
}

function softCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  inner: string,
  outer: string,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSoftWave(
  ctx: CanvasRenderingContext2D,
  y: number,
  amplitude: number,
  color: string,
  width = 1.2,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, y);
  ctx.bezierCurveTo(8, y - amplitude, 16, y + amplitude, 28, y);
  ctx.bezierCurveTo(38, y - amplitude, 44, y + amplitude, 52, y);
  ctx.stroke();
}

function fillCoastBase(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = verticalGradient(ctx, '#78cfdb', '#52b7d0', '#3ba2c5');
  ctx.fillRect(0, 0, SIZE, SIZE);

  softCircle(ctx, 14, 14, 22, 'rgba(211, 249, 241, 0.28)', 'rgba(211, 249, 241, 0)');
  softCircle(ctx, 40, 34, 24, 'rgba(31, 126, 171, 0.16)', 'rgba(31, 126, 171, 0)');

  drawSoftWave(ctx, 11, 1.6, 'rgba(239, 255, 250, 0.22)', 1);
  drawSoftWave(ctx, 25, 1.8, 'rgba(239, 255, 250, 0.18)', 1);
  drawSoftWave(ctx, 39, 1.4, 'rgba(239, 255, 250, 0.15)', 1);
}

function shorelineGradient(ctx: CanvasRenderingContext2D, direction: string): CanvasGradient {
  let gradient: CanvasGradient;
  if (direction === 'n') {
    gradient = ctx.createLinearGradient(0, 0, 0, 14);
  } else if (direction === 'e') {
    gradient = ctx.createLinearGradient(SIZE, 0, SIZE - 14, 0);
  } else if (direction === 's') {
    gradient = ctx.createLinearGradient(0, SIZE, 0, SIZE - 14);
  } else {
    gradient = ctx.createLinearGradient(0, 0, 14, 0);
  }

  gradient.addColorStop(0, 'rgba(239, 208, 139, 0.95)');
  gradient.addColorStop(0.48, 'rgba(222, 190, 119, 0.70)');
  gradient.addColorStop(1, 'rgba(222, 190, 119, 0)');
  return gradient;
}

function drawShorelineEdge(ctx: CanvasRenderingContext2D, direction: string) {
  ctx.fillStyle = shorelineGradient(ctx, direction);
  ctx.beginPath();

  if (direction === 'n') {
    ctx.moveTo(0, 0);
    ctx.lineTo(SIZE, 0);
    ctx.lineTo(SIZE, 9);
    ctx.bezierCurveTo(38, 12, 30, 7, 20, 10);
    ctx.bezierCurveTo(12, 13, 6, 9, 0, 11);
  } else if (direction === 'e') {
    ctx.moveTo(SIZE, 0);
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(SIZE - 10, SIZE);
    ctx.bezierCurveTo(SIZE - 13, 37, SIZE - 8, 29, SIZE - 11, 20);
    ctx.bezierCurveTo(SIZE - 14, 12, SIZE - 10, 6, SIZE - 12, 0);
  } else if (direction === 's') {
    ctx.moveTo(SIZE, SIZE);
    ctx.lineTo(0, SIZE);
    ctx.lineTo(0, SIZE - 10);
    ctx.bezierCurveTo(10, SIZE - 13, 18, SIZE - 8, 28, SIZE - 11);
    ctx.bezierCurveTo(37, SIZE - 14, 42, SIZE - 10, SIZE, SIZE - 12);
  } else {
    ctx.moveTo(0, SIZE);
    ctx.lineTo(0, 0);
    ctx.lineTo(10, 0);
    ctx.bezierCurveTo(13, 10, 8, 19, 11, 28);
    ctx.bezierCurveTo(14, 37, 10, 42, 12, SIZE);
  }

  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 245, 195, 0.36)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (direction === 'n') {
    ctx.moveTo(2, 10);
    ctx.bezierCurveTo(11, 13, 18, 8, 28, 10);
    ctx.bezierCurveTo(37, 12, 42, 8, 47, 9);
  } else if (direction === 'e') {
    ctx.moveTo(38, 2);
    ctx.bezierCurveTo(41, 12, 37, 19, 39, 28);
    ctx.bezierCurveTo(41, 36, 37, 42, 39, 47);
  } else if (direction === 's') {
    ctx.moveTo(2, 38);
    ctx.bezierCurveTo(12, 41, 19, 37, 28, 39);
    ctx.bezierCurveTo(37, 41, 43, 37, 47, 39);
  } else {
    ctx.moveTo(10, 2);
    ctx.bezierCurveTo(13, 12, 8, 19, 10, 28);
    ctx.bezierCurveTo(12, 37, 8, 42, 9, 47);
  }
  ctx.stroke();
}

function generateOcean() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#244f7a', '#173f68', '#0f3157');
  ctx.fillRect(0, 0, SIZE, SIZE);

  softCircle(ctx, 10, 10, 20, 'rgba(91, 151, 194, 0.20)', 'rgba(91, 151, 194, 0)');
  softCircle(ctx, 38, 36, 24, 'rgba(6, 31, 61, 0.28)', 'rgba(6, 31, 61, 0)');

  drawSoftWave(ctx, 12, 2, 'rgba(180, 217, 236, 0.18)');
  drawSoftWave(ctx, 27, 2, 'rgba(180, 217, 236, 0.16)');
  drawSoftWave(ctx, 40, 1.5, 'rgba(180, 217, 236, 0.12)');

  save('ocean.png', c);
}

function generateCoast() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  fillCoastBase(ctx);
  save('coast.png', c);
}

function generateCoastVariant(suffix: string) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  fillCoastBase(ctx);

  for (const direction of suffix) {
    drawShorelineEdge(ctx, direction);
  }

  save(`coast_${suffix}.png`, c);
}

function generatePlains() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#8fc56b', '#6fae58', '#5b984a');
  ctx.fillRect(0, 0, SIZE, SIZE);

  softCircle(ctx, 10, 12, 18, 'rgba(191, 222, 128, 0.24)', 'rgba(191, 222, 128, 0)');
  softCircle(ctx, 38, 38, 20, 'rgba(57, 124, 56, 0.16)', 'rgba(57, 124, 56, 0)');

  ctx.strokeStyle = 'rgba(235, 246, 165, 0.20)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  for (const y of [13, 24, 35]) {
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.quadraticCurveTo(15, y - 2, 27, y);
    ctx.quadraticCurveTo(37, y + 2, 44, y);
    ctx.stroke();
  }

  save('plains.png', c);
}

function generateForest() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#5a9b49', '#3f7d3a', '#2f6730');
  ctx.fillRect(0, 0, SIZE, SIZE);

  const clusters = [
    [8, 14, 8, '#4f9144'],
    [19, 11, 10, '#2f6c35'],
    [32, 14, 9, '#4d8a3c'],
    [41, 23, 8, '#2e6b35'],
    [12, 31, 10, '#376f36'],
    [27, 29, 12, '#4e8c3f'],
    [38, 38, 9, '#2f6331'],
  ] as const;
  for (const [x, y, radius, color] of clusters) {
    softCircle(ctx, x, y, radius, color, 'rgba(29, 82, 37, 0)');
  }

  ctx.fillStyle = 'rgba(25, 65, 31, 0.30)';
  for (const [x, y] of [[14, 20], [25, 18], [34, 30], [20, 38]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 7, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  save('forest.png', c);
}

function generateJungle() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#397b3a', '#256331', '#164b27');
  ctx.fillRect(0, 0, SIZE, SIZE);

  const leaves = [
    [6, 11, 10, '#2c7b35'],
    [18, 8, 12, '#1f6530'],
    [32, 11, 13, '#32813a'],
    [44, 18, 11, '#1b5b2d'],
    [10, 28, 13, '#2d7b37'],
    [24, 25, 15, '#185126'],
    [39, 30, 14, '#2b7335'],
    [18, 43, 12, '#1b5b2a'],
    [35, 43, 13, '#2f7d37'],
  ] as const;
  for (const [x, y, radius, color] of leaves) {
    softCircle(ctx, x, y, radius, color, 'rgba(7, 50, 24, 0)');
  }

  ctx.strokeStyle = 'rgba(147, 198, 88, 0.18)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [x, y, length, angle] of [[12, 19, 12, -0.4], [31, 19, 13, 0.5], [23, 35, 14, -0.8]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  save('jungle.png', c);
}

function generateMountain() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#a69b84', '#847c70', '#6a625b');
  ctx.fillRect(0, 0, SIZE, SIZE);

  const mountainGradient = ctx.createLinearGradient(8, 8, 42, 43);
  mountainGradient.addColorStop(0, '#d1c5ae');
  mountainGradient.addColorStop(0.45, '#8a8175');
  mountainGradient.addColorStop(1, '#4f4b48');

  ctx.fillStyle = mountainGradient;
  ctx.beginPath();
  ctx.moveTo(19, 8);
  ctx.lineTo(3, 42);
  ctx.lineTo(34, 42);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(34, 13);
  ctx.lineTo(19, 42);
  ctx.lineTo(47, 42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(246, 248, 243, 0.80)';
  ctx.beginPath();
  ctx.moveTo(19, 8);
  ctx.lineTo(14, 20);
  ctx.lineTo(20, 17);
  ctx.lineTo(24, 22);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(34, 13);
  ctx.lineTo(29, 24);
  ctx.lineTo(35, 21);
  ctx.lineTo(39, 25);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(19, 10);
  ctx.lineTo(11, 40);
  ctx.moveTo(34, 15);
  ctx.lineTo(26, 40);
  ctx.stroke();

  save('mountain.png', c);
}

function generateDesert() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#e8c574', '#d8ad5c', '#bd8f43');
  ctx.fillRect(0, 0, SIZE, SIZE);

  softCircle(ctx, 12, 13, 18, 'rgba(255, 226, 145, 0.24)', 'rgba(255, 226, 145, 0)');
  softCircle(ctx, 40, 38, 20, 'rgba(171, 114, 50, 0.15)', 'rgba(171, 114, 50, 0)');

  ctx.strokeStyle = 'rgba(255, 238, 178, 0.24)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (const y of [12, 25, 38]) {
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.quadraticCurveTo(14, y - 5, 25, y - 1);
    ctx.quadraticCurveTo(36, y + 4, 47, y - 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(178, 125, 52, 0.20)';
  ctx.beginPath();
  ctx.moveTo(4, 39);
  ctx.quadraticCurveTo(22, 26, 44, 39);
  ctx.lineTo(4, 39);
  ctx.fill();

  save('desert.png', c);
}

function generateIce() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = verticalGradient(ctx, '#f4fbff', '#d8eef8', '#b8dce9');
  ctx.fillRect(0, 0, SIZE, SIZE);

  softCircle(ctx, 12, 10, 20, 'rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)');
  softCircle(ctx, 38, 37, 22, 'rgba(105, 178, 205, 0.14)', 'rgba(105, 178, 205, 0)');

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const points of [
    [[9, 14], [20, 10], [31, 16], [42, 12]],
    [[7, 31], [17, 25], [26, 31], [37, 26], [45, 31]],
    [[18, 42], [25, 35], [33, 42]],
  ]) {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(91, 159, 188, 0.22)';
  ctx.beginPath();
  ctx.moveTo(24, 7);
  ctx.lineTo(19, 22);
  ctx.lineTo(28, 31);
  ctx.lineTo(23, 44);
  ctx.stroke();

  save('ice.png', c);
}

generateOcean();
generateCoast();
for (const suffix of [
  'n',
  'e',
  's',
  'w',
  'ne',
  'ns',
  'nw',
  'es',
  'ew',
  'sw',
  'nes',
  'new',
  'nsw',
  'esw',
  'nesw',
]) {
  generateCoastVariant(suffix);
}
generatePlains();
generateForest();
generateMountain();
generateIce();
generateJungle();
generateDesert();
console.log('done - 23 terrain sprites generated');
