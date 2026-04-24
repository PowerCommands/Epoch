import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from 'canvas';
import { NATURAL_RESOURCES } from '../src/data/naturalResources';

const OUTPUT_DIR = join(process.cwd(), 'public', 'assets', 'sprites', 'resources');
const SIZE = 64;

const CATEGORY_COLORS = {
  bonus: { fill: '#d9ad4f', stroke: '#5f4318' },
  luxury: { fill: '#b76de0', stroke: '#4f2769' },
  strategic: { fill: '#7b8794', stroke: '#28313a' },
} as const;

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const resource of NATURAL_RESOURCES) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const colors = CATEGORY_COLORS[resource.category];
  const initials = resource.name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  ctx.clearRect(0, 0, SIZE, SIZE);

  const gradient = ctx.createRadialGradient(24, 20, 6, 32, 34, 28);
  gradient.addColorStop(0, '#fff7cf');
  gradient.addColorStop(0.35, colors.fill);
  gradient.addColorStop(1, colors.stroke);

  ctx.beginPath();
  ctx.ellipse(32, 34, 24, 22, -0.18, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = colors.stroke;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(24, 22, 8, 5, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.fill();

  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(43, 33, 18, 0.88)';
  ctx.strokeText(initials, 32, 35);
  ctx.fillStyle = '#fff7cc';
  ctx.fillText(initials, 32, 35);

  writeFileSync(join(OUTPUT_DIR, `${resource.id}.png`), canvas.toBuffer('image/png'));
}

console.log(`Wrote ${NATURAL_RESOURCES.length} resource icon(s) to ${OUTPUT_DIR}.`);
