/** Local Vite: node tools/cityDamageVisuals.browser.mjs http://127.0.0.1:5175 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
const url = process.argv[2] ?? 'http://127.0.0.1:5175';
const output = '/tmp/epoch-city-damage';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.EPOCH_BROWSER_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } }), errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  await page.route('**/__city_damage', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#536947"></body>' }));
  for (const canvas of [false, true]) {
    await page.goto(`${url}/__city_damage`);
    await page.evaluate(async canvas => {
      const { default: Phaser } = await import('/node_modules/.vite/deps/phaser.js');
      const { CityRenderer } = await import('/src/systems/CityRenderer.ts');
      const { CityBannerRenderer } = await import('/src/systems/CityBannerRenderer.ts');
      const { AirMissionRenderer } = await import('/src/renderers/AirMissionRenderer.ts');
      const { CityManager } = await import('/src/systems/CityManager.ts');
      const { NationManager } = await import('/src/systems/NationManager.ts');
      const { City } = await import('/src/entities/City.ts');
      const { Nation } = await import('/src/entities/Nation.ts');
      const { HexGridLayout } = await import('/src/systems/gridLayout/HexGridLayout.ts');
      const { GREAT_WAR_BOMBER, WARRIOR } = await import('/src/data/units.ts');
      const { setMapAnimationsEnabled } = await import('/src/systems/PlayerSettings.ts');
      const layout = new HexGridLayout(), data = { width: 40, height: 30, tileSize: 64 };
      const map = { tileToWorld: (x,y) => layout.tileToWorld({x,y}, data), getTileRect: (x,y) => layout.getTileRect({x,y}, data),
        getTileOutlinePoints: (x,y) => layout.getTileOutlinePoints({x,y}, data), worldToTile: (x,y) => layout.worldToTileCoord({x,y}, data) };
      const s = window.cityDamage = { fog: false, enabled: true, setMapAnimationsEnabled };
      s.game = new Phaser.Game({ type: canvas ? Phaser.CANVAS : Phaser.WEBGL, width: 1000, height: 760, backgroundColor: '#536947', audio: { noAudio: true }, scene: {
        preload() {
          for (const key of ['city_ancient', 'city_ancient-broken']) this.load.image(key, `/assets/sprites/cities/${key}.png`);
          for (const id of ['great_war_bomber', 'warrior']) this.load.image(`unit_${id}`, `/assets/sprites/units/${id}.png`);
        },
        create() {
          s.scene = this;
          s.cities = new CityManager(); const nations = new NationManager(); nations.addNation(new Nation({id:'a',name:'Test',color:0x992f44,secondaryColor:0xfff0c8}));
          s.city = new City({id:'city',name:'Bombardment Target',ownerId:'a',tileX:10,tileY:10}); s.cities.addCity(s.city);
          s.origin = map.tileToWorld(10,10);
          this.cameras.main.setZoom(2.6).centerOn(s.origin.x,s.origin.y);
          this.cameras.main.worldView.setTo(s.origin.x-500/2.6,s.origin.y-380/2.6,1000/2.6,760/2.6);
          s.renderer = new CityRenderer(this,map,s.cities,nations,()=> 'ancient');
          // A real masked production icon exercises the badge's geometry clip.
          const production = { getQueue: () => [{ item:{kind:'unit',unitType:WARRIOR},cost:40,progress:20 }],
            getProduction: () => ({item:{kind:'unit',unitType:WARRIOR}}) };
          s.badges = new CityBannerRenderer(this,map,s.cities,nations,production);
          s.renderer.setVisibilityPredicate(()=>!s.fog); s.badges.setVisibilityPredicate(()=>!s.fog);
          let emit;
          s.air = new AirMissionRenderer(this,map,{onFlight: cb => { emit=cb; return ()=>{emit=undefined;}; }},()=>s.enabled,()=>!s.fog,p=>s.badges.suppressAtTile(p.x,p.y));
          s.fire = (kind='strike') => emit({aircraft:{unitType:GREAT_WAR_BOMBER},origin:{x:6,y:10},destination:{x:10,y:10},kind,destroyed:false});
          s.draw = () => { s.scene.sys.depthSort(); const r=s.game.renderer;r.preRender();s.scene.sys.render(r);r.postRender(); };
          s.health = value => { s.city.health=value;s.renderer.refreshCity(s.city);s.badges.refreshCity(s.city);s.draw(); };
          s.setStage = stage => { s.air.update(0,60000);s.city.settlementStage=stage;s.health(200); };
          s.stepAir = age => { const f=s.air.flights[0];s.air.update(0,age-f.age);s.draw(); };
          s.badge = () => s.badges.banners.get('city').container;
        },
      } });
    }, canvas);
    await page.waitForFunction(()=>window.cityDamage?.health);
    await page.evaluate(()=>{window.cityDamage.game.loop.stop();window.cityDamage.draw();});
    for (const stage of ['Village','Town','City','Metropolis']) {
      await page.evaluate(stage=>window.cityDamage.setStage(stage),stage);
      await page.screenshot({path:`${output}/${canvas?'canvas':'webgl'}-${stage}-healthy.png`});
      const healthyKey=await page.evaluate(()=>window.cityDamage.renderer.getCityContainer('city').list.find(o=>o.type==='Image').texture.key);
      const damage=await page.evaluate(()=>{
        const s=window.cityDamage;s.health(101);
        const c=s.renderer.getCityContainer('city'),sprite=c.list.find(o=>o.type==='Image');
        const sites=s.renderer.damageEffects.sites;
        const frame=()=>JSON.stringify(s.renderer.damageEffects.graphics.commandBuffer);
        s.renderer.damageEffects.update(0,80);const first=frame();s.renderer.damageEffects.update(0,100);const second=frame();
        s.draw();return {damaged:c.getData('damaged'),key:sprite.texture.key,anchors:sites.get('city').anchors.length,animated:first!==second};
      });
      assert.ok(damage.damaged && damage.key.endsWith('-broken') && damage.anchors>=3 && damage.animated,JSON.stringify(damage));
      await page.screenshot({path:`${output}/${canvas?'canvas':'webgl'}-${stage}-damaged.png`});
      const lifecycle=await page.evaluate(()=>{
        const s=window.cityDamage;
        s.renderer.rebuildAll();const restored=s.renderer.getCityContainer('city').getData('damaged');
        s.health(102);const repaired=!s.renderer.getCityContainer('city').getData('damaged') && !s.renderer.damageEffects.graphics;
        const key=s.renderer.getCityContainer('city').list.find(o=>o.type==='Image').texture.key;
        s.health(101);s.renderer.setDetailCity('city');const detail=s.renderer.getCityContainer('city').list.find(o=>o.type==='Image').texture.key.endsWith('-broken');s.renderer.setDetailCity(null);
        s.fog=true;s.renderer.refreshAllVisibility();s.badges.refreshAllVisibility();s.renderer.damageEffects.update(0,100);
        const hidden=!s.renderer.getCityContainer('city').visible && s.renderer.damageEffects.graphics.commandBuffer.length===0;
        s.fog=false;s.renderer.refreshAllVisibility();s.badges.refreshAllVisibility();s.renderer.damageEffects.update(0,100);
        s.setMapAnimationsEnabled(false);s.renderer.damageEffects.update(0,100);const a=JSON.stringify(s.renderer.damageEffects.graphics.commandBuffer);
        s.renderer.damageEffects.update(0,100);const frozen=a===JSON.stringify(s.renderer.damageEffects.graphics.commandBuffer);s.setMapAnimationsEnabled(true);
        s.health(200);return {restored,repaired,key,detail,hidden,frozen};
      });
      assert.deepEqual(lifecycle,{restored:true,repaired:true,key:healthyKey,detail:true,hidden:true,frozen:true});
      await page.evaluate(()=>{const s=window.cityDamage;s.fire();s.stepAir(s.air.flights[0].plan.weapons[0].impactMs+160);});
      const impact=await page.evaluate(()=>{
        const s=window.cityDamage,f=s.air.flights[0];s.badges.refreshCity(s.city);
        return {hidden:!s.badge().visible,above:f.graphics.depth>s.renderer.getCityContainer('city').depth&&f.graphics.depth>s.badge().depth,
          smoke:f.smoke.flat().some(p=>p.visible&&p.alpha>.1)};
      });
      assert.deepEqual(impact,{hidden:true,above:true,smoke:true});
      const capture=await page.screenshot({path:`${output}/${canvas?'canvas':'webgl'}-${stage}-impact.png`});
      // Assert actual rendered pixels over the city, not just display-list properties.
      const ctx=createCanvas(1000,760).getContext('2d');ctx.drawImage(await loadImage(capture),0,0);
      const pixels=ctx.getImageData(440,310,120,130).data;let hot=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]>225&&pixels[i+1]>90&&pixels[i+1]<230&&pixels[i+2]<120)hot++;
      assert.ok(hot>120,`${canvas?'Canvas':'WebGL'} ${stage}: only ${hot} visible explosion pixels`);
      await page.evaluate(()=>{const s=window.cityDamage;s.air.update(0,60000);s.draw();});
      assert.equal(await page.evaluate(()=>window.cityDamage.badge().visible),true);
    }
    const badges=await page.evaluate(()=>{
      const s=window.cityDamage;
      const one=s.badges.suppressAtTile(10,10),two=s.badges.suppressAtTile(11,10);one();
      s.badges.rebuildAll();const overlapping=!s.badge().visible;two();two();const restored=s.badge().visible;
      s.fire('intercepted');s.stepAir(s.air.flights[0].plan.passMs+300);const intercepted=s.badge().visible;s.air.update(0,60000);
      s.fire();s.stepAir(s.air.flights[0].plan.passMs+600);s.enabled=false;s.air.update(0,20);const cancelled=s.badge().visible;
      s.enabled=true;s.fire();s.stepAir(s.air.flights[0].plan.passMs+600);s.fog=true;s.air.update(0,60000);const fogged=!s.badge().visible;
      s.fog=false;s.badges.refreshAllVisibility();s.health(101);s.renderer.removeCity('city');const removed=s.renderer.damageEffects.sites.size===0;
      s.renderer.rebuildAll();s.renderer.shutdown();s.air.shutdown();s.badges.shutdown();
      const clean=!s.scene.children.list.some(o=>['city-damage-fires','air-impact-smoke','city-badge-city'].includes(o.name));
      return {overlapping,restored,intercepted,cancelled,fogged,removed,clean};
    });
    assert.deepEqual(badges,{overlapping:true,restored:true,intercepted:true,cancelled:true,fogged:true,removed:true,clean:true});
    console.log(`PASS ${canvas?'Canvas':'WebGL'}: all settlement stages, 51% boundary, persistent fires, rebuild/detail/fog/reduced motion, visible explosion pixels over real city artwork/masked badge, overlapping strikes and cleanup.`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
