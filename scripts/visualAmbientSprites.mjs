import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const output=process.env.EPOCH_TEST_OUTPUT??'/tmp/epoch-living-world';
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
 window.reviewGallery=(kind,start=0)=>{
  const s=window.reviewScene;
  AmbientSprites.forScene(s).shutdown();s.children.removeAll(true);
  const system=AmbientSprites.forScene(s);window.reviewAmbient=system;
  const prefixes={resource:'resource_',unit:'unit_',building:'tile_building_',wonder:'tile_wonder_',improvement:'improvement_',city:'city_'};
  const ids=Object.keys(AMBIENT_PROFILES[kind]).slice(start,start+25);
  ids.forEach((id,i)=>{
   const x=120+(i%5)*240,y=95+Math.floor(i/5)*190;
   const sprite=s.add.image(x,y,prefixes[kind]+id).setDisplaySize(160,160).setDepth(kind==='unit'?18:kind==='city'?19.6:kind==='resource'?5.5:kind==='improvement'?5.75:14);
   // Exercise the real public clipping hook as well as nested containers.
   const mask=s.make.graphics({x:0,y:0,add:false}).fillStyle(0xffffff).fillCircle(x,y,95);
   setGeometryClip(sprite,new GeometryClip(mask));sprite.once('destroy',()=>mask.destroy());
   if(i%2===0){const c=s.add.container(x,y,[sprite]).setDepth(sprite.depth);sprite.setPosition(0,0);}
   system.attach(sprite,kind,id,()=>[i,0]);
   s.add.text(x,y+83,id,{fontSize:'14px',color:'#fff'}).setOrigin(.5).setDepth(30);
  });
 };
});
await page.waitForFunction(()=>window.reviewReady,undefined,{timeout:90000});
for(const kind of (process.env.EPOCH_GALLERY_KINDS?.split(',')??['resource','improvement','unit','building','wonder','city'])){
 const length=await page.evaluate(k=>Object.keys(window.reviewProfiles[k]).length,kind);
 for(let start=0;start<length;start+=25){
 await page.evaluate(([k,i])=>window.reviewGallery(k,i),[kind,start]);
 await page.waitForTimeout(300);
 await page.screenshot({path:`${output}/${kind}-${start}-a.png`});
 await page.evaluate(()=>{for(let i=0;i<55;i++)window.reviewAmbient.update(0,80);});
 await page.screenshot({path:`${output}/${kind}-${start}-b.png`});
 }
}
const checks=await page.evaluate(()=>{
 window.reviewGallery('resource');const s=window.reviewScene,a=window.reviewAmbient;
 a.update(0,80);const before=a.bindings.size;
 const changed=[...a.bindings].filter(b=>b.mesh).length;
 const school=[...a.bindings].find(b=>b.profile?.school);
 const schoolBefore=[...school.mesh.vertices];
 a.update(0,200);
 const schoolMoves=school.mesh.vertices.some((v,i)=>v!==schoolBefore[i]);
 a.isEnabled=()=>false;a.update(0,80);
 const schoolStill=[...school.mesh.vertices];a.update(0,400);
 const schoolPaused=school.drawing&&school.mesh.vertices.every((v,i)=>v===schoolStill[i]);
 a.isEnabled=()=>true;
 a.canSee=()=>false;a.update(0,80);
 const hidden=[...a.layers.values()].every(g=>g.commandBuffer.length<=1)&&a.meshCount===0;
 a.canSee=()=>true;s.cameras.main.setZoom(.4);a.update(0,80);
 const overview=[...a.bindings].every(b=>!b.mesh||b.profile?.school);
 s.cameras.main.setZoom(1);a.update(0,80);
 for(const b of [...a.bindings].slice(0,10))b.sprite.destroy();
 const released=a.bindings.size===before-10;
 a.shutdown();a.shutdown();
 return {changed,schoolMoves,schoolPaused,hidden,overview,released,meshCount:a.meshCount,bindings:a.bindings.size,layers:a.layers.size};
});
assert.ok(checks.changed>0);assert.ok(checks.schoolMoves);assert.ok(checks.schoolPaused);assert.ok(checks.hidden);assert.ok(checks.overview);assert.ok(checks.released);assert.equal(checks.meshCount,0);assert.equal(checks.bindings,0);assert.equal(checks.layers,0);
const stress=await page.evaluate(()=>{
 const s=window.reviewScene;window.reviewAmbient.shutdown();s.children.removeAll(true);
 const a=window.reviewAmbientClass.forScene(s);
 for(let i=0;i<1000;i++) {
   const sprite=s.add.image(20+(i%40)*29,20+Math.floor(i/40)*36,i%2?'resource_cattle':'resource_natural_gas').setDisplaySize(28,28).setDepth(5.5);
   a.attach(sprite,'resource',`stress:${i}`,()=>[i,0],()=>true,false);
 }
 a.update(0,80);
 const positions=JSON.stringify([...a.bindings].map(b=>[b.sprite.x,b.sprite.y,b.sprite.scaleX,b.sprite.scaleY,b.sprite.texture.key]));
 const times=[];
 for(let i=0;i<120;i++){const start=performance.now();a.update(0,41);times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 const stable=positions===JSON.stringify([...a.bindings].map(b=>[b.sprite.x,b.sprite.y,b.sprite.scaleX,b.sprite.scaleY,b.sprite.texture.key]));
 const result={objects:a.bindings.size,meshes:a.meshCount,medianMs:times[60],p95Ms:times[114],stable};
 // A changed texture must discard the old deformation immediately at refresh.
 const first=[...a.bindings].find(b=>b.mesh);first.sprite.setTexture('resource_stone');a.refreshVisibility();
 result.textureChange=!first.mesh&&!first.profile.joints;
 const elapsed=a.elapsed;s.scene.pause();window.reviewPause={a,elapsed};return result;
});
await page.waitForTimeout(200);
assert.equal(await page.evaluate(()=>window.reviewPause.a.elapsed===window.reviewPause.elapsed),true,'scene pause freezes ambient time');
await page.evaluate(()=>window.reviewScene.scene.resume());
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.reviewPause.a.elapsed>window.reviewPause.elapsed),true,'scene resume advances ambient time');
await page.evaluate(()=>window.reviewScene.scene.stop());
await page.waitForFunction(()=>window.reviewPause.a.disposed);
const shutdown=await page.evaluate(()=>{const a=window.reviewPause.a;return a.bindings.size===0&&a.meshCount===0&&a.layers.size===0;});
assert.ok(shutdown);assert.ok(stress.stable);assert.ok(stress.textureChange);assert.ok(stress.meshes<=192);assert.equal(stress.objects,1000);
await fs.writeFile(`${output}/stress-checks.json`,JSON.stringify(stress,null,2));console.log(stress);
assert.deepEqual(errors,[]);
await fs.writeFile(`${output}/gallery-checks.json`,JSON.stringify(checks,null,2));console.log(checks);
}finally{await browser.close();}
