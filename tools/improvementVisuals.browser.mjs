import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:940,height:520}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${process.env.EPOCH_URL ?? 'http://127.0.0.1:5174'}/tools/improvement-visuals.html`);
 await page.waitForFunction(()=>window.visualChecks || document.body.dataset.error,{timeout:30000}).catch(error=>{throw new Error(errors.join('\n') || error.message)});
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Renderer assertions passed:', await page.evaluate(()=>window.visualChecks.length));
 await page.screenshot({path:'/tmp/epoch-improvements.png'});
 const base=process.env.EPOCH_URL ?? 'http://127.0.0.1:5174';
 await page.goto(`${base}/editor.html`);
 await page.waitForFunction(()=>window.EpochEditorResources?.improvements);
 const editorResult=await page.evaluate(()=>{
   const ids=window.EpochEditorResources.improvements.filter(d=>d.spriteKey).map(d=>d.id);
   const data=buildBlankScenario('Improvement preview',[],10,2,80,null);
   data.map.tiles=ids.map((id,q)=>({q,r:0,type:'plains',improvementId:id,improvementOwnerId:'test_owner'}));
   startEditor({key:'visual_test',file:'visual-test.json',label:'Improvement preview'},data);
   render();
   const output=buildScenarioOutput();
   return output.map.tiles.filter(t=>t.improvementId).map(t=>[t.improvementId,t.improvementOwnerId]);
 });
 assert.equal(editorResult.length,10);
 assert.ok(editorResult.every(t=>t[1]==='test_owner'));
 await page.waitForFunction(()=>[...improvementImages.values()].every(i=>i.complete && i.naturalWidth>0));
 console.log('Editor previews and ownership round trip passed');
 await page.route('**/src/main.ts*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:`${await response.text()}\nwindow.__visualGame=game;`});
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto(`${base}/?epochDiagnostics=1`);
 await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame);
 const save=JSON.parse(await fs.readFile('input/latest-save.json','utf8'));
 const started=await page.evaluate(state=>window.__epochDiagnostics.startSavedGame(state),save);
 assert.equal(started.ok,true,JSON.stringify(started));
 await page.waitForFunction(()=>window.__epochDiagnostics?.focusFirstCity);
 const gameChecks=await page.evaluate(()=>{
   const scene=window.__visualGame.scene.getScene('GameScene');
   const listeners=scene.events._events.shutdown;
   const renderer=(Array.isArray(listeners)?listeners:[listeners]).find(e=>e.context?.constructor.name==='TileImprovementOverlayRenderer').context;
   const saved=window.__epochDiagnostics.getSaveState();
   const count=saved.tiles.filter(t=>t.improvementId).length;
   const originalVisibility=renderer.visibilityPredicate;
   renderer.setVisibilityPredicate(()=>true);
   const rendered=[...renderer.overlays.values()].filter(o=>o.completed);
   const hasTextures=rendered.length===count && rendered.every(o=>!!o.sprite);
   const before=scene.children.length;
   const start=performance.now();
   for(let i=0;i<20;i++)renderer.rebuildAll();
   const ms=(performance.now()-start)/20;
   const stable=before===scene.children.length;
   renderer.setVisibilityPredicate(originalVisibility);
   return {count,hasTextures,stable,rebuildMs:ms};
 });
 assert.ok(gameChecks.count>0);
 assert.ok(gameChecks.hasTextures && gameChecks.stable);
 console.log('Existing save runtime:',gameChecks);
 await page.evaluate(()=>window.__epochDiagnostics.focusFirstCity(1.4));
 await page.waitForTimeout(500);

 assert.deepEqual(errors,[]);
} finally {await browser.close();}
