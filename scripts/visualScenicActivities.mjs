import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const output='/tmp/epoch-scenic';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1400,height:470},reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/scenic-review',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0">'}));
 await page.goto((process.env.EPOCH_URL??'http://127.0.0.1:5174')+'/scenic-review');
 await page.evaluate(async()=>{
  const {default:Phaser}=await import('/node_modules/phaser/dist/phaser.esm.js');
  const {AmbientSprites}=await import('/src/systems/rendering/AmbientSprites.ts');
  const entries=[['improvement','lumber_mill'],['wonder','taj-mahal'],['building','garden'],['improvement','farm'],['wonder','great_wall'],['building','opera_house'],['building','dock']];
  const scene=new Phaser.Scene('review');
  scene.preload=function(){for(const [kind,id] of entries)this.load.image(`${kind==='building'?'tile_building':kind}_${id}`,`/assets/sprites/${kind}s/${id}.png`);};
  scene.create=function(){
   this.cameras.main.setBackgroundColor('#38724c');
   const ambient=AmbientSprites.forScene(this);
   entries.forEach(([kind,id],i)=>{for(const [y,size] of [[140,200],[350,90]]) {
    const s=this.add.image(i*200+100,y,`${kind==='building'?'tile_building':kind}_${id}`).setDisplaySize(size,size).setDepth(14);
    ambient.attach(s,kind,`${id}-${size}`,()=>[i,0],()=>true);
   }this.add.text(i*200+100,245,id,{fontSize:'15px'}).setOrigin(.5);});
   this.events.off(Phaser.Scenes.Events.UPDATE,ambient.tick,ambient);
   for(const b of ambient.bindings)b.seed=0;
   window.frame=t=>{ambient.elapsed=t*1000-50;ambient.lastDraw=-Infinity;ambient.update(0,50);return [...ambient.layers.values()].reduce((n,g)=>n+g.commandBuffer.length,0);};
   window.ready=true;
  };
  window.game=new Phaser.Game({type:Phaser.CANVAS,width:1400,height:470,scene,audio:{noAudio:true},banner:false});
 });
 await page.waitForFunction(()=>window.ready);
 const counts=[];
 for(const t of [0,1.5,3,5.5,7.5,9]) {counts.push(await page.evaluate(t=>window.frame(t),t));await page.waitForTimeout(80);await page.screenshot({path:`${output}/frame-${t}.png`});}
 assert.ok(counts.every(n=>n>100));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.ok(await page.evaluate(()=>window.frame(3))<=10);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,output,counts}));
} finally {await browser.close();}
