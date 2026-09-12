import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from 'canvas';
// Real GameScene regression: normal renderers, real RAF clock, no forced profiles.

const output=process.env.EPOCH_TEST_OUTPUT??'/tmp/epoch-ambient-live';await fs.mkdir(output,{recursive:true});
const save=JSON.parse(await fs.readFile(process.env.EPOCH_SAVE??'autorun-out/aqueducts-washed.json','utf8'));
const specs=[['building','wind_turbine',47,35],['building','windmill',49,35],['improvement','oil_well',51,35],['building','factory',47,37],['wonder','great_lighthouse',49,37],['resource','cattle',45,35],['unit','worker',51,37]];
if(process.env.EPOCH_ART==='1')specs.push(['building','temple',46,36],['improvement','farm',48,36],['improvement','fishing_boats',47,39],['wonder','hoover-dam',49,39],['wonder','stonehenge',50,36]);
if(process.env.EPOCH_FIXTURE!=='0'){
 for(const [kind,id,x,y] of specs){const t=save.tiles.find(t=>t.q===x&&t.r===y);for(const k of ['buildingId','wonderId','improvementId','resourceId','buildingConstruction','wonderConstruction','improvementConstruction','buildingBroken'])delete t[k];t.terrainType=id==='fishing_boats'?'coast':'plains';t.ownerId='nation_canada';if(kind!=='unit')t[`${kind==='resource'?'resource':kind}Id`]=id;}
 save.units=save.units.filter(u=>!specs.some(([, ,x,y])=>u.tileX===x&&u.tileY===y));
 save.units.push({id:'ambient_live_worker',name:'Worker',ownerId:'nation_canada',unitTypeId:'worker',tileX:51,tileY:37,health:50,movementPoints:2,maxMovementPoints:2,createdRound:259,cargoUnitIds:[],isSleeping:false,actionStatus:'active',qualityLevel:1});
 save.cities[0].buildings.push('factory');
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:process.env.EPOCH_REDUCED==='1'?'reduce':'no-preference'});
 if(process.env.EPOCH_CANVAS==='1')await page.addInitScript(()=>{const get=WebGLRenderingContext.prototype.getExtension;WebGLRenderingContext.prototype.getExtension=function(n){return n==='ANGLE_instanced_arrays'?null:get.call(this,n);};});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();await route.fulfill({response,body:`${await response.text()}\nwindow.liveGame=game;`});});
 await page.goto(`${process.env.EPOCH_URL??'http://127.0.0.1:5176'}/?epochDiagnostics=1&zoom=${process.env.EPOCH_ZOOM??2.2}`);await page.waitForFunction(()=>window.__epochDiagnostics?.startSavedGame,undefined,{timeout:90000});
 console.log(await page.evaluate(s=>window.__epochDiagnostics.startSavedGame(s),save));
 await page.waitForFunction(()=>window.__epochDiagnostics?.focusFirstCity,undefined,{timeout:90000});
 for(let i=0;i<4;i++){const button=page.getByRole('button',{name:/^(Continue|Close|Got it|Do not participate)$/}).last();if(await button.isVisible())await button.click({force:true});await page.waitForTimeout(100);}
 await page.evaluate(()=>window.__epochDiagnostics.focusFirstCity(Number(new URLSearchParams(location.search).get('zoom')??2.2)));await page.waitForTimeout(1000);
 await page.evaluate(()=>{
 const scene=window.liveGame.scene.getScene('GameScene');const es=scene.events._events.update;
 const a=(Array.isArray(es)?es:[es]).find(e=>e.context.constructor.name==='AmbientSprites')?.context;
 window.liveAmbient=a;
 window.stats=()=>({wall:performance.now(),renderer:scene.renderer.type,elapsed:a.elapsed,enabled:a.isEnabled(),reduced:a.reducedMotion.matches,zoom:scene.cameras.main.zoom,view:scene.cameras.main.worldView,meshes:a.meshCount,bindings:a.bindings.size,atlases:[...a.rotorTextures],layers:[...a.layers].map(([depth,g])=>({depth,visible:g.visible,alpha:g.alpha,commands:g.commandBuffer.length})),objects:[...a.bindings].filter(b=>['tile_building_wind_turbine','tile_building_windmill','tile_building_factory','tile_wonder_great_lighthouse','improvement_oil_well','unit_worker','resource_cattle','tile_building_temple','improvement_farm','improvement_fishing_boats','tile_wonder_hoover-dam','tile_wonder_stonehenge','city_industrial','city_renaissance','city_medieval','city_modern','city_atomic'].includes(b.sprite.texture.key)).map(b=>({key:b.key,texture:b.sprite.texture.key,tile:b.tile(),visible:b.sprite.visible,parentVisible:b.sprite.parentContainer?.visible,canSee:a.canSee(...b.tile()),enabled:b.enabled(),profile:!!b.profile,mesh:!!b.mesh,drawing:b.drawing,tinted:b.sprite.isTinted,steps:b.sprite._renderSteps.map(f=>f.name),width:b.sprite.displayWidth,height:b.sprite.displayHeight,screen:(()=>{const m=b.sprite.getWorldTransformMatrix(),cam=scene.cameras.main;return {x:(m.tx-cam.worldView.x)*cam.zoom,y:(m.ty-cam.worldView.y)*cam.zoom};})(),canvasDraws:b.canvasDraws,meshDraws:b.meshDraws,imageDraws:b.imageDraws,stepCalls:b.stepCalls}))});
 const cd=a.drawCanvas.bind(a);a.drawCanvas=(b,...args)=>{b.canvasDraws=(b.canvasDraws??0)+1;return cd(b,...args);};
 for(const b of a.bindings){
 const index=b.kind==='improvement'?0:1;const step=b.sprite._renderSteps?.[index];if(!step)continue;
 b.stepCalls=0;b.imageDraws=0;b.meshDraws=0;
 b.sprite._renderSteps[index]=function(...args){b.stepCalls++;if(b.mesh&&!b.mesh.__counted){const draw=b.mesh._renderSteps[0];b.mesh._renderSteps[0]=function(...a){b.meshDraws++;return draw(...a);};b.mesh.__counted=true;}return step(...args);};
 const last=b.sprite._renderSteps.length-1,draw=b.sprite._renderSteps[last];b.sprite._renderSteps[last]=function(...args){b.imageDraws++;return draw(...args);};
 }
 });
 const before=await page.evaluate(()=>window.stats());await fs.writeFile(`${output}/before.json`,JSON.stringify(before,null,2));
 for(let i=0;i<9;i++){await page.waitForTimeout(1000);await page.screenshot({path:`${output}/frame-${i}.png`});}
 const after=await page.evaluate(()=>window.stats());await fs.writeFile(`${output}/after.json`,JSON.stringify(after,null,2));assert.deepEqual(errors,[]);
 assert.ok(after.enabled&&!after.reduced);
 assert.ok(Math.abs((after.elapsed-before.elapsed)-(after.wall-before.wall))<1000,'Visual clock follows real elapsed time');
 assert.ok(after.atlases.length>=2,'Derived rotor atlases are used');
 for(const id of ['wind_turbine','windmill','oil_well','worker']) {
  const b=after.objects.find(b=>b.texture.endsWith('_'+id));
  assert.ok(b?.profile&&b.canSee&&b.enabled);
  assert.ok((b.meshDraws??0)+(b.canvasDraws??0)>0,`${id} actually draws its replacement`);
  if(id!=='worker'&&after.renderer===2)assert.equal(b.imageDraws,0,'Source Image must not overdraw the mesh');
 }
 const frames=await Promise.all(Array.from({length:9},(_,i)=>loadImage(`${output}/frame-${i}.png`)));
 const selected=after.objects.filter(b=>specs.some(([, ,x,y])=>b.tile[0]===x&&b.tile[1]===y)||(process.env.EPOCH_ART==='1'&&b.texture.startsWith('city_')&&b.tile[0]===49&&b.tile[1]===34));
 const sheet=createCanvas(9*120,selected.length*120),ctx=sheet.getContext('2d');
 const differences={};let row=0;
 for(const b of selected){
  const c=createCanvas(60,60),g=c.getContext('2d'),pixels=[];
  for(const [i,frame] of frames.entries()){
   g.clearRect(0,0,60,60);g.drawImage(frame,b.screen.x-30,b.screen.y-36,60,60,0,0,60,60);
   pixels.push(g.getImageData(0,0,60,60).data);ctx.drawImage(c,i*120,row*120,120,120);
  }
  const changed=new Set();for(const p of pixels.slice(1))for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-pixels[0][i])+Math.abs(p[i+1]-pixels[0][i+1])+Math.abs(p[i+2]-pixels[0][i+2])>35)changed.add(i/4);
  differences[b.texture]=changed.size;assert.ok(changed.size>(b.texture==='tile_wonder_stonehenge'?0:5),`${b.texture}: actual rendered pixels change`);row++;
 }
 // These source-space regions must stay pinned even while the tool/head moves.
 // This rejects whole-sprite wobble, rather than merely accepting changed pixels.
 const anchored={unit_worker:[[.46,.10,.54,.19],[.45,.30,.55,.39],[.37,.79,.43,.88]],resource_cattle:[[.44,.78,.51,.85]],improvement_oil_well:[[.50,.45,.60,.57]],improvement_farm:[[.51,.28,.64,.39]]};
 const stablePixels={};
 for(const b of selected){
  const regions=anchored[b.texture];if(!regions)continue;
  let changes=0;
  for(const [x0,y0,x1,y1]of regions){
   const w=b.width*after.zoom,h=b.height*after.zoom;
   const x=Math.ceil(b.screen.x+(x0-.5)*w),y=Math.ceil(b.screen.y+(y0-.5)*h);
   const width=Math.max(1,Math.floor((x1-x0)*w)-1),height=Math.max(1,Math.floor((y1-y0)*h)-1);
   const c=createCanvas(width,height),g=c.getContext('2d');let reference;
   for(const frame of frames){g.drawImage(frame,-x,-y);const p=g.getImageData(0,0,width,height).data;
    if(!reference){reference=p;continue;}
    for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-reference[i])+Math.abs(p[i+1]-reference[i+1])+Math.abs(p[i+2]-reference[i+2])>20)changes++;
   }
  }
  stablePixels[b.texture]=changes;assert.equal(changes,0,`${b.texture}: grounded/structural pixels stay fixed`);
 }
 await fs.writeFile(`${output}/pixel-checks.json`,JSON.stringify({differences,stablePixels},null,2));
 await fs.writeFile(`${output}/contact.png`,sheet.toBuffer('image/png'));
 await fs.writeFile(`${output}/playback.html`,`<!doctype html><title>Epoch live ambient capture</title><p>Normal GameScene captures, one second or more apart. Each row is one real object; no animation clock overrides.</p><img id="frame" width="1200"><script>let i=0;setInterval(()=>document.getElementById('frame').src='frame-'+(i++%9)+'.png',700);</script><p>Contact sheet</p><img src="contact.png">`);
 console.log(JSON.stringify({renderer:after.renderer,clockMs:after.elapsed-before.elapsed,wallMs:after.wall-before.wall,changedPixels:differences,passed:true}));
}finally{await browser.close();}
