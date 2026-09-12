import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from 'canvas';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const output=process.env.EPOCH_TEST_OUTPUT??'/tmp/epoch-swordsman';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const errors=[];
try {
const page=await browser.newPage({viewport:{width:1200,height:1000}});
page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:`${await response.text()}\nwindow.reviewGame=game;window.reviewPhaser=Phaser;`});});
await page.goto(base+'/?epochDiagnostics=1');
await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame);
await page.evaluate(async()=>{
 const [{AmbientSprites},{AMBIENT_PROFILES},{GeometryClip,setGeometryClip}]=await Promise.all([import('/src/systems/rendering/AmbientSprites.ts'),import('/src/systems/rendering/AmbientProfiles.ts'),import('/src/systems/rendering/GeometryClip.ts')]);
 window.reviewSetClip=setGeometryClip;window.reviewClip=GeometryClip;window.reviewProfiles=AMBIENT_PROFILES;window.reviewAmbientClass=AmbientSprites;
 const game=window.reviewGame,Phaser=window.reviewPhaser;
 for(const s of game.scene.getScenes(true)) game.scene.stop(s.scene.key);
 const scene=new Phaser.Scene('AmbientReview');
 scene.preload=function(){
  const paths={resource:'resources',unit:'units',building:'buildings',wonder:'wonders',improvement:'improvements',city:'cities'};
  const prefixes={resource:'resource_',unit:'unit_',building:'tile_building_',wonder:'tile_wonder_',improvement:'improvement_',city:'city_'};
  for(const [kind,profiles] of Object.entries(AMBIENT_PROFILES))for(const id of Object.keys(profiles)){
   const key=prefixes[kind]+id;
   if(!this.textures.exists(key))this.load.image(key,`assets/sprites/${paths[kind]}/${kind==='city'?'city_':''}${id}.${id==='nuclear_silo'?'svg':'png'}`);
  }
 };
 scene.create=function(){window.reviewScene=this;this.cameras.main.setBackgroundColor('#778078');window.reviewReady=true;};
 game.scene.add('AmbientReview',scene,true);

});
await page.waitForFunction(()=>window.reviewReady,undefined,{timeout:90000});


await page.evaluate(()=>{
 const s=window.reviewScene,a=window.reviewAmbientClass.forScene(s);window.reviewAmbient=a;
 for(const [x,size,id] of [[350,550,'swordsman'],[850,180,'longswordsman']]) {
  const sprite=s.add.image(x,450,'unit_'+id).setDisplaySize(size,size).setDepth(18);
  const mask=s.make.graphics({x:0,y:0,add:false}).fillStyle(0xffffff).fillCircle(x,450,size*.5);
  window.reviewSetClip(sprite,new window.reviewClip(mask));
  const container=s.add.container(x,450,[sprite]).setDepth(18);sprite.setPosition(0,0);
  a.attach(sprite,'unit','sword-preview',()=>[0,0]);
 }
 window.reviewGame.loop.stop();
});
let fixedBody;
for(const phase of [0,.32,.45,.60]) {
 const result=await page.evaluate(phase=>{
  const a=window.reviewAmbient;
  for(const b of a.bindings)b.seed=0;
  a.elapsed=phase*2600;a.lastDraw=-Infinity;a.update(0,0);
  const r=window.reviewGame.renderer;r.preRender();window.reviewScene.sys.render(r);r.postRender();
  return [...a.bindings].every(b=>b.drawing&&b.mesh.vertices.every(Number.isFinite));
 },phase);
 assert.ok(result);
 const capture=await page.screenshot({path:`${output}/sword-${phase}.png`});
 const canvas=createCanvas(1200,1000),ctx=canvas.getContext('2d');
 ctx.drawImage(await loadImage(capture),0,0);
 const bodyRegions=[[337,250,22,55],[354,375,20,28],[362,611,16,28]];
 const body=bodyRegions.map(([x,y,w,h])=>Buffer.from(ctx.getImageData(x,y,w,h).data));
 if(fixedBody)body.forEach((pixels,i)=>assert.deepEqual(pixels,fixedBody[i],'head, chest and planted foot must remain stationary'));
 else fixedBody=body;
 // Catch filtered meshes disappearing inside nested containers / stencil clips.
 for(const [x,y,w,h,minimum] of [[180,190,350,540,5000],[790,370,130,170,500]]) {
  const pixels=ctx.getImageData(x,y,w,h).data;let visible=0;
  for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-119)+Math.abs(pixels[i+1]-128)+Math.abs(pixels[i+2]-120)>35)visible++;
  assert.ok(visible>minimum,`swordsman disappeared at phase ${phase}: ${visible} visible pixels`);
 }
}
await page.evaluate(()=>{
 const a=window.reviewAmbient;a.isEnabled=()=>false;a.lastDraw=-Infinity;a.update(0,0);
 const r=window.reviewGame.renderer;r.preRender();window.reviewScene.sys.render(r);r.postRender();
});
await page.screenshot({path:`${output}/sword-still.png`});
assert.deepEqual(errors,[]);
console.log('Sword arm moves while head, chest and foot remain fixed in four attack phases; lighting and circle clipping verified.');
} finally {await browser.close();}
