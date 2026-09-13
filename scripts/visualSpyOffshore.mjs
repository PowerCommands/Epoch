import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from 'canvas';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const output=process.env.EPOCH_TEST_OUTPUT??'/tmp/epoch-spy-offshore';
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
 s.cameras.main.setBackgroundColor('#245e7b');
 for(const [x,id,kind] of [[300,'spy','unit'],[850,'offshore_platform','improvement']]) {
  const sprite=s.add.image(x,470,(kind==='unit'?'unit_':'improvement_')+id).setDisplaySize(500,500).setDepth(kind==='unit'?18:5.7);
  if(kind==='unit') {
    const mask=s.make.graphics({x:0,y:0,add:false}).fillStyle(0xffffff).fillCircle(x,470,248);
    window.reviewSetClip(sprite,new window.reviewClip(mask));
  }
  a.attach(sprite,kind,id,()=>[0,0],()=>true,kind==='unit');
 }
 window.reviewGame.loop.stop();
});
const frames=[], captures=[];
for(const time of [0,1.2,1.65,3,6,10,14,16]) {
 const geometry=await page.evaluate(time=>{
  const a=window.reviewAmbient;
  for(const b of a.bindings)b.seed=0;
  a.elapsed=time*1000;a.lastDraw=-Infinity;a.update(0,0);
  const r=window.reviewGame.renderer;r.preRender();window.reviewScene.sys.render(r);r.postRender();
  const bindings=[...a.bindings];
  if(!bindings.every(b=>b.drawing&&b.mesh?.vertices.every(Number.isFinite)))throw Error('Animation mesh missing or invalid');
  return bindings.map(b=>Array.from(b.mesh.vertices));
 },time);
 frames.push(geometry);
 captures.push(await page.screenshot({path:`${output}/activity-${time}.png`}));
}
const pixels=async(buffer)=>{const c=createCanvas(1200,1000),g=c.getContext('2d');g.drawImage(await loadImage(buffer),0,0);return g.getImageData(0,0,1200,1000).data;};
const idle=await pixels(captures[0]),firing=await pixels(captures[1]),landed=await pixels(captures[4]);
let flash=0,platformChange=0;
for(let y=300;y<450;y++)for(let x=65;x<200;x++){const i=(y*1200+x)*4;if(firing[i]>210&&firing[i+1]>120&&firing[i+2]<130&&idle[i]<150)flash++;}
for(let y=260;y<610;y++)for(let x=595;x<1110;x++){const i=(y*1200+x)*4;if(Math.abs(idle[i]-landed[i])+Math.abs(idle[i+1]-landed[i+1])+Math.abs(idle[i+2]-landed[i+2])>50)platformChange++;}
assert.ok(flash>20,`missing visible muzzle flash: ${flash}`);
assert.ok(platformChange>1000,`missing rendered crane/helicopter motion: ${platformChange}`);
assert.notDeepEqual(frames[0][0],frames[1][0],'spy pistol must recoil');
assert.notDeepEqual(frames[0][1],frames[4][1],'platform crane and aircraft must move');
assert.deepEqual(frames[0][1],frames[7][1],'platform loop must return exactly to start');
await page.evaluate(()=>{
 const a=window.reviewAmbient;a.isEnabled=()=>false;a.lastDraw=-Infinity;a.update(0,0);
 if([...a.bindings].some(b=>b.drawing))throw Error('Animation must stop when disabled');
});
assert.deepEqual(errors,[]);
console.log('Spy recoil and offshore crane/helicopter loop render correctly; animation disabling is respected.');
} finally {await browser.close();}
