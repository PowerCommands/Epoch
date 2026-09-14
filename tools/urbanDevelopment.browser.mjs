import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const coastMask=Number(process.env.COAST_MASK??0);
const url=process.env.EPOCH_URL??'http://127.0.0.1:5179';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.route('**/src/scenes/GameScene.ts*',async route=>{
    const response=await route.fetch();let body=await response.text();
    // Expose existing instances only in this test's intercepted source response.
    body=body.replace('    const openCityView = (city) => {', '    window.urbanTest = {cityManager, powerPlantSystem, nationManager, resourceAccessSystem, foundCitySystem, unitManager, cityView, productionSystem, buildingPlacementSystem, tileBuildingRenderer, cityRenderer, mapData, tileMap, scene:this, open: city => openCityView(city), close: () => closeOpenCityView(), select: city => selectionManager.selectCity(city)};\n    const openCityView = (city) => {');
    await route.fulfill({response,body});
  });
  await page.goto(url+'/?epochDiagnostics=1');
  await page.waitForFunction(()=>window.__epochDiagnostics?.startNewGame,undefined,{timeout:90000});
  console.log(await page.evaluate(()=>window.__epochDiagnostics.startNewGame({humanNationId:'nation_england'})));
  await page.waitForFunction(()=>window.urbanTest&&window.__epochDiagnostics?.getSaveState,undefined,{timeout:90000});
  const result=await page.evaluate(async(coastMask)=>{
    const r=window.urbanTest;
    const {getUrbanSlots,getSettlementStage}=await import('/src/systems/UrbanDevelopment.ts');
    const {getBuildingById}=await import('/src/data/buildings.ts');
    const settler=r.unitManager.getAllUnits().find(u=>u.ownerId==='nation_england'&&u.unitType.canFound);
    const {URBAN_SLOTS}=await import('/src/systems/UrbanDevelopment.ts');
    const {TileType}=await import('/src/types/map.ts');
    for(const [i,s] of URBAN_SLOTS.entries())r.mapData.tiles[settler.tileY+s.dr][settler.tileX+s.dq].type=(coastMask&(1<<i))?TileType.Coast:TileType.Plains;
    r.tileMap.rebuildTerrain();
    const city=r.cityManager.getCitiesByOwner('nation_england')[0]??r.foundCitySystem.foundCity(settler);
    if(!city)throw new Error('Could not found initial settlement');
    window.urbanCityId=city.id;
    const {ALL_TECHNOLOGIES}=await import('/src/data/technologies.ts');
    const nation=r.nationManager.getNation(city.ownerId);
    nation.researchedTechIds=ALL_TECHNOLOGIES.filter(t=>['ancient','classical','medieval'].includes(t.era)).map(t=>t.id);
    nation.unlockedCultureNodeIds.push('state_workforce');
    r.mapData.tiles[city.tileY][city.tileX].resourceId='iron';
    r.resourceAccessSystem.invalidateResourceIndex();
    r.cityRenderer.setVisibilityPredicate(()=>true);r.tileBuildingRenderer.setVisibilityPredicate(()=>true);
    for(const camera of r.scene.cameras.cameras)if(camera!==r.scene.cameras.main)camera.setVisible(false);
    const p=r.tileMap.tileToWorld(city.tileX,city.tileY);r.scene.cameras.main.centerOn(p.x,p.y);r.scene.cameras.main.setZoom(3);
    const initial=getSettlementStage(r.cityManager.getBuildings(city.id),city);
    const slots=getUrbanSlots(city);
    const {WORK_BOAT}=await import('/src/data/units.ts');
    if(r.productionSystem.getItemProductionBlockReason(city.id,{kind:'unit',unitType:WORK_BOAT})?.includes('Dock')!==true)throw new Error('Missing Dock did not block naval production');
    const granary=getBuildingById('granary');
    r.select(city);r.open(city);
    for(const callback of r.cityView.placementRequestCallbacks)callback(granary.id);
    if(r.buildingPlacementSystem.isActive() || r.productionSystem.getQueue(city.id).some(e=>e.item.kind==='building'&&e.item.buildingType.id===granary.id)) {
      throw new Error('Granary was offered a reserved urban slot');
    }
    r.close();
    for(const slot of slots){
      const tile=r.mapData.tiles[slot.y][slot.x];
      tile.buildingConstruction={cityId:city.id,buildingId:granary.id};
      r.productionSystem.enqueue(city.id,{kind:'building',buildingType:granary});
      const outcome=r.productionSystem.completeCurrentProduction(city.id);
      if(outcome.kind!=='blocked' || tile.buildingId || r.cityManager.getBuildings(city.id).has(granary.id)) {
        throw new Error('Granary bypassed urban reservation at '+slot.position);
      }
      r.productionSystem.clearProduction(city.id);
    }

    window.urbanCompletionOrder=[...slots].sort((a,b)=>Number(b.buildingId==='dock')-Number(a.buildingId==='dock'));
    for(const slot of window.urbanCompletionOrder.slice(0,2)){
      r.select(city);r.open(city);
      for(const callback of r.cityView.placementRequestCallbacks)callback(slot.buildingId);
      if(r.buildingPlacementSystem.isActive())throw new Error('Urban building opened manual placement');
      r.close();
      const outcome=r.productionSystem.completeCurrentProduction(city.id);
      if(outcome.kind!=='completed')throw new Error(slot.buildingId+': '+JSON.stringify(outcome)+' '+r.productionSystem.getItemProductionBlockReason(city.id,{kind:'building',buildingType:getBuildingById(slot.buildingId)}));
    }
    if(coastMask){
      const dock=slots.find(s=>s.buildingId==='dock');
      const {WORK_BOAT}=await import('/src/data/units.ts');
      for(let i=0;i<(slots.filter(s=>s.water).length>1?2:1);i++){
        const before=new Set(r.unitManager.getAllUnits().map(u=>u.id));
        r.productionSystem.enqueue(city.id,{kind:'unit',unitType:WORK_BOAT});
        const outcome=r.productionSystem.completeCurrentProduction(city.id);
        if(outcome.kind!=='completed')throw new Error('Naval completion: '+JSON.stringify(outcome));
        const ship=r.unitManager.getAllUnits().find(u=>!before.has(u.id));
        if(!ship||ship.unitType.id!==WORK_BOAT.id)throw new Error('No completed boat');
        if(i===0&&(ship.tileX!==dock.x||ship.tileY!==dock.y))throw new Error('Boat did not spawn at Dock');
        if(i===1&&(ship.tileX===dock.x&&ship.tileY===dock.y))throw new Error('Occupied Dock was reused');
      }
    }
    return {initial,slots,partial:window.__epochDiagnostics.getSaveState()};
  },coastMask);
  assert.equal(result.initial,'Village');
  await page.waitForTimeout(1000);
  for(let i=0;i<8;i++){ const close=page.getByRole('button',{name:/^(Close|Continue|Got it)$/}).last();if(await close.isVisible())await close.click({force:true});await page.waitForTimeout(100); }
  await page.addStyleTag({content:'body *:not(canvas):not(:has(canvas)) {visibility:hidden!important}'});
  await page.screenshot({path:'/tmp/epoch-urban-village.png'});
  await fs.writeFile('/tmp/epoch-urban-partial.json',JSON.stringify(result.partial));
  const final=await page.evaluate(async()=>{
    const r=window.urbanTest,city=r.cityManager.getCity(window.urbanCityId);
    const {getUrbanSlots,getSettlementStage}=await import('/src/systems/UrbanDevelopment.ts');
    const {getBuildingById}=await import('/src/data/buildings.ts');
    const stages=[];
    for(const slot of window.urbanCompletionOrder.slice(2)){
      r.productionSystem.enqueue(city.id,{kind:'building',buildingType:getBuildingById(slot.buildingId)});
      const outcome=r.productionSystem.completeCurrentProduction(city.id);
      if(outcome.kind!=='completed')throw new Error(slot.buildingId+': '+JSON.stringify(outcome)+' '+r.productionSystem.getItemProductionBlockReason(city.id,{kind:'building',buildingType:getBuildingById(slot.buildingId)}));
      stages.push(getSettlementStage(r.cityManager.getBuildings(city.id),city));
    }
    return {smokeCount:r.cityRenderer.urbanVisual.live.get(r.cityRenderer.getCityContainer(city.id))?.smoke.length ?? 0,capacity:r.powerPlantSystem.getCityPopulationCapacity(city.id),stages,save:window.__epochDiagnostics.getSaveState(),stage:r.cityRenderer.getCityContainer(city.id).getData('settlementStage'),
      sprites:getUrbanSlots(city).filter(s=>r.tileBuildingRenderer.sprites.has(`${s.x},${s.y}`)).length};
  });
  assert.equal(final.capacity,(coastMask&2)?13:15);assert.deepEqual(final.stages,['Village','Village','Village','Town']);assert.equal(final.stage,'Town');assert.equal(final.sprites,0);
  const cityNews=final.save.historicalTimeline.filter(e=>e.type==='cityDeveloped');
  assert.equal(cityNews.length,1);assert.equal(cityNews[0].metadata.firstCity,true);
  assert.equal(result.partial.historicalTimeline.filter(e=>e.type==='cityDeveloped').length,0);
  await fs.writeFile('/tmp/epoch-urban-complete.json',JSON.stringify(final.save));
  await page.waitForTimeout(1300);await page.screenshot({path:'/tmp/epoch-urban-city.png'});
  const detail=await page.evaluate(async()=>{
    const r=window.urbanTest,c=r.cityManager.getCity(window.urbanCityId);
    r.select(c);r.open(c);
    for(let i=0;i<80 && r.tileBuildingRenderer.sprites.size<6;i++)await new Promise(resolve=>setTimeout(resolve,100));
    const count=[...r.tileBuildingRenderer.sprites.values()].filter(s=>s.texture.key.startsWith('tile_building_')).length;
    const title=r.cityView.titleEl.textContent;
    r.close();
    return {count,title,stage:r.cityRenderer.getCityContainer(c.id).getData('settlementStage')};
  });
  assert.ok(detail.count>=6);assert.match(detail.title,/Town/);assert.equal(detail.stage,'Town');
  const artwork=await page.evaluate(()=>{const r=window.urbanTest;const key=r.scene.textures.getTextureKeys().find(k=>k.startsWith('urban-Town-'));return r.scene.textures.get(key).canvas.toDataURL();});
  await fs.writeFile('/tmp/epoch-urban-art.png',Buffer.from(artwork.split(',')[1],'base64'));
  // Capture the actual batched animation over the baked city at several times.
  const activityFrames=await page.evaluate(()=>{
    const r=window.urbanTest,visual=r.cityRenderer.urbanVisual;
    const container=r.cityRenderer.getCityContainer(window.urbanCityId);
    const sprite=container.list.find(child=>child.getData('urbanCity'));
    const canvas=sprite.texture.canvas,frames=[];
    for(const time of [10000,11800,13600]){
      visual.update(time);
      const source=visual.live.get(container).ink;
      const copy=r.scene.add.graphics().save().scaleCanvas(2,2).translateCanvas(canvas.width/4,canvas.height/4);
      copy.commandBuffer.push(...source.commandBuffer);copy.restore();
      copy.generateTexture('city-activity-capture',canvas.width,canvas.height);
      const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
      const ctx=output.getContext('2d');ctx.fillStyle='#98b477';ctx.fillRect(0,0,output.width,output.height);
      ctx.drawImage(canvas,0,0);ctx.drawImage(r.scene.textures.get('city-activity-capture').getSourceImage(),0,0);
      frames.push(output.toDataURL());copy.destroy();r.scene.textures.remove('city-activity-capture');
    }
    return frames;
  });
  assert.notEqual(activityFrames[0],activityFrames[1],'City ambient artwork changes over time');
  for(const [i,frame] of activityFrames.entries())await fs.writeFile(`/tmp/epoch-city-activity-${i}.png`,Buffer.from(frame.split(',')[1],'base64'));
  const performanceResult=await page.evaluate(async()=>{
    const r=window.urbanTest,visual=r.cityRenderer.urbanVisual;
    const {City}=await import('/src/entities/City.ts');
    const extra=[];const before=visual.live.size;
    const camera=r.scene.cameras.main, old={x:camera.worldView.x,y:camera.worldView.y,width:camera.worldView.width,height:camera.worldView.height};
    camera.worldView.setTo(-10000,-10000,100000,100000);
    for(let i=0;i<31;i++){
      const city=new City({id:'perf-'+i,name:'Test',ownerId:'nation_england',tileX:5+(i%8)*3,tileY:5+Math.floor(i/8)*3,urbanDevelopment:i%2?r.cityManager.getCity(window.urbanCityId).urbanDevelopment:undefined});
      const p=r.tileMap.tileToWorld(city.tileX,city.tileY);
      const container=r.scene.add.container(p.x,p.y,[visual.create(city, 'Town')]);visual.attach(container,city, 'Town');extra.push(container);
    }
    const samples=[];
    for(let i=0;i<180;i++){const start=performance.now();visual.update(i*16);samples.push(performance.now()-start);}
    samples.sort((a,b)=>a-b);
    const textures=r.scene.textures.getTextureKeys().filter(k=>k.startsWith('urban-Town-')).length;
    for(const container of extra)container.destroy();
    camera.worldView.setTo(old.x,old.y,old.width,old.height);
    return {cities:before+31,p95:samples[Math.floor(samples.length*.95)],textures,remaining:visual.live.size,before};
  });
  assert.equal(performanceResult.textures,coastMask?2:1);assert.equal(performanceResult.remaining,performanceResult.before);
  assert.ok(performanceResult.p95<8,JSON.stringify(performanceResult));console.log('Ambient CPU benchmark',performanceResult);
  const terrainVisuals=await page.evaluate(async()=>{
    const r=window.urbanTest,visual=r.cityRenderer.urbanVisual;
    const {City}=await import('/src/entities/City.ts');
    const {URBAN_SLOTS,MARITIME_URBAN_BUILDINGS}=await import('/src/systems/UrbanDevelopment.ts');
    const snapshot=JSON.stringify(r.mapData.tiles);
    const examples=[0,1,18,7,42,56], gallery=document.createElement('canvas');
    gallery.width=1200;gallery.height=760;const g=gallery.getContext('2d');
    const inside=(poly,p)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
    }return hit;};
    let variants=0,minOpenWater=1;
    for(let mask=0;mask<64;mask++){
      if(mask.toString(2).replaceAll('0','').length>3)continue;
      let maritime=0;
      const c=new City({id:'visual-'+mask,name:'Coastal',ownerId:'nation_england',tileX:20,tileY:20,
        urbanDevelopment:{waterMask:mask,requirements:URBAN_SLOTS.map((s,i)=>mask&(1<<i)?MARITIME_URBAN_BUILDINGS[maritime++]:s.buildingId)}});
      const sprite=visual.create(c, 'Town'),canvas=sprite.texture.canvas,ctx=canvas.getContext('2d');
      const origin=r.tileMap.tileToWorld(c.tileX,c.tileY),size=r.tileMap.getTileRect(c.tileX,c.tileY).width;
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const outlines=URBAN_SLOTS.map(s=>r.tileMap.getTileOutlinePoints(c.tileX+s.dq,c.tileY+s.dr)
        .map(p=>({x:p.x-origin.x,y:p.y-origin.y})));
      for(let i=0;i<6;i++)if(mask&(1<<i)){
        const poly=outlines[i];let count=0,open=0;
        const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y);
        for(let y=Math.min(...ys)+1;y<Math.max(...ys);y+=2)for(let x=Math.min(...xs)+1;x<Math.max(...xs);x+=2){
          if(!inside(poly,{x,y}))continue;count++;
          const px=Math.round(x*2+canvas.width/2),py=Math.round(y*2+canvas.height/2);
          if(pixels[(py*canvas.width+px)*4+3]<32)open++;
        }
        const fraction=open/count;minOpenWater=Math.min(minOpenWater,fraction);
        if(fraction<.55)throw new Error('Water covered for mask '+mask+' sector '+i+': '+fraction);
      }
      const index=examples.indexOf(mask);
      if(index!==-1){
        g.save();g.translate((index%3)*400+200,Math.floor(index/3)*380+190);
        g.fillStyle='#202b31';g.fillRect(-200,-190,400,380);
        const scale=340/(canvas.width/2);g.scale(scale,scale);
        const center=r.tileMap.getTileOutlinePoints(c.tileX,c.tileY).map(p=>({x:p.x-origin.x,y:p.y-origin.y}));
        for(const [i,poly] of [center,...outlines].entries()){
          g.beginPath();poly.forEach((p,j)=>j?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();
          g.fillStyle=i>0&&(mask&(1<<(i-1)))?'#387b95':'#8c9a6d';g.fill();
        }
        g.drawImage(canvas,-canvas.width/4,-canvas.height/4,canvas.width/2,canvas.height/2);
        g.restore();g.fillStyle='#efe1bd';g.font='16px sans-serif';g.fillText('Coast positions: '+(URBAN_SLOTS.flatMap((_,i)=>mask&(1<<i)?[i+1]:[]).join(', ')||'none'),(index%3)*400+18,Math.floor(index/3)*380+28);
      }
      sprite.destroy();variants++;
    }
    if(JSON.stringify(r.mapData.tiles)!==snapshot)throw new Error('Rendering mutated map terrain/state');
    return {variants,minOpenWater,gallery:gallery.toDataURL()};
  });
  assert.equal(terrainVisuals.variants,42);
  await fs.writeFile('/tmp/epoch-coastal-city-variants.png',Buffer.from(terrainVisuals.gallery.split(',')[1],'base64'));
  console.log('Terrain-aware rendering', {variants:terrainVisuals.variants,minOpenWater:terrainVisuals.minOpenWater});
  // Reload only the saves produced above through the actual application loader.
  for(const [state,stage] of [[result.partial,'Village'],[final.save,'Town']]) {
    await page.goto(url+'/?epochDiagnostics=1');
    await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:90000});
    const loaded=await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),state);assert.equal(loaded.ok,true,loaded.error);
    await page.waitForFunction(()=>window.urbanTest&&window.__epochDiagnostics?.getSaveState,undefined,{timeout:90000});
    const check=await page.evaluate(id=>{const r=window.urbanTest;return {smokeCount:r.cityRenderer.urbanVisual.live.get(r.cityRenderer.getCityContainer(id))?.smoke.length ?? 0,capacity:r.powerPlantSystem.getCityPopulationCapacity(id),stage:r.cityRenderer.getCityContainer(id).getData('settlementStage'),save:window.__epochDiagnostics.getSaveState()};},state.cities[0].id);
    if(stage==='Town')assert.equal(check.smokeCount,final.smokeCount,'Rendered chimney effects survive texture reuse on reload');
    assert.equal(check.stage,stage);assert.deepEqual(check.save.historicalTimeline.filter(e=>e.type==='cityDeveloped'),state.historicalTimeline.filter(e=>e.type==='cityDeveloped'));if(stage==='Town')assert.equal(check.capacity,final.capacity);assert.deepEqual(check.save.cities.map(c=>c.urbanDevelopment),state.cities.map(c=>c.urbanDevelopment));assert.deepEqual(check.save.cities.map(c=>c.buildings),state.cities.map(c=>c.buildings));
    assert.deepEqual(check.save.tiles.filter(t=>t.urbanSlot).map(t=>[t.q,t.r,t.urbanSlot,t.buildingId]),state.tiles.filter(t=>t.urbanSlot).map(t=>[t.q,t.r,t.urbanSlot,t.buildingId]));
    if(coastMask)await page.evaluate(async id=>{
      const r=window.urbanTest,c=r.cityManager.getCity(id);
      const {findFunctioningDock}=await import('/src/systems/NavalProduction.ts');
      const {WORK_BOAT}=await import('/src/data/units.ts');
      const dock=findFunctioningDock(c,r.cityManager.getBuildings(id),r.mapData);
      if(!dock)throw new Error('Dock functionality lost after reload');
      const occupant=r.unitManager.getUnitAt(dock.x,dock.y);
      if(occupant)r.unitManager.removeUnit(occupant.id);
      r.productionSystem.enqueue(id,{kind:'unit',unitType:WORK_BOAT});
      if(r.productionSystem.completeCurrentProduction(id).kind!=='completed')throw new Error('Reloaded Dock cannot produce');
      const boat=r.unitManager.getUnitAt(dock.x,dock.y);
      if(boat?.unitType.id!==WORK_BOAT.id)throw new Error('Reloaded ship did not launch from Dock');
    },state.cities[0].id);
  }
  const evolved = await page.evaluate(async () => {
    const r=window.urbanTest,c=r.cityManager.getAllCities().find(c=>c.settlementStage==='Town');
    const {ALL_TECHNOLOGIES}=await import('/src/data/technologies.ts');
    const {getBuildingById}=await import('/src/data/buildings.ts');
    const {CITY_DEVELOPMENT_BUILDINGS}=await import('/src/systems/UrbanDevelopment.ts');
    const {TileType}=await import('/src/types/map.ts');
    r.nationManager.getNation(c.ownerId).researchedTechIds=ALL_TECHNOLOGIES.map(t=>t.id);
    // Give the fixture six ordinary valid territory tiles, outside the urban footprint.
    for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++) {
      const t=r.mapData.tiles[c.tileY+dy]?.[c.tileX+dx];
      if(!t || t.urbanSlot || (dx===0&&dy===0) || t.buildingId || t.wonderId)continue;
      t.type=TileType.Plains;t.ownerId=c.ownerId;t.improvementId=undefined;t.resourceId='coal';
      if(!c.ownedTileCoords.some(p=>p.x===t.x&&p.y===t.y))c.ownedTileCoords.push({x:t.x,y:t.y});
    }
    r.resourceAccessSystem.invalidateResourceIndex();
    const footprint=JSON.stringify(r.mapData.tiles.flat().filter(t=>t.urbanSlot).map(t=>[t.x,t.y,t.urbanSlot]));
    for(const id of ['workshop',...CITY_DEVELOPMENT_BUILDINGS]) {
      const def=getBuildingById(id);
      r.buildingPlacementSystem.reserveFirstValidPlacement(c,def,r.mapData);
      r.productionSystem.enqueue(c.id,{kind:'building',buildingType:def});
      const result=r.productionSystem.completeCurrentProduction(c.id);
      if(result.kind!=='completed')throw new Error(id+': '+JSON.stringify(result));
    }
    if(footprint!==JSON.stringify(r.mapData.tiles.flat().filter(t=>t.urbanSlot).map(t=>[t.x,t.y,t.urbanSlot])))throw new Error('City enlarged its reserved footprint');
    r.cityRenderer.setVisibilityPredicate(()=>true);
    const container=r.cityRenderer.getCityContainer(c.id),sprite=container.list.find(child=>child.getData('urbanCity'));
    const visual=r.cityRenderer.urbanVisual;
    container.setVisible(true);
    const camera=r.scene.cameras.main;camera.setZoom(1.5);camera.centerOn(container.x,container.y);
    camera.worldView.setTo(container.x-1000,container.y-1000,2000,2000);
    const frames=[];
    for(const time of [0,3000,7000,12000,20000,27000]) {
      visual.update(time);
      const source=visual.live.get(container).ink,canvas=sprite.texture.canvas;
      const copy=r.scene.add.graphics().save().scaleCanvas(2,2).translateCanvas(canvas.width/4,canvas.height/4);
      copy.commandBuffer.push(...source.commandBuffer);copy.restore();
      copy.generateTexture('industrial-activity-capture',canvas.width,canvas.height);
      const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
      const ctx=output.getContext('2d');ctx.fillStyle='#98b477';ctx.fillRect(0,0,output.width,output.height);
      ctx.drawImage(canvas,0,0);ctx.drawImage(r.scene.textures.get('industrial-activity-capture').getSourceImage(),0,0);
      frames.push(output.toDataURL());copy.destroy();r.scene.textures.remove('industrial-activity-capture');
    }
    const result={stage:c.settlementStage,rendered:container.getData('settlementStage'),key:sprite.texture.key,frames,save:window.__epochDiagnostics.getSaveState()};
    r.open(c);
    return result;
  });
  assert.equal(evolved.stage,'City');assert.equal(evolved.rendered,'City');assert.ok(evolved.key.startsWith('urban-City-'));
  assert.ok(evolved.frames[0]!==evolved.frames[1], 'City ambient frame changes');
  for(const [i,frame] of evolved.frames.entries())await fs.writeFile(`/tmp/epoch-industrial-city-${i}.png`,Buffer.from(frame.split(',')[1],'base64'));
  await page.getByRole('button',{name:'Progress to next level'}).click();
  assert.equal(await page.locator('.development-requirements > div').count(),6);
  assert.equal(await page.locator('.development-map').count(),0);
  assert.match(await page.locator('.settlement-progress').innerText(),/City status is permanent/);
  await page.screenshot({path:'/tmp/epoch-city-progression.png'});
  await page.goto(url+'/?epochDiagnostics=1');
  await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame);
  assert.equal((await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),evolved.save)).ok,true);
  await page.waitForFunction(()=>window.urbanTest);
  assert.equal(await page.evaluate(()=>window.urbanTest.cityManager.getAllCities().some(c=>c.settlementStage==='City')),true);
  assert.deepEqual(errors,[]);console.log('PASS: real production, Village/Town/City rendering, progression and save-load');
} finally {await browser.close();}
