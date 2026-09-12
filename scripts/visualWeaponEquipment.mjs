import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const output=process.env.EPOCH_TEST_OUTPUT??'/tmp/epoch-equipment';
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

const ids=await page.evaluate(async()=>Object.keys((await import('/src/systems/rendering/WeaponEquipmentProfiles.ts')).WEAPON_EQUIPMENT_PROFILES));
await page.evaluate(()=>window.reviewGame.loop.stop());
for(const displaySize of [220,90]) {
 await page.evaluate(([ids,displaySize])=>{
  const s=window.reviewScene;
  window.reviewAmbientClass.forScene(s).shutdown();s.children.removeAll(true);
  const a=window.reviewAmbientClass.forScene(s);window.reviewAmbient=a;
  ids.forEach((id,i)=>{
   const x=200+i%3*400,y=170+Math.floor(i/3)*310;
   const sprite=s.add.image(x,y,'unit_'+id).setDisplaySize(displaySize,displaySize).setDepth(18);
   a.attach(sprite,'unit',id,()=>[i,0],()=>true,false);
   s.add.text(x,y+125,id,{fontSize:'13px',color:'#fff'}).setOrigin(.5).setDepth(30);
  });
  for(const b of a.bindings)b.seed=0;
 },[ids,displaySize]);
 let fixedBase;
 for(const phase of [.10,.32,.45,.47,.52,.58,.64,.74,.9]) {
  const checks=await page.evaluate(phase=>{
   const a=window.reviewAmbient;a.elapsed=phase*2600;a.lastDraw=-Infinity;a.update(0,0);
   const renderer=window.reviewGame.renderer;renderer.preRender();window.reviewScene.sys.render(renderer);renderer.postRender();
   return [...a.bindings].map(b=>({key:b.key,drawing:b.drawing,finite:b.mesh.vertices.every(Number.isFinite),base:b.mesh.vertices.slice(0,16)}));
  },phase);
  assert.ok(checks.every(c=>c.drawing&&c.finite),JSON.stringify(checks));
  if(fixedBase)assert.deepEqual(checks.map(c=>c.base),fixedBase,'wheels, frame and tripod must stay fixed');
  fixedBase=checks.map(c=>c.base);
  await page.screenshot({path:`${output}/equipment-${displaySize}-${phase}.png`});
 }
}
const projectileChecks=await page.evaluate(()=>{
 const a=window.reviewAmbient,bindings=[...a.bindings];
 const probe=(key,time,tracks=false)=>{
  const circles=[],triangles=[],lines=[];
  const g={fillStyle(){return this;},lineStyle(){return this;},
   fillCircle(...args){circles.push(args);return this;},
   fillTriangle(...args){triangles.push(args);return this;},
   lineBetween(...args){lines.push(args);return this;}};
  const binding=bindings.find(b=>b.key===key);
  if(tracks)a.drawTracks(g,binding,time,1);else a.drawWeaponShots(g,binding,time,1);
  return {circles,triangles,lines};
 };
 const release=.45*2.6;
 const positions=[0,.2,.4,.6].map(age=>probe('catapult',release+age).circles[0]);
 const dx=positions.slice(1).map((p,i)=>p[0]-positions[i][0]);
 const dy=positions.slice(1).map((p,i)=>p[1]-positions[i][1]);
 const shells=bindings.filter(b=>b.profile.shots?.[0].kind==='shell').every(b=>{
  const shots=[0,.2,.4,.6].map(age=>probe(b.key,release+age).lines[0]);
  const velocities=shots.slice(1).map((p,i)=>[p[0]-shots[i][0],p[1]-shots[i][1]]);
  return probe(b.key,release+.01).triangles.length>0 && velocities.every(v=>Math.hypot(v[0]-velocities[0][0],v[1]-velocities[0][1])<1e-6);
 });
 const tracks=['tank','modern_armor'].every(key=>{
  const before=probe(key,.1,true).lines,after=probe(key,.25,true).lines;
  return before.length>30 && after.flat().every(Number.isFinite) && JSON.stringify(before)!==JSON.stringify(after);
 });
 const landship=bindings.find(b=>b.key==='landship');
 const wheelVertices=[];
 for(const time of [0,.45]) {
  a.elapsed=time*1000;a.lastDraw=-Infinity;a.update(0,0);
  wheelVertices.push(landship.mesh.vertices.slice(32));
 }
 return {
  shells,tracks,wheels:JSON.stringify(wheelVertices[0])!==JSON.stringify(wheelVertices[1]),
  freeFlight:dx.every(v=>v<0&&Math.abs(v-dx[0])<1e-6)&&dy[1]>dy[0]&&dy[2]>dy[1],
  flames:[0,.16,.32,.48].every(age=>probe('machine_gun',release+age+.01).triangles.length>0),
  tracers:probe('machine_gun',release+.04).lines.length>0,
  pause:probe('machine_gun',release+.9).triangles.length===0,
 };
});
assert.ok(Object.values(projectileChecks).every(Boolean),JSON.stringify(projectileChecks));
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
console.log(`Reviewed ${ids.length} equipment profiles at 220px and 90px in nine animation phases.`);
} finally {await browser.close();}
