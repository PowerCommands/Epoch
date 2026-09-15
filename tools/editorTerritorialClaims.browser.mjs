import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url=process.env.EPOCH_URL??'http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('epoch.tutorialDontShowAgain','true'));
 await page.goto(`${url}/editor.html`);
 await page.waitForFunction(()=>window.EpochTerritorialClaims && typeof startEditor==='function' && nationRegistry.nations.length);
 await page.evaluate(()=>{
   const data={meta:{name:'Editor Claims Test',version:1},map:{width:30,height:10,tileSize:64,tiles:Array.from({length:300},(_,i)=>({q:i%30,r:Math.floor(i/30),type:'plains'}))},
     nations:[{id:'nation_canada',name:'Canada',color:'#225588',isHuman:true,startTerritoryCenter:{q:2,r:2}},
       {id:'nation_usa',name:'USA',color:'#bb3322',isHuman:false,startTerritoryCenter:{q:21,r:5}}],
     cities:[{id:'canada_city',name:'Ottawa',nationId:'nation_canada',q:2,r:2,isCapital:true,ownedTileCoords:[{q:2,r:2},{q:3,r:2}]},
       {id:'usa_city',name:'Washington',nationId:'nation_usa',q:20,r:5,isCapital:true,ownedTileCoords:[{q:20,r:5},{q:21,r:5}]}],units:[]};
   startEditor({key:'test',label:'Editor Claims Test',file:'test.json'},data);
   tileResources[5][22]='iron';
   window.testOldOutput=buildScenarioOutput();
 });
 assert.equal(await page.evaluate(()=>buildScenarioOutput().map.tiles.some(t=>'territorialClaimNationId' in t)),false);
 const coast=await page.locator('#paint-coastline-btn').boundingBox();
 const claims=await page.locator('#paint-territorial-claims-btn').boundingBox();
 const palette=await page.locator('#palette').boundingBox();
 assert.ok(claims.y>=coast.y+coast.height && claims.y+claims.height<=palette.y);
 assert.equal(claims.width,coast.width);
 await page.click('#paint-territorial-claims-btn');
 assert.equal(await page.locator('#territorial-claim-controls').isVisible(),true);
 async function tilePoint(q,r) {return page.evaluate(({q,r})=>{const p=worldToScreen(tileToWorld(q,r));const rect=canvas.getBoundingClientRect();return{x:rect.left+p.x,y:rect.top+p.y};},{q,r});}
 async function paint(q,r) {const p=await tilePoint(q,r);await page.mouse.click(p.x,p.y);}
 // A real drag is a single history transaction, on land far from every city.
 const from=await tilePoint(27,8),to=await tilePoint(29,8);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:20});await page.mouse.up();
 assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),'nation_canada');
 await page.click('#undo-btn');assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),undefined);
 await page.click('#redo-btn');assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),'nation_canada');
 await page.selectOption('#territorial-claim-nation','nation_usa');await paint(29,8);
 assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),'nation_usa');
 await page.click('#erase-territorial-claims-btn');await paint(29,8);
 assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),undefined);
 await page.click('#undo-btn');assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),'nation_usa');
 await page.selectOption('#territorial-claim-nation','nation_canada');
 await paint(22,5);await paint(22,4);await paint(2,2);
 assert.equal(await page.evaluate(()=>getAuthoredClaim(2,2)),undefined);
 assert.equal(await page.evaluate(()=>getAuthoredClaim(22,5)),'nation_canada');
 // Inspect the actual preview drawing calls, excluding the normal black grid.
 const visual=await page.evaluate(()=>{
   const fills=[],strokes=[];const oldDraw=drawHex,oldStroke=strokeHex;
   drawHex=(q,r,color)=>{if(q===22&&r===5)fills.push({color,alpha:ctx.globalAlpha});return oldDraw(q,r,color);};
   strokeHex=(q,r,color,width)=>{if(q===22&&r===5)strokes.push(color);return oldStroke(q,r,color,width);};
   render();drawHex=oldDraw;strokeHex=oldStroke;
   return{fills,strokes};
 });
 assert.ok(visual.fills.some(f=>f.color==='#a7bbcf'&&f.alpha===0.4));
 assert.ok(visual.strokes.every(c=>c==='rgba(0,0,0,0.2)'),JSON.stringify(visual.strokes));
 await page.screenshot({path:'/tmp/epoch-editor-territorial-claims.png'});
 const output=await page.evaluate(()=>buildScenarioOutput());
 await page.evaluate(data=>startEditor({key:'test',label:'Reloaded',file:'test.json'},JSON.parse(JSON.stringify(data))),output);
 assert.equal(await page.evaluate(()=>getAuthoredClaim(22,5)),'nation_canada');
 assert.equal(await page.evaluate(()=>getAuthoredClaim(29,8)),'nation_usa');
 await page.evaluate(data=>localStorage.setItem('epoch.customScenarios',JSON.stringify({version:1,entries:[{metadata:{id:'custom-claims-test',name:'Editor Claims Test',createdAt:1,updatedAt:1},scenario:data}]})),output);
 await page.route('**/src/scenes/GameScene.ts*',async route=>{
   const response=await route.fetch();const body=(await response.text()).replace('unitActionToolbox.setClaimAvailabilityProvider(territorialClaimSystem);',
     'window.claimEditorRuntime={mapData,cityManager,cityTerritorySystem,unitManager,nationManager,territoryRenderer,historicalTimeline,movementSystem,pathfindingSystem,foundCitySystem,resourceAccessSystem,diplomacyManager}; unitActionToolbox.setClaimAvailabilityProvider(territorialClaimSystem);');
   await route.fulfill({response,body});
 });
 await page.goto(`${url}/?epochDiagnostics=1`);
 await page.waitForFunction(()=>window.__epochDiagnostics?.startNewGame,undefined,{timeout:90000});
 const started=await page.evaluate(()=>window.__epochDiagnostics.startNewGame({scenario:'custom-claims-test',humanNationId:'nation_canada'}));
 assert.equal(started.ok,true,JSON.stringify(started));
 await page.waitForFunction(()=>window.claimEditorRuntime,undefined,{timeout:90000});
 const runtime=await page.evaluate(async()=>{
   const h=window.claimEditorRuntime;const tile=h.mapData.tiles[5][22];
   const check=(v,msg)=>{if(!v)throw new Error(msg);};
   check(tile.territorialClaimNationId==='nation_canada'&&tile.ownerId===undefined,'startup keeps human claim independent');
   check(h.mapData.tiles[8][29].territorialClaimNationId==='nation_usa','AI-authored claims are preserved');
   const {WARRIOR}=await import('/src/data/units.ts');
   const unit=h.unitManager.createUnit({type:WARRIOR,ownerId:'nation_usa',tileX:21,tileY:5});
   check(!h.movementSystem.canUnitPeacefullyEnterTile(unit,tile),'AI respects borders');
   check(h.pathfindingSystem.findPath(unit,22,5,{respectMovementPoints:false})===null,'path respects borders');
   check(!h.resourceAccessSystem.hasOwnResource('nation_canada','iron'),'claim grants no resource access');
   h.diplomacyManager.toggleOpenBorders('nation_canada','nation_usa');
   check(h.movementSystem.canUnitPeacefullyEnterTile(unit,tile),'Open Borders permits entry');
   h.diplomacyManager.toggleOpenBorders('nation_canada','nation_usa');
   check(!h.foundCitySystem.isDiplomaticFoundingAllowed('nation_usa',22,5),'AI cannot found on claim');
   h.territoryRenderer.flush();
   check(![...h.territoryRenderer.activeSegments.values()].some(s=>s.tileX===22&&s.tileY===5),'no runtime claim border');
   const city=h.cityManager.getCity('usa_city');
   check(!city.ownedTileCoords.some(c=>c.x===22&&c.y===5),'claim is not city-owned');
   const count=h.historicalTimeline.getEvents().length;
   city.culture=10000;
   check(h.cityTerritorySystem.setNextExpansionTile(city,tile,h.mapData),'organic target available');
   check(h.cityTerritorySystem.tryClaimNextExpansionTile(city,h.mapData),'organic acquisition');
   const purchase=h.mapData.tiles[4][22];
   check(h.cityTerritorySystem.setNextExpansionTile(city,purchase,h.mapData),'purchase target available');
   check(h.cityTerritorySystem.claimNextExpansionTileImmediately(city,h.mapData),'purchase acquisition');
   check(tile.territorialClaimNationId===undefined&&purchase.territorialClaimNationId===undefined,'claims removed');
   check(h.historicalTimeline.getEvents().slice(count).filter(e=>e.text.includes('Territorial Claim Violated')).length===2,'both incidents recorded');
   return{startup:true,independentClaims:true,movement:true,founding:true,organicAcquisition:true,purchaseAcquisition:true,incidents:true};
 });
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({painting:true,erasing:true,nationSwitching:true,undoRedo:true,editorReload:true,rendering:true,oldScenario:true,...runtime}));
} finally {await browser.close();}
