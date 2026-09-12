import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.EPOCH_URL??'http://127.0.0.1:5174';
const save=JSON.parse(await fs.readFile(process.env.EPOCH_SAVE??'autorun-out/aqueducts-washed.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',args:['--no-sandbox']});
const results={};
try {
for(const mode of ['webgl','canvas'])for(const enabled of [true,false]){
 const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(mode==='canvas')await page.addInitScript(()=>{
  const original=WebGLRenderingContext.prototype.getExtension;
  WebGLRenderingContext.prototype.getExtension=function(name){return name==='ANGLE_instanced_arrays'?null:original.call(this,name);};
 });
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:`${await response.text()}\nwindow.testGame=game;`});});
 if(!enabled)await page.route('**/src/systems/rendering/AmbientSprites.ts*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:`${await response.text()}\nAmbientSprites.prototype.update=function() {};`});
 });
 await page.goto(base+'/?epochDiagnostics=1');
 await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:90000});
 assert.equal((await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save)).ok,true);
 await page.waitForFunction(()=>window.__epochDiagnostics?.getSaveState,undefined,{timeout:90000});
 await page.waitForTimeout(400);
 const check=await page.evaluate(()=>{
  const scene=window.testGame.scene.getScene('GameScene');
  const listeners=Array.isArray(scene.events._events.update)?scene.events._events.update:[scene.events._events.update];
  const a=listeners.find(e=>e.context.constructor.name==='AmbientSprites').context;
  const get=()=>{const s=window.__epochDiagnostics.getSaveState();return JSON.stringify([s.units,s.cities,s.tiles,s.turn,s.nations]);};
  const before=get();for(let i=0;i<200;i++)a.update(0,41);const unchanged=before===get();
  const state=window.__epochDiagnostics.getSaveState();window.oldAmbient=a;
  scene.scene.start('GameScene',{mapKey:state.mapKey,humanNationId:state.humanNationId,activeNationIds:state.activeNationIds,resourceAbundance:'normal',gameSpeedId:state.gameSpeedId,savedState:state});
  return {unchanged,units:state.units,cities:state.cities,turn:state.turn};
 });
 assert.ok(check.unchanged);
 await page.waitForFunction(()=>window.oldAmbient.disposed,undefined,{timeout:90000});
 await page.waitForFunction(()=>window.__epochDiagnostics?.getSaveState,undefined,{timeout:90000});
 await page.waitForTimeout(400);
 const after=await page.evaluate(()=>{
   const state=window.__epochDiagnostics.getSaveState();
   return {units:state.units,cities:state.cities,turn:state.turn,clean:window.oldAmbient.bindings.size===0&&window.oldAmbient.meshCount===0};
 });
 assert.ok(after.clean);
 results[`${mode}-${enabled}`]={before:check,after};
 assert.deepEqual(errors,[]);
 console.log(`${mode}, ambient ${enabled}: drawing preserves save state; scene restart cleans up.`);
 if(enabled&&mode==='webgl') {
  const autorun=await page.evaluate(async()=>{
   const result=await window.__epochDiagnostics.startAutoplay(1,{continueAfterVictory:true});
   return result.completedRounds;
  });
  assert.ok(autorun>=1);console.log('Autorun completed one round.');
 }
 await page.close();
}
for(const mode of ['webgl','canvas']){
 const on=results[`${mode}-true`],off=results[`${mode}-false`];
 for(const key of ['units','cities','turn']) {
  assert.deepEqual(on.before[key],off.before[key],`${mode} initial ${key} matches no-animation baseline`);
  assert.deepEqual(on.after[key],off.after[key],`${mode} reloaded ${key} matches no-animation baseline`);
 }
 console.log(`${mode}: loaded and reloaded gameplay matches the disabled-renderer control.`);
}
await fs.writeFile('/tmp/epoch-ambient-gameplay-checks.json',JSON.stringify({passed:true,modes:['webgl','canvas'],autorunRounds:1},null,2));
}finally{await browser.close();}
