import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url=process.argv[2]??'http://127.0.0.1:5179';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:900,height:700}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__construction_review',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'}));
  await page.goto(url+'/__construction_review');
  await page.evaluate(async()=>{
    const [{default:Phaser},{TileBuildingRenderer},{UnitRenderer},{Unit},{WORKER,WORK_BOAT},{AmbientSprites}]=await Promise.all([
      import('/node_modules/.vite/deps/phaser.js'),import('/src/systems/TileBuildingRenderer.ts'),import('/src/systems/UnitRenderer.ts'),
      import('/src/entities/Unit.ts'),import('/src/data/units.ts'),import('/src/systems/rendering/AmbientSprites.ts')]);
    const tiles=[[{x:0,y:0,type:'plains',buildingConstruction:{buildingId:'library',cityId:'a'}},{x:1,y:0,type:'coast',wonderConstruction:{wonderId:'great_lighthouse',cityId:'a'}}],
      [{x:0,y:1,type:'plains'},{x:1,y:1,type:'ocean'}]];
    const map={width:2,height:2,tileSize:240,tiles};
    const tileMap={tileToWorld:(x,y)=>({x:230+x*420,y:180+y*320}),getTileRect:()=>({width:280,height:280}),getTileOutlinePoints(x,y){const p=this.tileToWorld(x,y);return Array.from({length:6},(_,i)=>({x:p.x+155*Math.cos(Math.PI/3*i),y:p.y+155*Math.sin(Math.PI/3*i)}));}};
    const units=[new Unit({id:'worker',name:'Worker',ownerId:'a',tileX:0,tileY:1,unitType:WORKER}),new Unit({id:'boat',name:'Boat',ownerId:'a',tileX:1,tileY:1,unitType:WORK_BOAT})];
    units.forEach(u=>u.setBuildingImprovement({improvementId:'farm',tileX:u.tileX,tileY:u.tileY,progress:30,requiredProgress:100}));
    new Phaser.Game({type:Phaser.WEBGL,width:900,height:700,audio:{noAudio:true},scene:{
      preload(){
        for(const id of ['land','water'])this.load.image('construction_'+id,'/assets/sprites/construction/'+id+'.png');
        for(const id of ['worker','work_boat'])this.load.image('unit_'+id,'/assets/sprites/units/'+id+'.png');
        this.load.image('tile_building_library','/assets/sprites/buildings/library.png');
        this.load.image('tile_building_library-broken','/assets/sprites/buildings/library-broken.png');
      },
      create(){
        this.cameras.main.setBackgroundColor('#738b79');
        const buildings=new TileBuildingRenderer(this,tileMap,map,{});
        const manager={getAllUnits:()=>units,getUnit:id=>units.find(u=>u.id===id),onUnitChanged:()=>{}};
        const unitRenderer=new UnitRenderer(this,tileMap,manager,{getNation:()=>({color:0xffd64d,secondaryColor:0x466aa5})},map);
        window.review={scene:this,map,units,buildings,unitRenderer,ambient:AmbientSprites.forScene(this)};
      },
    }});
  });
  await page.waitForFunction(()=>window.review);
  await page.waitForTimeout(250);
  const initial=await page.evaluate(()=>{
    const r=window.review,a=r.ambient;a.update(0,100);
    return {buildings:[...r.buildings.sprites.values()].map(s=>s.texture.key),units:[...r.unitRenderer.visuals.values()].map(v=>v.sprite.texture.key),hammer:[...a.bindings].some(b=>b.profile?.parts?.[0]?.rhythm==='hammer'&&b.drawing),crane:[...a.bindings].some(b=>b.profile?.effects?.some(e=>e.kind==='crane'))};
  });
  assert.deepEqual(initial.buildings,['construction_land','construction_water']);
  assert.deepEqual(initial.units,['construction_land','construction_water']);assert.ok(initial.hammer&&initial.crane);
  await page.screenshot({path:'/tmp/epoch-construction-a.png'});
  await page.evaluate(()=>window.review.ambient.update(0,650));
  await page.screenshot({path:'/tmp/epoch-construction-b.png'});
  const transitions=await page.evaluate(()=>{
    const r=window.review,land=r.map.tiles[0][0],water=r.map.tiles[0][1];
    delete land.buildingConstruction;land.buildingId='library';r.buildings.refreshTile(0,0);
    const complete=r.buildings.sprites.get('0,0').texture.key==='tile_building_library';
    const enlargedLibrary=Math.abs(r.buildings.sprites.get('0,0').displayWidth-280*1.45)<.001;
    delete water.wonderConstruction;r.buildings.refreshTile(1,0);const cancelled=!r.buildings.sprites.has('1,0');
    land.buildingConstruction={buildingId:'library',cityId:'a'};r.buildings.refreshTile(0,0);
    const upgrade=r.buildings.sprites.get('0,0').texture.key==='construction_land';
    r.buildings.setVisibilityPredicate(()=>false);const hidden=r.buildings.sprites.size===0;
    r.buildings.setVisibilityPredicate(()=>true);
    r.units.forEach(u=>{u.actionStatus='active';u.buildAction=undefined;r.unitRenderer.refreshUnitVisual(u.id);});
    const restored=[...r.unitRenderer.visuals.values()].map(v=>v.sprite.texture.key).join(',')==='unit_worker,unit_work_boat';
    r.buildings.shutdown();
    const clean=[...r.ambient.bindings].every(b=>b.kind==='unit');
    return {complete,enlargedLibrary,cancelled,upgrade,hidden,restored,clean};
  });
  for(const [name,value] of Object.entries(transitions))assert.ok(value,name);
  assert.deepEqual(errors,[]);console.log({initial,transitions});
} finally {await browser.close();}
