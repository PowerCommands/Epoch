import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const output=process.env.EPOCH_TEST_OUTPUT??'/tmp/epoch-foot-soldiers';
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
 window.reviewProfiles=AMBIENT_PROFILES;window.reviewAmbientClass=AmbientSprites;
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

const ids=await page.evaluate(async()=>Object.keys((await import('/src/systems/rendering/FootSoldierProfiles.ts')).FOOT_SOLDIER_PROFILES));
await page.evaluate(()=>window.reviewGame.loop.stop());
for(const displaySize of [180,90]) {
 await page.evaluate(([ids,displaySize])=>{
  const s=window.reviewScene;
  window.reviewAmbientClass.forScene(s).shutdown();s.children.removeAll(true);
  const a=window.reviewAmbientClass.forScene(s);window.reviewAmbient=a;
  ids.forEach((id,i)=>{
   const x=120+i%5*240,y=95+Math.floor(i/5)*195;
   const sprite=s.add.image(x,y,'unit_'+id).setDisplaySize(displaySize,displaySize).setDepth(18);
   a.attach(sprite,'unit',id,()=>[i,0],()=>true,false);
   s.add.text(x,y+90,id,{fontSize:'13px',color:'#fff'}).setOrigin(.5).setDepth(30);
  });
  for(const b of a.bindings)b.seed=0;
 },[ids,displaySize]);
 for(const phase of [.32,.45,.49,.60,.9]) {
  const checks=await page.evaluate(phase=>{
   const a=window.reviewAmbient;a.elapsed=phase*2600;a.lastDraw=-Infinity;a.update(0,0);
   const renderer=window.reviewGame.renderer;renderer.preRender();window.reviewScene.sys.render(renderer);renderer.postRender();
   return [...a.bindings].map(b=>({key:b.key,drawing:b.drawing,finite:b.mesh.vertices.every(Number.isFinite)}));
  },phase);
  assert.ok(checks.every(c=>c.drawing&&c.finite),JSON.stringify(checks));
  await page.screenshot({path:`${output}/soldiers-${displaySize}-${phase}.png`});
 }
}
const visibility=await page.evaluate(()=>{
 const a=window.reviewAmbient,s=window.reviewScene;
 s.cameras.main.setZoom(.75);a.lastDraw=-Infinity;a.update(0,0);
 const zoomed=[...a.bindings].every(b=>b.drawing);
 a.canSee=()=>false;a.lastDraw=-Infinity;a.update(0,0);
 const hidden=a.meshCount===0&&[...a.layers.values()].every(g=>g.commandBuffer.length<=1);
 a.canSee=()=>true;a.isEnabled=()=>false;a.lastDraw=-Infinity;a.update(0,0);
 return {zoomed,hidden,disabled:a.meshCount===0};
});
assert.ok(visibility.zoomed);assert.ok(visibility.hidden);assert.ok(visibility.disabled);
assert.deepEqual(errors,[]);
console.log(`Reviewed ${ids.length} armed unit profiles at 180px and 90px in five animation phases.`);
} finally {await browser.close();}
