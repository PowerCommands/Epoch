import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:800}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/metropolis-review',route=>route.fulfill({contentType:'text/html',body:`<body style="margin:0;background:#253b37"><script type="module">
 import Phaser from '/node_modules/phaser/dist/phaser.esm.js';
 import {drawMetropolis,drawMetropolisActivity} from '/src/systems/rendering/MetropolisArtwork.ts';
 import {HexGridLayout} from '/src/systems/gridLayout/HexGridLayout.ts';
 import {URBAN_SLOTS} from '/src/systems/UrbanDevelopment.ts';
 import {renderSettlementProgress} from '/src/ui/SettlementProgressView.ts';
 import {getSettlementProgress} from '/src/systems/SettlementProgress.ts';
 import {City} from '/src/entities/City.ts';import {CityBuildings} from '/src/entities/CityBuildings.ts';import {getBuildingById} from '/src/data/buildings.ts';
 const city=new City({id:'review',name:'Review',ownerId:'human',tileX:4,tileY:4,settlementStage:'City'}),buildings=new CityBuildings(city.id);
 buildings.add(getBuildingById('offshore_wind_farm'));buildings.add(getBuildingById('container_port'));
 document.body.append(renderSettlementProgress(getSettlementProgress(city,buildings,()=>true)));
 const map={width:9,height:9,tileSize:64},grid=new HexGridLayout(),origin=grid.tileToWorld({x:4,y:4},map),size=grid.getTileRect({x:4,y:4},map).width;
 const land=[{x:4,y:4},...URBAN_SLOTS.map(s=>({x:4+s.dq,y:4+s.dr}))].map(c=>grid.getTileOutlinePoints(c,map).map(p=>({x:p.x-origin.x,y:p.y-origin.y})));
 new Phaser.Game({type:Phaser.CANVAS,width:1100,height:520,backgroundColor:'#253b37',scene:{create(){const tx=this.textures.createCanvas('modern',800,700);tx.context.translate(400,350);tx.context.scale(3,3);drawMetropolis(tx.context,land,size);tx.refresh();this.add.image(550,270,'modern');this.ink=this.add.graphics({x:550,y:270}).setScale(3);window.ready=true;},update(time){this.ink.clear();drawMetropolisActivity(this.ink,land,size,time,13);}}});
 </script></body>`}));
 await page.goto((process.env.EPOCH_URL??'http://127.0.0.1:5180')+'/metropolis-review');
 await page.waitForFunction(()=>window.ready);
 assert.match(await page.locator('body').innerText(),/■ ■ □ □ □ □/);
 assert.match(await page.locator('body').innerText(),/Airport OR Container Port/);
 const before=await page.locator('canvas').screenshot();await page.waitForTimeout(1500);const after=await page.locator('canvas').screenshot();assert.ok(!before.equals(after),'living-world batch animates');
 await page.screenshot({path:'/tmp/metropolis-browser.png'});assert.deepEqual(errors,[]);console.log('Metropolis Phaser animation and six-slot City View passed.');
}finally{await browser.close();}
