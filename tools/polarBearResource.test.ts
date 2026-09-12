import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createCanvas, loadImage } from 'canvas';
import { getNaturalResourceById, isResourceAllowedOnTile } from '../src/data/naturalResources';
import { PASTURE } from '../src/data/improvements';
import { generateNaturalResources } from '../src/systems/NaturalResourceSystem';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { polarBearWalkOffset, POLAR_BEAR_WALK_PERIOD } from '../src/systems/rendering/PolarBearWalk';
import { TileType, type MapData } from '../src/types/map';
import type { ScenarioData } from '../src/types/scenario';

test('Polar Bear is an ice-only luxury with a usable improvement and editor entry', () => {
  const resource=getNaturalResourceById('polar_bear')!;
  assert.equal(resource.category,'luxury');
  for(const tile of Object.values(TileType)) assert.equal(isResourceAllowedOnTile(resource.id,tile),tile===TileType.Ice);
  assert.equal(resource.improvementId,PASTURE.id);
  assert.ok(PASTURE.allowedTileTypes.includes(TileType.Ice));
  const manifest=JSON.parse(readFileSync('public/assets/data/natural-resources-manifest.json','utf8'));
  const entry=manifest.resources.find((r:{id:string})=>r.id===resource.id);
  assert.deepEqual(entry.allowedTileTypes,['ice']);
  assert.equal(entry.iconPath,'/assets/sprites/resources/polar_bear.png');
});

test('procedural bears spawn on ice and scenario-authored bears survive loading', () => {
  const map:MapData={width:40,height:40,tileSize:32,tiles:Array.from({length:40},(_,y)=>Array.from({length:40},(_,x)=>({x,y,type:x<20?TileType.Ice:TileType.Plains})))};
  generateNaturalResources(map,{mapKey:'polar-test',activeNationIds:['a'],humanNationId:'a',resourceAbundance:'abundant',cityCoords:[],worldSeed:'polar-bears'});
  const bears=map.tiles.flat().filter(t=>t.resourceId==='polar_bear');
  assert.ok(bears.length>0);
  assert.ok(bears.every(t=>t.type===TileType.Ice));
  const scenario={meta:{name:'Polar test',version:1},map:{width:1,height:1,tileSize:48,tiles:[{q:0,r:0,type:'ice',resourceId:'polar_bear'}]},nations:[],cities:[],units:[]} as ScenarioData;
  assert.equal(ScenarioLoader.parse(scenario).mapData.tiles[0][0].resourceId,'polar_bear');
});

test('bear paws alternate and the walk loops without drifting', () => {
  const a=polarBearWalkOffset(.36,.73,POLAR_BEAR_WALK_PERIOD/4,0);
  const b=polarBearWalkOffset(.79,.73,POLAR_BEAR_WALK_PERIOD/4,0);
  assert.ok(a[0]>.03&&b[0]<-.03);
  for(const [u,v] of [[.36,.73],[.79,.73],[.5,.4],[.9,.45]]) {
    const start=polarBearWalkOffset(u,v,.3,.4),end=polarBearWalkOffset(u,v,.3+POLAR_BEAR_WALK_PERIOD,.4);
    assert.ok(Math.abs(start[0]-end[0])<1e-10&&Math.abs(start[1]-end[1])<1e-10);
  }
  assert.equal(polarBearWalkOffset(.5,.4,1,0)[0],0,'torso does not move forward');
});

test('polar bear artwork contains a transparent background and visible pixels', async () => {
  const image=await loadImage('public/assets/sprites/resources/polar_bear.png');
  const canvas=createCanvas(64,64),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,64,64);
  const pixels=ctx.getImageData(0,0,64,64).data;
  let clear=0,opaque=0;
  for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>200)opaque++;}
  assert.ok(clear>1000&&opaque>200);
});
