import { createCanvas } from 'canvas';
import { writeFileSync } from 'node:fs';
import { drawDock } from '../src/systems/rendering/DockArtwork';
for (const broken of [false,true]) {
  const canvas=createCanvas(256,256);
  drawDock(canvas.getContext('2d') as unknown as CanvasRenderingContext2D,broken);
  writeFileSync(`public/assets/sprites/buildings/dock${broken?'-broken':''}.png`,canvas.toBuffer('image/png'));
}
