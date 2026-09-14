import { createCanvas } from 'canvas';
import { writeFileSync } from 'node:fs';
import { HexGridLayout } from '../src/systems/gridLayout/HexGridLayout';
import { drawMetropolis } from '../src/systems/rendering/MetropolisArtwork';
import { URBAN_SLOTS } from '../src/systems/UrbanDevelopment';
import { TileType, type MapData } from '../src/types/map';
const map:MapData={width:9,height:9,tileSize:64,tiles:Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>({x,y,type:TileType.Plains})))};
const grid=new HexGridLayout(),origin=grid.tileToWorld({x:4,y:4},map),size=grid.getTileRect({x:4,y:4},map).width;
const canvas=createCanvas(1100,700),ctx=canvas.getContext('2d');ctx.fillStyle='#253b37';ctx.fillRect(0,0,1100,700);
for(const [index,mask] of [0,19].entries()){
 const land=[{x:4,y:4},...URBAN_SLOTS.filter((_,i)=>!(mask&(1<<i))).map(s=>({x:4+s.dq,y:4+s.dr}))].map(c=>grid.getTileOutlinePoints(c,map).map(p=>({x:p.x-origin.x,y:p.y-origin.y})));
 ctx.save();ctx.translate(275+index*550,370);ctx.scale(2.5,2.5);drawMetropolis(ctx as unknown as CanvasRenderingContext2D,land,size);ctx.restore();
}
writeFileSync('/tmp/metropolis-preview.png',canvas.toBuffer('image/png'));
